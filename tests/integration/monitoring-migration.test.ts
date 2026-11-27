// Local adapted SQLite migration simulation; not Forge DDL/runtime acceptance.
import { expect, it, vi } from 'vitest';
import { database } from '../support/sqlite';
import {
  migrateMonitoring,
  monitoringMigrations,
} from '../../src/infrastructure/sql/monitoring-migrations';
import type { SqlDriver } from '../../src/infrastructure/sql/driver';
it('keeps v1 ready, persists v2 checkpoints across DDL failure and resumes without replaying completed tables', async () => {
  const h = database();
  await h.ready();
  const db: SqlDriver = {
    rows: h.db.rows,
    write: (query, params) =>
      h.db.write(
        query.replace(
          'ON DUPLICATE KEY UPDATE ready = 0',
          'ON CONFLICT (installation_id) DO UPDATE SET ready = 0',
        ),
        params,
      ),
  };
  const ddl = vi.fn(async (query: string) => {
    h.sqlite.exec(
      query
        .replace(/ CHARACTER SET utf8mb4 COLLATE utf8mb4_bin/g, '')
        .replace(/,\s*INDEX \w+ \([^)]*\)/g, '')
        .replace(/UNIQUE KEY \w+/g, 'UNIQUE'),
    );
  });
  const execute = () =>
    migrateMonitoring(db, ddl, h.session.installationId, h.deps.now);
  const base = ddl.getMockImplementation()!;
  let calls = 0;
  ddl.mockImplementation(async (q) => {
    if (++calls === 3) throw new Error('synthetic DDL failure');
    await base(q);
  });
  await expect(execute()).rejects.toThrow('NOT_READY');
  expect(
    h.sqlite.prepare('SELECT ready FROM monitoring_schema_state').get(),
  ).toMatchObject({ ready: 0 });
  expect(
    h.sqlite.prepare('SELECT readiness FROM installation_metadata').get(),
  ).toMatchObject({ readiness: 'ready' });
  ddl.mockImplementation(base);
  ddl.mockClear();
  await execute();
  expect(ddl.mock.calls.map(([q]) => q)).not.toContain(
    monitoringMigrations[1]!.ddl,
  );
  expect(
    h.sqlite.prepare('SELECT ready FROM monitoring_schema_state').get(),
  ).toMatchObject({ ready: 1 });
  ddl.mockClear();
  await execute();
  expect(ddl).toHaveBeenCalledTimes(1);
  h.sqlite
    .prepare('UPDATE monitoring_schema_state SET checkpoints = ?')
    .run('["unknown"]');
  await expect(execute()).rejects.toThrow('NOT_READY');
  expect(
    h.sqlite.prepare('SELECT ready FROM monitoring_schema_state').get(),
  ).toMatchObject({ ready: 0 });
});
