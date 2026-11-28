// Adapted SQLite selection tests; no hosted Forge SQL, gateway or queue acceptance.
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { monitoringFixture } from '../support/monitoring';
import { SqlIncidentRepository } from '../../src/infrastructure/sql/incident-repository';
import { incidentMigrations } from '../../src/infrastructure/sql/incident-migrations';
import type { SqlDriver } from '../../src/infrastructure/sql/driver';

async function fixture(count = 24) {
  const f = await monitoringFixture();
  await f.topology();
  for (const migration of incidentMigrations)
    f.h.sqlite.exec(
      migration.ddl
        .replace(/ CHARACTER SET utf8mb4 COLLATE utf8mb4_bin/g, '')
        .replace(/,\s*INDEX \w+ \([^)]*\)/g, '')
        .replace(/UNIQUE KEY \w+/g, 'UNIQUE'),
    );
  for (let n = 0; n < count; n++) {
    const eventId = String(100 + n);
    expect(
      await f.service.receive(
        f.request({
          ...f.event,
          externalEventId: eventId,
          problemEventId: eventId,
        }),
        randomUUID(),
      ),
    ).toBe('accepted');
  }
  await f.process();
  const repo = new SqlIncidentRepository(f.h.db);
  const all = f.h.sqlite
    .prepare('SELECT id FROM monitoring_inbox ORDER BY id')
    .all() as { id: string }[];
  return { ...f, repo, all };
}

it('returns21 ordered ready receipts with a sentinel and keyset continuation without hiding already-recorded partial work', async () => {
  const f = await fixture();
  const entry = await f.repo.inbox(f.ctx, f.all[0]!.id);
  expect(entry).not.toBeNull();
  await f.repo.recordEvidence(f.ctx, entry!);
  expect(
    f.h.sqlite.prepare('SELECT COUNT(*) AS n FROM incident_evidence').get(),
  ).toMatchObject({ n: 1 });
  expect(
    f.h.sqlite.prepare('SELECT COUNT(*) AS n FROM incidents').get(),
  ).toMatchObject({ n: 0 });
  // Evidence exists but no incident or JSM tables/configuration: candidate is still present.
  const first = await f.repo.readyInbox(f.ctx);
  expect(first).toEqual(f.all.slice(0, 21));
  expect(first[0]?.id).toBe(entry!.inboxId);
  const remaining = await f.repo.readyInbox(f.ctx, first[19]!.id);
  expect(remaining).toEqual(f.all.slice(20));
  expect(
    new Set([...first.slice(0, 20), ...remaining].map((row) => row.id)).size,
  ).toBe(24);
  expect(await f.repo.readyInbox(f.ctx, f.all[23]!.id)).toEqual([]);
  const queries = f.h.statements.filter((row) =>
    row.query.startsWith('SELECT b.id FROM monitoring_inbox'),
  );
  expect(queries.length).toBe(3);
  expect(
    queries.every(
      (row) =>
        row.query.includes('LIMIT 21') &&
        !row.query.includes('incident_evidence') &&
        !row.query.includes('jsm_intents'),
    ),
  ).toBe(true);
});

it('does not hide a ready receipt merely because an incident already exists while JSM work is absent', async () => {
  const f = await fixture(2);
  const entry = (await f.repo.inbox(f.ctx, f.all[0]!.id))!;
  const id = randomUUID();
  f.h.sqlite
    .prepare(
      'INSERT INTO incidents (installation_id, tenant_id, id, source_id, problem_event_id, occurred_at, created_at, state, version, snapshot_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      f.ctx.installationId,
      f.tenantId,
      id,
      entry.sourceId,
      entry.event.problemEventId,
      entry.event.occurredAt,
      f.deps.now(),
      'new',
      1,
      '{}',
    );
  expect(await f.repo.readyInbox(f.ctx)).toEqual(f.all);
});

it('selects only the trusted installation/tenant ready rows joined to an active matching source', async () => {
  const f = await fixture(5);
  f.h.sqlite
    .prepare('UPDATE monitoring_inbox SET status = ? WHERE id = ?')
    .run('manual_triage', f.all[0]!.id);
  f.h.sqlite
    .prepare('UPDATE monitoring_inbox SET installation_id = ? WHERE id = ?')
    .run('foreign-installation', f.all[1]!.id);
  f.h.sqlite
    .prepare('UPDATE monitoring_inbox SET tenant_id = ? WHERE id = ?')
    .run(randomUUID(), f.all[2]!.id);
  f.h.sqlite
    .prepare('UPDATE monitoring_inbox SET source_id = ? WHERE id = ?')
    .run(randomUUID(), f.all[3]!.id);
  expect(await f.repo.readyInbox(f.ctx)).toEqual([f.all[4]!]);
  await expect(
    f.repo.readyInbox({ ...f.ctx, installationId: 'foreign-installation' }),
  ).rejects.toThrow('DENIED');
  await expect(
    f.repo.readyInbox({ ...f.ctx, tenantId: randomUUID() }),
  ).rejects.toThrow('DENIED');
  await expect(f.repo.readyInbox(f.ctx, 'invalid-cursor')).rejects.toThrow(
    'INVALID',
  );
  f.h.sqlite
    .prepare('UPDATE monitoring_sources SET status = ? WHERE id = ?')
    .run('disabled', f.configured.sourceId);
  expect(await f.repo.readyInbox(f.ctx)).toEqual([]);
});

it('requires active/nonpending parent both before and within the final selection query', async () => {
  const f = await fixture(1);
  f.h.sqlite
    .prepare('UPDATE isp_tenants SET pending_mutation = ? WHERE id = ?')
    .run('{}', f.tenantId);
  await expect(f.repo.readyInbox(f.ctx)).rejects.toThrow('NOT_READY');
  f.h.sqlite
    .prepare(
      'UPDATE isp_tenants SET pending_mutation = NULL, status = ? WHERE id = ?',
    )
    .run('suspended', f.tenantId);
  await expect(f.repo.readyInbox(f.ctx)).rejects.toThrow('DENIED');
  f.h.sqlite
    .prepare('UPDATE isp_tenants SET status = ? WHERE id = ?')
    .run('active', f.tenantId);
  const interleaving: SqlDriver = {
    write: f.h.db.write,
    rows: async <T>(
      query: string,
      params: Parameters<SqlDriver['write']>[1],
    ) => {
      if (query.startsWith('SELECT b.id FROM monitoring_inbox'))
        f.h.sqlite
          .prepare('UPDATE isp_tenants SET pending_mutation = ? WHERE id = ?')
          .run('{}', f.tenantId);
      return f.h.db.rows<T>(query, params);
    },
  };
  expect(
    await new SqlIncidentRepository(interleaving).readyInbox(f.ctx),
  ).toEqual([]);
});
