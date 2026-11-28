import { getAppContext } from '@forge/api';
import sql from '@forge/sql';
import { Queue } from '@forge/events';
import { randomUUID } from 'node:crypto';
import { InventoryService } from '../../application/inventory/service';
import { IncidentService } from '../../application/incidents/service';
import { JsmCreationService } from '../../application/jsm/service';
import { OrchestrationService } from '../../application/orchestration/service';
import { JsmError, type JsmGateway } from '../../application/jsm/contracts';
import type { TenantContext } from '../../application/ports/tenant-context';
import { IncidentError, type Incident } from '../../domain/incidents/model';
import { parseIncidentPolicy } from '../../domain/incidents/sla';
import {
  InventoryError,
  integer,
  object,
  text,
  uuid,
} from '../../domain/inventory/model';
import { SqlAccessRepository } from '../../infrastructure/sql/access-repository';
import { SqlInventoryRepository } from '../../infrastructure/sql/inventory-repository';
import {
  SqlIncidentInventory,
  SqlIncidentRepository,
} from '../../infrastructure/sql/incident-repository';
import { SqlJsmRepository } from '../../infrastructure/sql/jsm-repository';
import { SqlOperationsRepository } from '../../infrastructure/sql/operations-repository';
import { migrateIncidents } from '../../infrastructure/sql/incident-migrations';
import { migrateJsm } from '../../infrastructure/sql/jsm-migrations';
import { migrateOperations } from '../../infrastructure/sql/operations-migrations';
import { forgeSql } from '../../infrastructure/sql/driver';
import { ForgeJsmGateway } from '../../infrastructure/jsm/forge-gateway';
import { createStructuredLogger } from '../../infrastructure/observability/structured-logger';
import { isJiraAdmin } from '../inventory/boundary';

