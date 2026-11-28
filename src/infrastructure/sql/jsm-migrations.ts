import snapshot from './migrations.v004.json';
import type { SqlDriver } from './driver';
import { JsmError } from '../../application/jsm/contracts';
import { text, utc } from '../../domain/inventory/model';

export const jsmMigrations = snapshot;

// Dedicated serial consumer owns execution. Reads never migrate schema.
export async function migrateJsm(
  db: SqlDriver,
  ddl: (statement: string) => Promise<unknown>,
  installationId: string,
  now: () => string,
): Promise<void> {
  try {
    text(installationId, 255);
    const ready = await db.rows<{ ready: number }>(
      'SELECT s.ready FROM incident_schema_state s JOIN monitoring_schema_state m ON m.installation_id = s.installation_id JOIN installation_metadata i ON i.installation_id = s.installation_id WHERE s.installation_id = ? AND s.schema_version = 3 AND s.ready = 1 AND m.schema_version = 2 AND m.ready = 1 AND i.schema_version = 1 AND i.readiness = ? AND i.environment = ?',
      [installationId, 'ready', 'DEVELOPMENT'],
    );
    if (ready.length !== 1 || ready[0]?.ready !== 1)
      throw new JsmError('NOT_READY');
    await ddl(snapshot[0]!.ddl);
    await db.write(
      'INSERT INTO jsm_schema_state (installation_id, schema_version, ready, checkpoints, updated_at) VALUES (?, 4, 0, ?, ?) ON DUPLICATE KEY UPDATE ready = 0',
      [installationId, '[]', utc(now())],
    );
    const rows = await db.rows<{ checkpoints: string }>(
      'SELECT checkpoints FROM jsm_schema_state WHERE installation_id = ?',
      [installationId],
    );
    const values: unknown = JSON.parse(rows[0]?.checkpoints ?? 'null');
    if (
      !Array.isArray(values) ||
      values.some(
        (name) =>
          typeof name !== 'string' ||
          !snapshot.slice(1).some((migration) => migration.name === name),
      ) ||
      new Set(values).size !== values.length
    )
      throw new JsmError('NOT_READY');
    const checkpoints = new Set<string>(values);
    for (const migration of snapshot.slice(1)) {
      if (checkpoints.has(migration.name)) continue;
      await ddl(migration.ddl);
      checkpoints.add(migration.name);
      await db.write(
        'UPDATE jsm_schema_state SET checkpoints = ?, updated_at = ? WHERE installation_id = ?',
        [JSON.stringify([...checkpoints]), utc(now()), installationId],
      );
    }
    await db.write(
      'UPDATE jsm_schema_state SET schema_version = 4, ready = 1, updated_at = ? WHERE installation_id = ?',
      [utc(now()), installationId],
    );
  } catch {
    throw new JsmError('NOT_READY');
  }
}
