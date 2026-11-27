import snapshot from './migrations.v002.json';
import { InventoryError } from '../../domain/inventory/model';
import type { SqlDriver } from './driver';
export const monitoringMigrations = snapshot;
// Separate explicit v002 registry: never mutates the SQL SDK's process-global v001 runner.
// A future dedicated, serialised DEVELOPMENT consumer must authorise execution; no call-on-read.
export async function migrateMonitoring(
  db: SqlDriver,
  ddl: (statement: string) => Promise<unknown>,
  installationId: string,
  now: () => string,
) {
  await ddl(snapshot[0]!.ddl);
  await db.write(
    'INSERT INTO monitoring_schema_state (installation_id, schema_version, ready, checkpoints, updated_at) VALUES (?, 2, 0, ?, ?) ON DUPLICATE KEY UPDATE ready = 0',
    [installationId, '[]', now()],
  );
  try {
    const rows = await db.rows<{ checkpoints: string }>(
      'SELECT checkpoints FROM monitoring_schema_state WHERE installation_id = ?',
      [installationId],
    );
    const parsed: unknown = JSON.parse(rows[0]?.checkpoints ?? 'null');
    if (
      !Array.isArray(parsed) ||
      parsed.some(
        (name) =>
          typeof name !== 'string' || !snapshot.some((m) => m.name === name),
      )
    )
      throw new InventoryError('NOT_READY');
    const names = new Set<string>(parsed);
    for (const migration of snapshot.slice(1)) {
      if (names.has(migration.name)) continue;
      await ddl(migration.ddl);
      names.add(migration.name);
      await db.write(
        'UPDATE monitoring_schema_state SET checkpoints = ?, updated_at = ? WHERE installation_id = ?',
        [JSON.stringify([...names]), now(), installationId],
      );
    }
    if (snapshot.slice(1).some((m) => !names.has(m.name)))
      throw new InventoryError('NOT_READY');
    await db.write(
      'UPDATE monitoring_schema_state SET schema_version = 2, ready = 1, updated_at = ? WHERE installation_id = ?',
      [now(), installationId],
    );
  } catch {
    throw new InventoryError('NOT_READY');
  } // Existing inventory ready-v1 is never rewritten.
}
