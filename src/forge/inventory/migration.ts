import sql, { migrationRunner } from '@forge/sql';
import { getAppContext } from '@forge/api';
import { Queue } from '@forge/events';
import { migrations } from '../../infrastructure/sql/migrations';
import { forgeSql } from '../../infrastructure/sql/driver';
import { InventoryError, object } from '../../domain/inventory/model';
import type { Session } from '../../application/inventory/ports';
const runner = migrations.reduce(
  (queue, migration) => queue.enqueue(migration.name, migration.ddl),
  migrationRunner,
);
export async function enqueueMigration(session: Session) {
  await new Queue({ key: 'light-house-schema' }).push({
    body: { installationId: session.installationId },
    concurrency: { key: 'light-house-schema-v1', limit: 1 },
  });
  return false;
}
export async function migrateInstallation(event: unknown) {
  const runtime = getAppContext();
  const data = object(event);
  const body = object(data.body);
  if (
    runtime.environmentType !== 'DEVELOPMENT' ||
    body.installationId !== runtime.installationAri.toString()
  )
    throw new InventoryError('DENIED');
  const installationId = runtime.installationAri.toString();
  // Three attempts per queued job; an administrator may explicitly retry a failed migration.
  if (data.retryContext && Number(object(data.retryContext).retryCount) >= 3)
    return;
  async function state(readiness: string) {
    const version = readiness === 'ready' ? 1 : 0;
    const now = new Date().toISOString();
    await forgeSql.write(
      'INSERT INTO installation_metadata (installation_id, environment, schema_version, readiness, updated_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE schema_version = ?, readiness = ?, updated_at = ?',
      [
        installationId,
        runtime.environmentType,
        version,
        readiness,
        now,
        version,
        readiness,
        now,
      ],
    );
  }
  try {
    await sql.executeDDL(migrations[0]!.ddl);
    await state('provisioning');
    await runner.run();
    const applied = await runner.list();
    if (
      !migrations.every((migration) =>
        applied.some((item) => item.name === migration.name),
      )
    )
      throw new InventoryError('NOT_READY');
    await state('ready');
  } catch {
    try {
      await state('failed');
    } catch {
      /* Readiness stays absent/provisioning, which also denies writes. */
    }
    // Do not propagate arbitrary SDK messages into function logs.
    throw new InventoryError('NOT_READY');
  }
}