const publicIncident = (incident: Incident) => ({
  id: incident.id,
  tenantId: incident.tenantId,
  sourceId: incident.sourceId,
  problemEventId: incident.problemEventId,
  correlationId: incident.correlationId,
  createdAt: incident.createdAt,
  occurredAt: incident.occurredAt,
  impact: incident.impact,
  sla: incident.sla,
  state: incident.state,
  version: incident.version,
});
function runtimeInstallation(): string {
  const runtime = getAppContext();
  if (runtime.environmentType !== 'DEVELOPMENT')
    throw new InventoryError('DENIED');
  return text(runtime.installationAri.toString(), 255);
}
const now = () => new Date().toISOString();
function inventory(installationId: string, context: unknown) {
  return new InventoryService(
    {
      inventory: new SqlInventoryRepository(forgeSql),
      access: new SqlAccessRepository(forgeSql, randomUUID, now),
      id: randomUUID,
      now,
      isJiraAdmin,
      migrate: async () => {
        throw new InventoryError('DENIED');
      },
    },
    {
      installationId,
      environment: 'DEVELOPMENT',
      accountId: text(object(context).accountId, 128),
    },
  );
}
function services(
  gateway: JsmGateway,
  authoriseConfiguration: (ctx: TenantContext) => Promise<void>,
) {
  const repository = new SqlIncidentRepository(forgeSql);
  const jsmRepository = new SqlJsmRepository(forgeSql, now);
  const incident = new IncidentService({
    repository,
    inventory: new SqlIncidentInventory(repository),
    now,
    id: randomUUID,
  });
  const jsm = new JsmCreationService({
    repository: jsmRepository,
    gateway,
    now,
    id: randomUUID,
    authoriseConfiguration,
  });
  return {
    repository,
    jsmRepository,
    incident,
    jsm,
    pipeline: new OrchestrationService({
      ready: (ctx) => repository.ready(ctx.installationId),
      inbox: (ctx, id) => repository.inbox(ctx, id),
      candidates: (ctx, after) => repository.readyInbox(ctx, after),
      enrich: (ctx, inboxId) => incident.process(ctx, { inboxId }),
      jsmReady: (ctx) => jsmReady(ctx.installationId),
      configured: async (ctx) =>
        Boolean(await jsmRepository.configuration(ctx)),
      createJsm: (ctx, id) => jsm.create(ctx, id),
      authoriseRecovery: authoriseConfiguration,
    }),
  };
}
async function jsmReady(installationId: string): Promise<boolean> {
  try {
    const rows = await forgeSql.rows<{ ready: number; schema_version: number }>(
      'SELECT ready, schema_version FROM jsm_schema_state WHERE installation_id = ?',
      [installationId],
    );
    return rows[0]?.ready === 1 && rows[0].schema_version === 4;
  } catch {
    return false;
  }
}
export function createIncidentHandlers(
  gateway: JsmGateway = new ForgeJsmGateway(),
) {
  return {
    async request(context: unknown, input: unknown) {
      const correlationId = randomUUID();
      const logger = createStructuredLogger(console);
      try {
        const installationId = runtimeInstallation();
        const data = object(input);
        if (
          Object.keys(data).some(
            (key) =>
              ![
                'action',
                'tenantId',
                'after',
                'inboxId',
                'policy',
                'expected',
                'configuration',
                'incidentId',
              ].includes(key),
          )
        )
          throw new InventoryError('INVALID');
        const action = text(data.action, 32);
        const userInventory = inventory(installationId, context);
        const ctx = await userInventory.context(
          data.tenantId,
          action === 'overview' ? 'read' : 'configure',
        );
        const current = services(gateway, async (bound) => {
          if (
            bound.installationId !== installationId ||
            bound.tenantId !== ctx.tenantId
          )
            throw new InventoryError('DENIED');
          await userInventory.context(ctx.tenantId, 'configure');
          await userInventory.admin();
        });
        let value: unknown;
        if (action === 'migrate') {
          await userInventory.admin();
          await new Queue({ key: 'light-house-incident-schema' }).push({
            body: { installationId },
            concurrency: { key: 'light-house-incident-schema-v3', limit: 1 },
          });
          value = { queued: true };
        } else {
          if (!(await current.repository.ready(installationId)))
            throw new IncidentError('NOT_READY');
          switch (action) {
            case 'overview': {
              const rows = await current.repository.list(
                ctx,
                data.after === undefined || data.after === ''
                  ? ''
                  : uuid(data.after),
              );
              const page = rows.slice(0, 20);
              const operationRepository = new SqlOperationsRepository(
                forgeSql,
                now,
              );
              const operationsReady =
                await operationRepository.ready(installationId);
              const operationRows = operationsReady
                ? await operationRepository.list(
                    ctx,
                    data.after === undefined || data.after === ''
                      ? ''
                      : uuid(data.after),
                  )
                : [];
              const pageIds = new Set(page.map((row) => row.id));
              const operations = operationRows
                .filter((row) => pageIds.has(row.incident.id))
                .map((row) => ({
                  incidentId: row.incident.id,
                  state: row.incident.state,
                  version: row.incident.version,
                  ownerTeamId: row.incident.ownerTeamId,
                  ownerAssigneeId: row.incident.ownerAssigneeId,
                  nocTeamId: row.nocTeamId,
                  pendingMaterialisation: row.pending !== null,
                  pendingHandoff: row.incident.pendingHandoff !== null,
                  pendingReturn: row.incident.pendingReturn !== null,
                  resolvedAt: row.incident.resolvedAt,
                }));
              const links =
                page.length && (await jsmReady(installationId))
                  ? await forgeSql.rows<{
                      incidentId: string;
                      state: string;
                      issueId: string | null;
                      issueKey: string | null;
                    }>(
                      `SELECT incident_id AS incidentId, state, issue_id AS issueId, issue_key AS issueKey FROM jsm_intents WHERE installation_id = ? AND tenant_id = ? AND incident_id IN (${page.map(() => '?').join(', ')})`,
                      [
                        installationId,
                        ctx.tenantId,
                        ...page.map((row) => row.id),
                      ],
                    )
                  : [];
              value = {
                incidents: page.map(publicIncident),
                next: rows.length > 20 ? rows[19]!.id : null,
                policies: await current.repository.policies(ctx),
                jsmLinks: links,
                operations,
                operationsReady,
              };
              break;
            }
            case 'process': {
              const result = await current.incident.process(ctx, {
                inboxId: data.inboxId,
              });
              value =
                result.kind === 'incident'
                  ? { ...result, incident: publicIncident(result.incident) }
                  : result;
              break;
            }
            case 'recover':
              value = await current.pipeline.recover(ctx, {
                after: data.after,
              });
              break;
            case 'publishPolicy': {
              // Publication identity is generated at the trusted boundary, preventing
              // a caller from reusing a UUID across independent tier timelines.
              const policy = parseIncidentPolicy(ctx.tenantId, {
                ...object(data.policy),
                id: randomUUID(),
              });
              if (
                !(await current.repository.publishPolicy(
                  ctx,
                  policy,
                  integer(data.expected, 1000, 0),
                ))
              )
                throw new IncidentError('CONFLICT');
              value = { saved: true };
              break;
            }
            case 'configureJsm': {
              const supplied = object(data.configuration);
              if ('installationId' in supplied || 'tenantId' in supplied)
                throw new InventoryError('INVALID');
              await current.jsm.configure(
                ctx,
                {
                  ...supplied,
                  installationId: ctx.installationId,
                  tenantId: ctx.tenantId,
                },
                data.expected,
              );
              value = { saved: true };
              break;
            }
            case 'createJsm':
              value = await current.jsm.create(ctx, data.incidentId);
              break;
            default:
              throw new InventoryError('INVALID');
          }
        }
        logger.info({
          event: 'incident.control',
          correlationId,
          outcome: 'success',
        });
        return { ok: true, value, correlationId };
      } catch (error) {
        logger.error({
          event: 'processing.failed',
          correlationId,
          outcome: 'failure',
        });
        return {
          ok: false,
          code:
            error instanceof InventoryError ||
            error instanceof IncidentError ||
            error instanceof JsmError
              ? error.code
              : 'UNAVAILABLE',
          correlationId,
        };
      }
    },
    /** Called after mapped monitoring work, including a redelivery after a partial downstream failure. */
    async processReady(ctx: TenantContext, inboxId: string): Promise<void> {
      if (ctx.installationId !== runtimeInstallation())
        throw new InventoryError('DENIED');
      const current = services(gateway, async () => {
        throw new InventoryError('DENIED');
      });
      const result = await current.pipeline.process(ctx, inboxId);
      if (
        result.status === 'incident_schema_not_ready' ||
        result.status === 'receipt_not_ready'
      )
        return;
      createStructuredLogger(console).info({
        event: 'incident.worker',
        correlationId: randomUUID(),
        outcome: 'success',
      });
    },
    async migrate(event: unknown): Promise<void> {
      const correlationId = randomUUID();
      try {
        const installationId = runtimeInstallation();
        const data = object(event),
          body = object(data.body);
        if (
          Object.keys(body).length !== 1 ||
          body.installationId !== installationId
        )
          throw new InventoryError('DENIED');
        if (
          data.retryContext &&
          integer(object(data.retryContext).retryCount, 100, 0) >= 3
        )
          return;
        await migrateIncidents(
          forgeSql,
          (statement) => sql.executeDDL(statement),
          installationId,
          now,
        );
        await migrateJsm(
          forgeSql,
          (statement) => sql.executeDDL(statement),
          installationId,
          now,
        );
        await migrateOperations(
          forgeSql,
          (statement) => sql.executeDDL(statement),
          installationId,
          now,
        );
        createStructuredLogger(console).info({
          event: 'incident.worker',
          correlationId,
          outcome: 'success',
        });
      } catch {
        createStructuredLogger(console).error({
          event: 'processing.failed',
          correlationId,
          outcome: 'failure',
        });
        throw new Error('INCIDENT_MIGRATION_UNAVAILABLE');
      }
    },
  };
}
const handlers = createIncidentHandlers();
export const incidentRequest = handlers.request;
export const enrichMonitoringReceipt = handlers.processReady;
export const incidentMigrate = handlers.migrate;
