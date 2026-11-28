import { noInventoryDiagnostics } from '../../application/ports/inventory-diagnostics';
import { createInventoryDiagnostics } from '../../infrastructure/observability/inventory-diagnostics';
import api, { getAppContext, route } from '@forge/api';
import { randomUUID } from 'node:crypto';
import { InventoryError, object, text } from '../../domain/inventory/model';
import { InventoryService } from '../../application/inventory/service';
import { seedBatch } from '../../application/inventory/seed';
import { SqlInventoryRepository } from '../../infrastructure/sql/inventory-repository';
import { SqlAccessRepository } from '../../infrastructure/sql/access-repository';
import { forgeSql } from '../../infrastructure/sql/driver';
import { createStructuredLogger } from '../../infrastructure/observability/structured-logger';
import { enqueueMigration } from './migration';
import { readSchemaDiagnostic } from '../../infrastructure/sql/schema-diagnostics';
export async function isJiraAdmin(): Promise<boolean> {
  try {
    const response = await api
      .asUser()
      .requestJira(route`/rest/api/3/mypermissions?permissions=ADMINISTER`);
    if (!response.ok) return false;
    const body = object(await response.json());
    const permissions = object(body.permissions);
    const permission = object(permissions.ADMINISTER);
    return (
      permission.havePermission === true &&
      permission.key === 'ADMINISTER' &&
      permission.type === 'GLOBAL'
    );
  } catch {
    return false;
  }
}
export async function inventoryRequest(context: unknown, payload: unknown) {
  const correlationId = randomUUID();
  const logger = createStructuredLogger(console);
  // Invalid/unrecognised actions never become diagnostic labels.
  let diagnostic = noInventoryDiagnostics;
  try {
    const request = object(payload);
    if (request.action === 'list')
      diagnostic = createInventoryDiagnostics(logger, correlationId);
    await diagnostic.run('resolver.entry', () => undefined);
    const { accountId, runtime, installationId } = await diagnostic.run(
      'installation.context',
      () => {
        // Only server resolver context accountId is identity. Payload cannot replace any runtime context.
        const ctx = object(context);
        const accountId = text(ctx.accountId, 128);
        const runtime = getAppContext();
        const installationId = text(runtime.installationAri.toString(), 512);
        return { accountId, runtime, installationId };
      },
    );
    if (request.action === 'schemaDiagnostics') {
      if (runtime.environmentType !== 'DEVELOPMENT' || !(await isJiraAdmin()))
        throw new InventoryError('DENIED');
      if (Object.keys(request).some((key) => key !== 'action'))
        throw new InventoryError('INVALID');
      return {
        ok: true,
        value: await readSchemaDiagnostic(
          runtime.installationAri.toString(),
          runtime.environmentType,
        ),
        correlationId,
      };
    }
    const session = {
      accountId,
      installationId,
      environment: runtime.environmentType,
    };
    const deps = {
      inventory: new SqlInventoryRepository(forgeSql, diagnostic),
      access: new SqlAccessRepository(
        forgeSql,
        randomUUID,
        () => new Date().toISOString(),
        diagnostic,
      ),
      id: randomUUID,
      now: () => new Date().toISOString(),
      isJiraAdmin,
      migrate: enqueueMigration,
    };
    const service = new InventoryService(deps, session, diagnostic);
    let value: unknown;
    switch (request.action) {
      case 'overview':
        value = await service.overview();
        break;
      case 'migrate':
        value = await service.migrate();
        break;
      case 'bootstrap':
        value = await service.bootstrap(request);
        break;
      case 'list':
        value = await service.list(request);
        break;
      case 'save':
        value = await service.save(request);
        break;
      case 'configureTenant':
        value = await service.configureTenant(request);
        break;
      case 'grant':
        value = await service.grant(request);
        break;
      case 'publish':
        value = await service.publish(request);
        break;
      case 'repairProbe':
        value = await service.repairProbe(request);
        break;
      case 'repairTenant':
        value = await service.repairTenant(request);
        break;
      case 'repair':
        value = await service.repair(request);
        break;
      case 'seed':
        value = await seedBatch(service, deps, request);
        break;
      default:
        throw new InventoryError('INVALID');
    }
    const response = { ok: true, value, correlationId };
    // Resolver SDK performs the same JSON roundtrip after callback return. Check it here
    // so serialization failures retain correlation and a distinct safe diagnostic stage.
    if (request.action === 'list')
      await diagnostic.run('response.serialization', () => {
        JSON.stringify(response);
      });
    await diagnostic.run('resolver.completion', () => undefined);
    return response;
  } catch (error) {
    try {
      await diagnostic.run('resolver.completion', () => {
        throw error;
      });
    } catch {
      /* Failure recorded; preserve public contract. */
    }
    logger.error({
      event: 'processing.failed',
      correlationId,
      outcome: 'failure',
    });
    // Never expose arbitrary SQL/SDK messages, raw parameters, membership records or payloads.
    return {
      ok: false,
      code: error instanceof InventoryError ? error.code : 'UNAVAILABLE',
      correlationId,
    };
  }
}
