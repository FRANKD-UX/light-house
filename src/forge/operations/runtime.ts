import { getAppContext } from '@forge/api';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { InventoryService } from '../../application/inventory/service';
import { OperationService } from '../../application/operations/service';
import {
  OperationError,
  type OperationAggregate,
} from '../../application/operations/contracts';
import {
  InventoryError,
  integer,
  object,
  text,
  uuid,
} from '../../domain/inventory/model';
import { IncidentError } from '../../domain/incidents/model';
import { SqlOperationsRepository } from '../../infrastructure/sql/operations-repository';
import { SqlAccessRepository } from '../../infrastructure/sql/access-repository';
import { SqlInventoryRepository } from '../../infrastructure/sql/inventory-repository';
import { SqlOperationAuthority } from '../../infrastructure/operations/authority';
import { forgeSql } from '../../infrastructure/sql/driver';
import { createStructuredLogger } from '../../infrastructure/observability/structured-logger';
import { isJiraAdmin } from '../inventory/boundary';
function publicOperation(value: OperationAggregate | null) {
  if (!value) return null;
  const state = value.incident;
  return {
    id: state.id,
    state: state.state,
    version: state.version,
    ownerTeamId: state.ownerTeamId,
    ownerAssigneeId: state.ownerAssigneeId,
    nocTeamId: value.nocTeamId,
    pendingHandoff: state.pendingHandoff,
    pendingReturn: state.pendingReturn,
    recoveryObservedAt: state.recoveryObservedAt,
    restorationValidatedAt: state.restorationValidatedAt,
    resolvedAt: state.resolvedAt,
    sla: state.sla,
    factsVersion: value.factsVersion,
    pendingMaterialisation: value.pending !== null,
    // There is no verified native transition reader yet; UI must not enable closure.
    nativeClosureAvailable: false,
  };
}
export async function operationsRequest(context: unknown, input: unknown) {
  const correlationId = randomUUID(),
    logger = createStructuredLogger(console);
  try {
    const runtime = getAppContext();
    if (runtime.environmentType !== 'DEVELOPMENT')
      throw new InventoryError('DENIED');
    const installationId = text(runtime.installationAri.toString(), 255),
      accountId = text(object(context).accountId, 128);
    const data = object(input);
    if (
      Object.keys(data).some(
        (key) =>
          ![
            'action',
            'tenantId',
            'incidentId',
            'command',
            'checklist',
            'configuration',
            'expected',
          ].includes(key),
      )
    )
      throw new InventoryError('INVALID');
    const action = text(data.action, 32),
      now = () => new Date().toISOString();
    const inventory = new InventoryService(
      {
        inventory: new SqlInventoryRepository(forgeSql),
        access: new SqlAccessRepository(forgeSql, randomUUID, now),
        now,
        id: randomUUID,
        isJiraAdmin,
        migrate: async () => {
          throw new InventoryError('DENIED');
        },
      },
      { installationId, environment: 'DEVELOPMENT', accountId },
    );
    const ctx = await inventory.context(
      data.tenantId,
      action === 'overview'
        ? 'read'
        : action === 'configure' || action === 'repair'
          ? 'configure'
          : 'write',
    );
    const repository = new SqlOperationsRepository(forgeSql, now);
    if (!(await repository.ready(installationId)))
      throw new OperationError('NOT_READY');
    const authority = new SqlOperationAuthority(forgeSql, repository, now);
    const service = new OperationService({
      repository,
      now,
      id: randomUUID,
      digest: (value) => createHash('sha256').update(value).digest('hex'),
      authorise: (scope, command) => authority.authorise(scope, command),
    });
    let value: unknown;
    switch (action) {
      case 'overview': {
        const id = uuid(data.incidentId);
        const current = await repository.load(ctx, id);
        if (
          current &&
          (current.installationId !== ctx.installationId ||
            current.tenantId !== ctx.tenantId ||
            current.incident.id !== id)
        )
          throw new OperationError('DENIED');
        const config = await repository.configuration(ctx);
        value = {
          operation: publicOperation(current),
          configuration: config
            ? {
                nocTeamId: uuid(config.nocTeamId),
                version: integer(config.version),
              }
            : null,
        };
        break;
      }
      case 'configure': {
        const config = object(data.configuration);
        if (
          Object.keys(config).some(
            (key) => !['nocTeamId', 'version'].includes(key),
          )
        )
          throw new OperationError('INVALID');
        if (
          !(await repository.configure(
            ctx,
            {
              nocTeamId: uuid(config.nocTeamId),
              version: integer(config.version),
            },
            integer(data.expected, 2147483646, 0),
          ))
        )
          throw new OperationError('CONFLICT');
        value = { saved: true };
        break;
      }
      case 'execute':
        value = await service.execute(ctx, data.command);
        break;
      case 'checklist':
        value = await service.recordChecklist(ctx, data.checklist);
        break;
      case 'repair': {
        // Projection-only repair of an already committed command, never a new transition.
        const id = uuid(data.incidentId),
          current = await repository.load(ctx, id);
        if (!current) throw new OperationError('NOT_READY');
        if (
          current.installationId !== ctx.installationId ||
          current.tenantId !== ctx.tenantId ||
          current.incident.id !== id
        )
          throw new OperationError('DENIED');
        if (current.lease) throw new OperationError('REPAIR_REQUIRED');
        const completed = current.pending
          ? await repository.materialise(
              ctx,
              id,
              current.pending.receipt.commandId,
            )
          : true;
        value = { completed };
        break;
      }
      default:
        throw new InventoryError('INVALID');
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
        error instanceof OperationError ||
        error instanceof IncidentError
          ? error.code
          : 'UNAVAILABLE',
      correlationId,
    };
  }
}
