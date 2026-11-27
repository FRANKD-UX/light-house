import { getAppContext } from '@forge/api';
import sql from '@forge/sql';
import { migrateMonitoring } from '../../infrastructure/sql/monitoring-migrations';
import { Queue } from '@forge/events';
import { randomUUID } from 'node:crypto';
import {
  InventoryError,
  object,
  text,
  uuid,
} from '../../domain/inventory/model';
import { InventoryService } from '../../application/inventory/service';
import { MonitoringService } from '../../application/monitoring/service';
import type { MonitoringSecrets } from '../../application/monitoring/ports';
import { SqlMonitoringRepository } from '../../infrastructure/sql/monitoring-repository';
import { SqlAccessRepository } from '../../infrastructure/sql/access-repository';
import { SqlInventoryRepository } from '../../infrastructure/sql/inventory-repository';
import { forgeSql } from '../../infrastructure/sql/driver';
import { monitoringCrypto } from '../../infrastructure/monitoring/crypto';
import { ZabbixAdapter } from '../../infrastructure/monitoring/zabbix-adapter';
import { createStructuredLogger } from '../../infrastructure/observability/structured-logger';
import { isJiraAdmin } from '../inventory/boundary';
import type { TenantContext } from '../../application/ports/tenant-context';
const responses = {
  accepted: 202,
  invalid: 400,
  unauthorised: 401,
  conflict: 409,
  too_large: 413,
  method: 405,
  rate_limited: 429,
  unavailable: 503,
} as const;
// Every call builds dependencies from trusted current runtime context, with no warm tenant state.
export function createMonitoringHandlers(secrets: MonitoringSecrets) {
  function build(context?: unknown) {
    const runtime = getAppContext();
    if (runtime.environmentType !== 'DEVELOPMENT')
      throw new InventoryError('DENIED');
    const installationId = text(runtime.installationAri.toString(), 255);
    const now = () => new Date().toISOString();
    const inventory = new InventoryService(
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
        environment: runtime.environmentType,
        accountId:
          context === undefined ? '' : text(object(context).accountId, 128),
      },
    );
    const service = new MonitoringService(
      {
        repository: new SqlMonitoringRepository(forgeSql),
        secrets,
        crypto: monitoringCrypto,
        id: randomUUID,
        now,
        queue: {
          push: async (ctx, inboxId) => {
            await new Queue({ key: 'light-house-monitoring' }).push({
              body: {
                installationId: ctx.installationId,
                tenantId: ctx.tenantId,
                inboxId,
              },
              concurrency: {
                key: `light-house-intake-${ctx.tenantId}-${inboxId}`,
                limit: 1,
              },
            });
          },
        },
        authorise: async (tenantId, permission) => {
          if (context === undefined) throw new InventoryError('DENIED');
          return inventory.context(tenantId, permission);
        },
      },
      installationId,
      new ZabbixAdapter(),
    );
    return { service, inventory, installationId };
  }
  return {
    async ingress(request: unknown) {
      const correlationId = randomUUID();
      const logger = createStructuredLogger(console);
      try {
        const result = await build().service.receive(request, correlationId);
        logger.info({
          event: 'monitoring.ingress',
          correlationId,
          monitoringResult: result,
          outcome: result === 'accepted' ? 'success' : 'failure',
        });
        return { outputKey: result, statusCode: responses[result] };
      } catch {
        logger.error({
          event: 'processing.failed',
          correlationId,
          outcome: 'failure',
        });
        return { outputKey: 'unavailable', statusCode: 503 };
      }
    },
    async request(context: unknown, input: unknown) {
      const correlationId = randomUUID();
      try {
        const { service, inventory, installationId } = build(context);
        const data = object(input);
        let value: unknown;
        switch (data.action) {
          case 'migrate':
            await inventory.context(data.tenantId, 'configure');
            await inventory.admin();
            await new Queue({ key: 'light-house-monitoring-schema' }).push({
              body: { installationId },
              concurrency: {
                key: 'light-house-monitoring-schema-v2',
                limit: 1,
              },
            });
            value = { queued: true };
            break;
          case 'recover':
            value = await service.recover(data);
            break;
          case 'cleanup':
            value = await service.cleanup(data);
            break;
          case 'overview':
            value = await service.overview(data);
            break;
          case 'configure':
            value = await service.configure(data);
            break;
          case 'revoke':
            value = await service.revoke(data);
            break;
          case 'map':
            value = await service.map(data);
            break;
          case 'retry':
            value = await service.retry(data);
            break;
          default:
            throw new InventoryError('INVALID');
        }
        createStructuredLogger(console).info({
          event: 'monitoring.control',
          correlationId,
          outcome: 'success',
        });
        return { ok: true, value, correlationId };
      } catch (error) {
        createStructuredLogger(console).error({
          event: 'processing.failed',
          correlationId,
          outcome: 'failure',
        });
        return {
          ok: false,
          code: error instanceof InventoryError ? error.code : 'UNAVAILABLE',
          correlationId,
        };
      }
    },
    async migrate(event: unknown) {
      const correlationId = randomUUID();
      try {
        const { installationId } = build();
        const data = object(event);
        const body = object(data.body);
        if (
          Object.keys(body).length !== 1 ||
          body.installationId !== installationId
        )
          throw new InventoryError('DENIED');
        if (
          data.retryContext &&
          Number(object(data.retryContext).retryCount) >= 3
        )
          return;
        const rows = await forgeSql.rows<{
          readiness: string;
          schema_version: number;
        }>(
          'SELECT readiness, schema_version FROM installation_metadata WHERE installation_id = ? AND environment = ?',
          [installationId, 'DEVELOPMENT'],
        );
        if (rows[0]?.readiness !== 'ready' || rows[0].schema_version !== 1)
          throw new InventoryError('NOT_READY');
        await migrateMonitoring(
          forgeSql,
          (statement) => sql.executeDDL(statement),
          installationId,
          () => new Date().toISOString(),
        );
        createStructuredLogger(console).info({
          event: 'monitoring.worker',
          correlationId,
          outcome: 'success',
        });
      } catch {
        createStructuredLogger(console).error({
          event: 'processing.failed',
          correlationId,
          outcome: 'failure',
        });
        throw new Error('MONITORING_MIGRATION_UNAVAILABLE');
      }
    },
    async consume(event: unknown) {
      const correlationId = randomUUID();
      try {
        const { service, installationId } = build();
        const body = object(object(event).body);
        if (
          Object.keys(body).some(
            (key) => !['installationId', 'tenantId', 'inboxId'].includes(key),
          ) ||
          body.installationId !== installationId
        )
          throw new InventoryError('DENIED');
        const ctx: TenantContext = {
          installationId,
          tenantId: uuid(body.tenantId),
          actor: { kind: 'system' },
        };
        const data = object(event);
        if (
          data.retryContext &&
          Number(object(data.retryContext).retryCount) >= 5
        )
          return;
        if ((await service.process(ctx, uuid(body.inboxId))) === 'busy')
          throw new InventoryError('UNAVAILABLE');
        createStructuredLogger(console).info({
          event: 'monitoring.worker',
          correlationId,
          outcome: 'success',
        });
      } catch {
        createStructuredLogger(console).error({
          event: 'processing.failed',
          correlationId,
          outcome: 'failure',
        });
        throw new Error('MONITORING_WORKER_UNAVAILABLE');
      }
    },
  };
}
