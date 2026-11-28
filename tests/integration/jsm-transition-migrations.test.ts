// Adapted SQLite migration checks; not native Forge SQL execution.
import { expect, it, vi } from 'vitest';
import { monitoringFixture } from '../support/monitoring';
import { migrateIncidents } from '../../src/infrastructure/sql/incident-migrations';
import { migrateJsm } from '../../src/infrastructure/sql/jsm-migrations';
import { migrateOperations } from '../../src/infrastructure/sql/operations-migrations';
import {
  migrateJsmTransitions,
  jsmTransitionMigrations,
} from '../../src/infrastructure/sql/jsm-transition-migrations';
import type { SqlDriver } from '../../src/infrastructure/sql/driver';
async function fixture() {
  const f = await monitoringFixture();
  const db: SqlDriver = {
    rows: f.h.db.rows,
    write: (q, p) =>
      f.h.db.write(
        q.replace(
          'ON DUPLICATE KEY UPDATE ready = 0',
          'ON CONFLICT (installation_id) DO UPDATE SET ready = 0',
        ),
        p,
      ),
  };
  const ddl = vi.fn(async (q: string) =>
    f.h.sqlite.exec(
      q
        .replace(/ CHARACTER SET utf8mb4 COLLATE utf8mb4_bin/g, '')
        .replace(/,\s*INDEX \w+ \([^)]*\)/g, '')
        .replace(/UNIQUE KEY \w+/g, 'UNIQUE'),
    ),
  );
  await migrateIncidents(db, ddl, f.ctx.installationId, f.deps.now);
  await migrateJsm(db, ddl, f.ctx.installationId, f.deps.now);
  await migrateOperations(db, ddl, f.ctx.installationId, f.deps.now);
  return {
    ...f,
    db,
    ddl,
    run: (execute = ddl) =>
      migrateJsmTransitions(db, execute, f.ctx.installationId, f.deps.now),
  };
}
it('applies additive v006 only after ready v001-v005 and replays without losing existing data', async () => {
  const f = await fixture();
  await f.run();
  const read = () =>
    f.db.rows<{ schema_version: number; ready: number; checkpoints: string }>(
      'SELECT schema_version,ready,checkpoints FROM jsm_transition_schema_state WHERE installation_id = ?',
      [f.ctx.installationId],
    );
  expect(await read()).toEqual([
    {
      schema_version: 6,
      ready: 1,
      checkpoints: JSON.stringify([jsmTransitionMigrations[1]!.name]),
    },
  ]);
  const count = await f.db.rows<{ n: number }>(
    'SELECT COUNT(*) AS n FROM isp_tenants',
    [],
  );
  f.ddl.mockClear();
  await f.run();
  expect(f.ddl).toHaveBeenCalledTimes(1);
  expect(await f.db.rows('SELECT COUNT(*) AS n FROM isp_tenants', [])).toEqual(
    count,
  );
});
it('retains incomplete readiness and retries only unapplied DDL after failure', async () => {
  const f = await fixture();
  const broken = vi.fn(async (q: string) => {
    if (q.includes('CREATE TABLE IF NOT EXISTS jsm_transition_intents'))
      throw new Error('private database failure');
    return f.ddl(q);
  });
  await expect(f.run(broken)).rejects.toThrow('NOT_READY');
  expect(
    await f.db.rows(
      'SELECT ready,checkpoints FROM jsm_transition_schema_state',
      [],
    ),
  ).toEqual([{ ready: 0, checkpoints: '[]' }]);
  await f.run();
  expect(
    await f.db.rows('SELECT ready FROM jsm_transition_schema_state', []),
  ).toEqual([{ ready: 1 }]);
});
it('fails closed on parent readiness, wrong environment and corrupted checkpoint history', async () => {
  const f = await fixture();
  await f.db.write(
    'UPDATE operations_schema_state SET ready = 0 WHERE installation_id = ?',
    [f.ctx.installationId],
  );
  f.ddl.mockClear();
  await expect(f.run()).rejects.toThrow('NOT_READY');
  expect(f.ddl).not.toHaveBeenCalled();
  await f.db.write(
    'UPDATE operations_schema_state SET ready = 1 WHERE installation_id = ?',
    [f.ctx.installationId],
  );
  await f.run();
  await f.db.write(
    'UPDATE jsm_transition_schema_state SET checkpoints = ? WHERE installation_id = ?',
    [JSON.stringify(['unexpected']), f.ctx.installationId],
  );
  await expect(f.run()).rejects.toThrow('NOT_READY');
  expect(
    await f.db.rows('SELECT ready FROM jsm_transition_schema_state', []),
  ).toEqual([{ ready: 0 }]);
  await f.db.write(
    'UPDATE installation_metadata SET environment = ? WHERE installation_id = ?',
    ['PRODUCTION', f.ctx.installationId],
  );
  await expect(f.run()).rejects.toThrow('NOT_READY');
});
