import snapshot from './migrations.v003.json';
import type { SqlDriver } from './driver';
import { IncidentError } from '../../domain/incidents/model';
export const incidentMigrations = snapshot;
/** Additive, isolated registry. Caller must authorise and serialize this operation. */
export async function migrateIncidents(
  db: SqlDriver,
  ddl: (statement: string) => Promise<unknown>,
  installationId: string,
  now: () => string,
): Promise<void> {
  const prior = await db.rows<{ ready: number; schema_version: number }>(
    'SELECT m.ready, m.schema_version FROM monitoring_schema_state m JOIN installation_metadata i ON i.installation_id = m.installation_id WHERE m.installation_id = ? AND i.environment = ? AND i.readiness = ? AND i.schema_version = 1',
    [installationId, 'DEVELOPMENT', 'ready'],
  );
  if (prior[0]?.ready !== 1 || prior[0].schema_version !== 2)
    throw new IncidentError('NOT_READY');
  await ddl(snapshot[0]!.ddl);
  await db.write(
    'INSERT INTO incident_schema_state (installation_id, schema_version, ready, checkpoints, updated_at) VALUES (?, 3, 0, ?, ?) ON DUPLICATE KEY UPDATE ready = 0',
    [installationId, '[]', now()],
  );
  const rows = await db.rows<{ checkpoints: string }>(
    'SELECT checkpoints FROM incident_schema_state WHERE installation_id = ?',
    [installationId],
  );
  const parsed: unknown = JSON.parse(rows[0]?.checkpoints ?? 'null');
  if (
    !Array.isArray(parsed) ||
    parsed.some((name) => !snapshot.slice(1).some((m) => m.name === name))
  )
    throw new IncidentError('NOT_READY');
  const checkpoints = new Set<string>(parsed as string[]);
  for (const migration of snapshot.slice(1)) {
    if (checkpoints.has(migration.name)) continue;
    await ddl(migration.ddl);
    checkpoints.add(migration.name);
    await db.write(
      'UPDATE incident_schema_state SET checkpoints = ?, updated_at = ? WHERE installation_id = ?',
      [JSON.stringify([...checkpoints]), now(), installationId],
    );
  }
  await db.write(
    'UPDATE incident_schema_state SET ready = 1, schema_version = 3, updated_at = ? WHERE installation_id = ?',
    [now(), installationId],
  );
}
