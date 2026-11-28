import snapshot from './migrations.v006.json';
import type { SqlDriver } from './driver';
import { TransitionError } from '../../application/jsm-transitions/contracts';
import { text, utc } from '../../domain/inventory/model';
export const jsmTransitionMigrations = snapshot;
/** Caller owns administrator admission, installation binding and serialized bounded retries. */
export async function migrateJsmTransitions(
  db: SqlDriver,
  ddl: (statement: string) => Promise<unknown>,
  installationId: string,
  now: () => string,
): Promise<void> {
  try {
    text(installationId, 255);
    const ready = await db.rows<{ ready: number }>(
      'SELECT j.ready FROM operations_schema_state o JOIN jsm_schema_state j ON j.installation_id = o.installation_id JOIN incident_schema_state s ON s.installation_id = j.installation_id JOIN monitoring_schema_state m ON m.installation_id = j.installation_id JOIN installation_metadata i ON i.installation_id = j.installation_id WHERE j.installation_id = ? AND o.schema_version = 5 AND o.ready = 1 AND j.schema_version = 4 AND j.ready = 1 AND s.schema_version = 3 AND s.ready = 1 AND m.schema_version = 2 AND m.ready = 1 AND i.schema_version = 1 AND i.readiness = ? AND i.environment = ?',
      [installationId, 'ready', 'DEVELOPMENT'],
    );
    if (ready.length !== 1 || ready[0]?.ready !== 1)
      throw new TransitionError('NOT_READY');
    await ddl(snapshot[0]!.ddl);
    await db.write(
      'INSERT INTO jsm_transition_schema_state (installation_id, schema_version, ready, checkpoints, updated_at) VALUES (?, 6, 0, ?, ?) ON DUPLICATE KEY UPDATE ready = 0',
      [installationId, '[]', utc(now())],
    );
    const rows = await db.rows<{ checkpoints: string }>(
      'SELECT checkpoints FROM jsm_transition_schema_state WHERE installation_id = ?',
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
      throw new TransitionError('NOT_READY');
    const done = new Set<string>(values);
    for (const migration of snapshot.slice(1)) {
      if (done.has(migration.name)) continue;
      await ddl(migration.ddl);
      done.add(migration.name);
      await db.write(
        'UPDATE jsm_transition_schema_state SET checkpoints = ?, updated_at = ? WHERE installation_id = ?',
        [JSON.stringify([...done]), utc(now()), installationId],
      );
    }
    await db.write(
      'UPDATE jsm_transition_schema_state SET schema_version = 6, ready = 1, updated_at = ? WHERE installation_id = ?',
      [utc(now()), installationId],
    );
  } catch {
    throw new TransitionError('NOT_READY');
  }
}
