// Local adapted SQLite simulation, not native Forge SQL/Jira acceptance.
import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { database } from '../support/sqlite';
import { monitoringMigrations } from '../../src/infrastructure/sql/monitoring-migrations';
import { incidentMigrations } from '../../src/infrastructure/sql/incident-migrations';
import {
  jsmMigrations,
  migrateJsm,
} from '../../src/infrastructure/sql/jsm-migrations';
import { SqlJsmRepository } from '../../src/infrastructure/sql/jsm-repository';
import type { SqlDriver } from '../../src/infrastructure/sql/driver';
import type { TenantContext } from '../../src/application/ports/tenant-context';
import type {
  JsmConfiguration,
  JsmIntent,
} from '../../src/application/jsm/contracts';
import { JsmCreationService } from '../../src/application/jsm/service';
import { request } from '../../src/application/jsm/validation';

const at = '2026-11-27T00:00:00.000Z';
const later = '2026-11-27T00:01:00.000Z';
it('rejects malformed or inconsistent impact rather than exporting misleading counts', async () => {
  const f = await fixture();
  const id = f.addIncident();
  const raw = f.sqlite
    .prepare('SELECT snapshot_json FROM incidents WHERE id = ?')
    .get(id) as { snapshot_json: string };
  const original = JSON.parse(raw.snapshot_json);
  const customer = randomUUID();
  for (const changed of [
    { ...original.impact, confidence: ['known'] },
    { ...original.impact, reason: 'private-reason' },
    {
      ...original.impact,
      affectedCustomerIds: [customer],
      potentiallyAffectedCustomerIds: [],
    },
    { ...original.impact, potentiallyAffectedServiceIds: [customer, customer] },
    { ...original.impact, affectedServiceIds: 'not-an-array' },
  ]) {
    f.sqlite
      .prepare('UPDATE incidents SET snapshot_json = ? WHERE id = ?')
      .run(JSON.stringify({ ...original, impact: changed }), id);
    await expect(f.repo.incident(f.ctx, id)).rejects.toThrow('INVALID');
  }
  expect(
    f.sqlite.prepare('SELECT COUNT(*) AS n FROM jsm_intents').get(),
  ).toMatchObject({ n: 0 });
});
async function fixture(migrate = true) {
  const h = database();
  const tenantId = await h.setup();
  const ctx: TenantContext = {
    installationId: h.session.installationId,
    tenantId,
    actor: { kind: 'system' },
  };
  const ddl = vi.fn(async (sql: string) => {
    h.sqlite.exec(
      sql
        .replace(/ CHARACTER SET utf8mb4 COLLATE utf8mb4_bin/g, '')
        .replace(/,\s*INDEX \w+ \([^)]*\)/g, '')
        .replace(/UNIQUE KEY \w+/g, 'UNIQUE'),
    );
  });
  for (const migration of [...monitoringMigrations, ...incidentMigrations])
    await ddl(migration.ddl);
  for (const [table, version] of [
    ['monitoring_schema_state', 2],
    ['incident_schema_state', 3],
  ] as const)
    h.sqlite
      .prepare(`INSERT INTO ${table} VALUES (?, ?, 1, '[]', ?)`)
      .run(ctx.installationId, version, at);
  const db: SqlDriver = {
    rows: h.db.rows,
    write: (q, p) =>
      h.db.write(
        q.replace(
          'ON DUPLICATE KEY UPDATE ready = 0',
          'ON CONFLICT (installation_id) DO UPDATE SET ready = 0',
        ),
        p,
      ),
  };
  let clock = at;
  const repo = new SqlJsmRepository(db, () => clock);
  const runMigration = () =>
    migrateJsm(db, ddl, ctx.installationId, () => clock);
  if (migrate) await runMigration();
  const config = (context = ctx, version = 1): JsmConfiguration => ({
    installationId: context.installationId,
    tenantId: context.tenantId,
    version,
    projectId: '10000',
    serviceDeskId: '1',
    requestTypeId: '2',
    fields: {
      marker: 'customfield_10001',
      deadline: 'customfield_10002',
      warning: 'customfield_10003',
      policy: 'customfield_10004',
    },
    priorityIds: { P1: '1', P2: '2', P3: '3' },
  });
  const policy = randomUUID();
  function addIncident(context = ctx, id: string = randomUUID()): string {
    const snapshot = {
      id,
      installationId: context.installationId,
      tenantId: context.tenantId,
      occurredAt: at,
      impact: {
        siteId: randomUUID(),
        uplinkId: randomUUID(),
        carrierId: randomUUID(),
        confidence: 'known',
        reason: 'COMPLETE',
        affectedCustomerIds: [],
        potentiallyAffectedCustomerIds: [],
        affectedServiceIds: [],
        potentiallyAffectedServiceIds: [],
      },
      sla: {
        kind: 'selected',
        snapshot: {
          policyId: policy,
          policyVersion: 1,
          priority: 'P1',
          warningAt: '2026-11-27T00:30:00.000Z',
          deadlineAt: '2026-11-27T01:00:00.000Z',
        },
      },
    };
    h.sqlite
      .prepare('INSERT INTO incidents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(
        context.installationId,
        context.tenantId,
        id,
        randomUUID(),
        '123',
        at,
        at,
        'new',
        1,
        JSON.stringify(snapshot),
      );
    return id;
  }
  async function intent(
    context = ctx,
    id: string = addIncident(context),
  ): Promise<JsmIntent> {
    const incident = (await repo.incident(context, id))!;
    const key = randomUUID(),
      marker = `light-house-${key}`;
    return {
      installationId: context.installationId,
      tenantId: context.tenantId,
      id: key,
      incidentId: id,
      marker,
      configuration: config(context),
      request: request(config(context), incident, marker),
      state: 'prepared',
      version: 1,
      attempts: 0,
      reconciliations: 0,
      dueAt: null,
      leaseUntil: null,
      issue: null,
      reason: null,
    };
  }
  return {
    ...h,
    ctx,
    repo,
    config,
    addIncident,
    intent,
    ddl,
    runMigration,
    setTime: (value: string) => {
      clock = value;
    },
  };
}

it('requires v3/v2/v1 readiness, resumes checkpointed v4 DDL without touching old readiness', async () => {
  const f = await fixture(false);
  await expect(f.repo.configuration(f.ctx)).rejects.toThrow('NOT_READY');
  f.sqlite.prepare('UPDATE monitoring_schema_state SET ready = 0').run();
  await expect(f.runMigration()).rejects.toThrow('NOT_READY');
  expect(
    f.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE name = 'jsm_schema_state'")
      .get(),
  ).toBeUndefined();
  f.sqlite.prepare('UPDATE monitoring_schema_state SET ready = 1').run();
  const original = f.ddl.getMockImplementation()!;
  let fail = true;
  f.ddl.mockImplementation(async (sql) => {
    if (sql.includes('CREATE TABLE IF NOT EXISTS jsm_intents') && fail) {
      fail = false;
      throw new Error('synthetic DDL interruption');
    }
    await original(sql);
  });
  await expect(f.runMigration()).rejects.toThrow('NOT_READY');
  expect(
    f.sqlite.prepare('SELECT ready, checkpoints FROM jsm_schema_state').get(),
  ).toMatchObject({
    ready: 0,
    checkpoints: JSON.stringify([jsmMigrations[1]!.name]),
  });
  f.ddl.mockClear();
  await f.runMigration();
  expect(f.ddl.mock.calls.map(([sql]) => sql)).not.toContain(
    jsmMigrations[1]!.ddl,
  );
  expect(
    f.sqlite
      .prepare('SELECT schema_version, ready FROM jsm_schema_state')
      .get(),
  ).toMatchObject({ schema_version: 4, ready: 1 });
  expect(
    f.sqlite
      .prepare('SELECT readiness, schema_version FROM installation_metadata')
      .get(),
  ).toMatchObject({ readiness: 'ready', schema_version: 1 });
  f.sqlite
    .prepare('UPDATE jsm_schema_state SET checkpoints = ?')
    .run('["foreign"]');
  await expect(f.runMigration()).rejects.toThrow('NOT_READY');
  expect(
    f.sqlite.prepare('SELECT ready FROM jsm_schema_state').get(),
  ).toMatchObject({ ready: 0 });
});

it('CAS-saves scoped config and denies pending, inactive, foreign-installation and foreign-tenant access', async () => {
  const f = await fixture();
  expect(await f.repo.configuration(f.ctx)).toBeNull();
  expect(await f.repo.saveConfiguration(f.ctx, f.config(), 0)).toBe(true);
  expect(await f.repo.saveConfiguration(f.ctx, f.config(), 0)).toBe(false);
  const competing = await Promise.all([
    f.repo.saveConfiguration(f.ctx, f.config(f.ctx, 2), 1),
    f.repo.saveConfiguration(
      f.ctx,
      { ...f.config(f.ctx, 2), requestTypeId: '3' },
      1,
    ),
  ]);
  expect(competing.filter(Boolean)).toHaveLength(1);
  expect((await f.repo.configuration(f.ctx))?.version).toBe(2);
  await expect(
    f.repo.saveConfiguration(f.ctx, f.config(f.ctx, 4), 2),
  ).rejects.toThrow('CONFLICT');
  await expect(
    f.repo.configuration({ ...f.ctx, tenantId: randomUUID() }),
  ).rejects.toThrow('NOT_READY');
  await expect(
    f.repo.configuration({ ...f.ctx, installationId: 'foreign-installation' }),
  ).rejects.toThrow('NOT_READY');
  await expect(
    f.repo.saveConfiguration(
      f.ctx,
      { ...f.config(), tenantId: randomUUID() },
      0,
    ),
  ).rejects.toThrow('DENIED');
  f.sqlite
    .prepare('UPDATE isp_tenants SET pending_mutation = ? WHERE id = ?')
    .run('{}', f.ctx.tenantId);
  await expect(
    f.repo.saveConfiguration(f.ctx, f.config(f.ctx, 3), 2),
  ).rejects.toThrow('NOT_READY');
  f.sqlite
    .prepare(
      'UPDATE isp_tenants SET pending_mutation = NULL, status = ? WHERE id = ?',
    )
    .run('retired', f.ctx.tenantId);
  await expect(f.repo.configuration(f.ctx)).rejects.toThrow('NOT_READY');
});

it('projects only selected immutable SLA and synthetic text; rejects corrupted snapshot binding', async () => {
  const f = await fixture();
  const id = f.addIncident();
  expect(await f.repo.incident(f.ctx, id)).toMatchObject({
    id,
    priority: 'P1',
    warningAt: '2026-11-27T00:30:00.000Z',
    deadlineAt: '2026-11-27T01:00:00.000Z',
  });
  expect(await f.repo.incident(f.ctx, randomUUID())).toBeNull();
  f.sqlite.prepare('UPDATE incidents SET snapshot_json = ? WHERE id = ?').run(
    JSON.stringify({
      id,
      installationId: f.ctx.installationId,
      tenantId: f.ctx.tenantId,
      sla: { kind: 'manual_triage' },
    }),
    id,
  );
  expect(await f.repo.incident(f.ctx, id)).toBeNull();
  f.sqlite.prepare('UPDATE incidents SET snapshot_json = ? WHERE id = ?').run(
    JSON.stringify({
      id,
      installationId: 'foreign',
      tenantId: f.ctx.tenantId,
    }),
    id,
  );
  await expect(f.repo.incident(f.ctx, id)).rejects.toThrow('DENIED');
  f.sqlite
    .prepare('UPDATE incidents SET snapshot_json = ? WHERE id = ?')
    .run('[]', id);
  await expect(f.repo.incident(f.ctx, id)).rejects.toThrow('INVALID');
});

it('ensures one intent concurrently and preserves original immutable configuration/request snapshots', async () => {
  const f = await fixture();
  const first = await f.intent();
  const second = await f.intent(f.ctx, first.incidentId);
  const results = await Promise.all([
    f.repo.ensure(f.ctx, first),
    f.repo.ensure(f.ctx, {
      ...second,
      configuration: { ...second.configuration, version: 2 },
    }),
  ]);
  expect(results[0]?.id).toBe(results[1]?.id);
  expect(results[1]?.configuration.version).toBe(1);
  expect(results[1]?.request).toEqual(first.request);
  expect(
    f.sqlite.prepare('SELECT COUNT(*) AS n FROM jsm_intents').get(),
  ).toMatchObject({ n: 1 });
  await expect(
    f.repo.ensure(f.ctx, {
      ...first,
      incidentId: randomUUID(),
      id: randomUUID(),
    }),
  ).rejects.toThrow('INVALID');
  await expect(
    f.repo.ensure(f.ctx, { ...first, tenantId: randomUUID() }),
  ).rejects.toThrow('DENIED');
  await expect(
    f.repo.ensure(f.ctx, {
      ...first,
      request: { ...first.request, serviceDeskId: '99' },
    }),
  ).rejects.toThrow('INVALID');
  await expect(
    f.repo.ensure(f.ctx, {
      ...first,
      request: {
        ...first.request,
        requestFieldValues: {
          ...first.request.requestFieldValues,
          forged: 'payload',
        },
      },
    }),
  ).rejects.toThrow('INVALID');
});

it('claims with optimistic fencing before dispatch, rejects live/old leases and permits only reconciliation after ambiguity', async () => {
  const f = await fixture();
  const intent = await f.repo.ensure(f.ctx, await f.intent());
  const token = randomUUID();
  const claims = await Promise.all([
    f.repo.claim(f.ctx, intent.id, 1, token, at, later, 'create'),
    f.repo.claim(f.ctx, intent.id, 1, randomUUID(), at, later, 'create'),
  ]);
  expect(claims.filter(Boolean)).toHaveLength(1);
  expect(claims[0]).toMatchObject({
    state: 'sending',
    attempts: 1,
    version: 2,
  });
  expect(
    await f.repo.claim(
      f.ctx,
      intent.id,
      2,
      randomUUID(),
      at,
      later,
      'reconcile',
    ),
  ).toBeNull();
  f.setTime(later);
  expect(
    await f.repo.settle(f.ctx, intent.id, token, {
      state: 'linked',
      issue: { id: '100', key: 'LH-1' },
      dueAt: null,
      reason: null,
    }),
  ).toBe(false);
  const recovery = randomUUID();
  expect(
    await f.repo.claim(
      f.ctx,
      intent.id,
      2,
      recovery,
      later,
      '2026-11-27T00:02:00.000Z',
      'create',
    ),
  ).toBeNull();
  expect(
    await f.repo.claim(
      f.ctx,
      intent.id,
      2,
      recovery,
      later,
      '2026-11-27T00:02:00.000Z',
      'reconcile',
    ),
  ).toMatchObject({ state: 'reconciling', attempts: 1, reconciliations: 1 });
  expect(
    await f.repo.settle(f.ctx, intent.id, token, {
      state: 'ambiguous',
      issue: null,
      dueAt: null,
      reason: 'AMBIGUOUS',
    }),
  ).toBe(false);
  expect(
    await f.repo.settle(f.ctx, intent.id, recovery, {
      state: 'linked',
      issue: { id: '100', key: 'LH-1' },
      dueAt: null,
      reason: null,
    }),
  ).toBe(true);
  expect(
    f.sqlite
      .prepare('SELECT state, issue_id, audit_json FROM jsm_intents')
      .get(),
  ).toMatchObject({
    state: 'linked',
    issue_id: '100',
    audit_json: expect.stringContaining('linked'),
  });
  expect(
    await f.repo.claim(
      f.ctx,
      intent.id,
      4,
      randomUUID(),
      later,
      '2026-11-27T00:02:00.000Z',
      'reconcile',
    ),
  ).toBeNull();
});

it('atomically rejects a Jira mapping reused by another tenant without settling its state or audit', async () => {
  const f = await fixture();
  const secondTenant = await f.service.bootstrap({
    name: 'Synthetic second ISP',
    slug: 'synthetic-second-isp',
  });
  const other: TenantContext = { ...f.ctx, tenantId: secondTenant.tenantId };
  const first = await f.repo.ensure(f.ctx, await f.intent());
  const second = await f.repo.ensure(other, await f.intent(other));
  const a = randomUUID(),
    b = randomUUID();
  await f.repo.claim(f.ctx, first.id, 1, a, at, later, 'create');
  await f.repo.claim(other, second.id, 1, b, at, later, 'create');
  const outcome = {
    state: 'linked' as const,
    issue: { id: '100', key: 'LH-1' },
    dueAt: null,
    reason: null,
  };
  expect(await f.repo.settle(f.ctx, first.id, a, outcome)).toBe(true);
  await expect(f.repo.settle(other, second.id, b, outcome)).rejects.toThrow(
    'CONFLICT',
  );
  expect(
    f.sqlite
      .prepare(
        'SELECT state, issue_id, audit_json FROM jsm_intents WHERE id = ?',
      )
      .get(second.id),
  ).toMatchObject({ state: 'sending', issue_id: null, audit_json: '[]' });
  expect(await f.repo.settle(f.ctx, second.id, b, outcome)).toBe(false);
});

it('persists ambiguity across service recreation and never issues a second POST for a zero-result search', async () => {
  const f = await fixture();
  await f.repo.saveConfiguration(f.ctx, f.config(), 0);
  const id = f.addIncident();
  const gateway = {
    verifyConfiguration: vi.fn(async () => true),
    create: vi.fn(async () => {
      expect(
        f.sqlite.prepare('SELECT state, attempts FROM jsm_intents').get(),
      ).toMatchObject({ state: 'sending', attempts: 1 });
      return { kind: 'AMBIGUOUS' as const };
    }),
    find: vi.fn(async () => ({ complete: true, issues: [] })),
  };
  const service = () =>
    new JsmCreationService({
      repository: new SqlJsmRepository(f.db, () => at),
      gateway,
      now: () => at,
      id: randomUUID,
      authoriseConfiguration: vi.fn(async () => undefined),
    });
  expect((await service().create(f.ctx, id)).state).toBe('ambiguous');
  expect((await service().create(f.ctx, id)).state).toBe('ambiguous');
  expect((await service().create(f.ctx, id)).state).toBe('ambiguous');
  expect((await service().create(f.ctx, id)).state).toBe('manual_review');
  expect(gateway.create).toHaveBeenCalledTimes(1);
  expect(gateway.find).toHaveBeenCalledTimes(3);
  expect(
    f.sqlite.prepare('SELECT attempts, reconciliations FROM jsm_intents').get(),
  ).toMatchObject({ attempts: 1, reconciliations: 3 });
});

it('respects retry due-time and bounds attempts while preserving a failed atomic settlement for reconciliation', async () => {
  const f = await fixture();
  const intent = await f.repo.ensure(f.ctx, await f.intent());
  const token = randomUUID();
  await f.repo.claim(f.ctx, intent.id, 1, token, at, later, 'create');
  await f.repo.settle(f.ctx, intent.id, token, {
    state: 'retry_wait',
    issue: null,
    dueAt: later,
    reason: 'RATE_LIMITED',
  });
  expect(
    await f.repo.claim(f.ctx, intent.id, 3, randomUUID(), at, later, 'create'),
  ).toBeNull();
  f.setTime(later);
  const next = randomUUID();
  expect(
    await f.repo.claim(
      f.ctx,
      intent.id,
      3,
      next,
      later,
      '2026-11-27T00:02:00.000Z',
      'create',
    ),
  ).toMatchObject({ attempts: 2 });
  f.failNext('UPDATE jsm_intents SET state');
  await expect(
    f.repo.settle(f.ctx, intent.id, next, {
      state: 'ambiguous',
      issue: null,
      dueAt: null,
      reason: 'AMBIGUOUS',
    }),
  ).rejects.toThrow('UNAVAILABLE');
  expect(
    f.sqlite.prepare('SELECT state, attempts FROM jsm_intents').get(),
  ).toMatchObject({ state: 'sending', attempts: 2 });
  await expect(
    f.repo.claim(f.ctx, intent.id, 4, randomUUID(), later, at, 'create'),
  ).rejects.toThrow('INVALID');
});

it('fails closed on malformed request fields, persisted states and changed SLA identity/times', async () => {
  const f = await fixture();
  const intent = await f.intent();
  for (const fields of [
    { ...intent.request.requestFieldValues, priority: { id: '99' } },
    {
      ...intent.request.requestFieldValues,
      [f.config().fields.warning]: '2026-11-27T02:00:00.000Z',
    },
    Object.fromEntries(
      Object.entries(intent.request.requestFieldValues).map(([key, value]) => [
        key === 'summary' ? 'forged' : key,
        value,
      ]),
    ),
  ])
    await expect(
      f.repo.ensure(f.ctx, {
        ...intent,
        request: { ...intent.request, requestFieldValues: fields },
      }),
    ).rejects.toThrow('INVALID');
  const saved = await f.repo.ensure(f.ctx, intent);
  f.sqlite
    .prepare('UPDATE jsm_intents SET state = ? WHERE id = ?')
    .run('foreign', saved.id);
  await expect(f.repo.ensure(f.ctx, intent)).rejects.toThrow('INVALID');
  const raw = f.sqlite
    .prepare('SELECT snapshot_json FROM incidents WHERE id = ?')
    .get(intent.incidentId) as { snapshot_json: string };
  const snapshot = JSON.parse(raw.snapshot_json);
  for (const changed of [
    { ...snapshot, id: randomUUID() },
    {
      ...snapshot,
      sla: {
        kind: 'selected',
        snapshot: { ...snapshot.sla.snapshot, priority: 'P0' },
      },
    },
    {
      ...snapshot,
      sla: {
        kind: 'selected',
        snapshot: {
          ...snapshot.sla.snapshot,
          warningAt: snapshot.sla.snapshot.deadlineAt,
        },
      },
    },
  ]) {
    f.sqlite
      .prepare('UPDATE incidents SET snapshot_json = ? WHERE id = ?')
      .run(JSON.stringify(changed), intent.incidentId);
    await expect(f.repo.incident(f.ctx, intent.incidentId)).rejects.toThrow();
  }
});

it('keeps ambiguous in-flight state on write failure or corrupt/oversized audit and rejects invalid mapping outcomes', async () => {
  const f = await fixture();
  f.failNext('INSERT INTO jsm_configuration');
  await expect(f.repo.saveConfiguration(f.ctx, f.config(), 0)).rejects.toThrow(
    'UNAVAILABLE',
  );
  const prepared = await f.intent();
  f.failNext('INSERT INTO jsm_intents');
  await expect(f.repo.ensure(f.ctx, prepared)).rejects.toThrow('UNAVAILABLE');
  const intent = await f.repo.ensure(f.ctx, prepared),
    token = randomUUID();
  await f.repo.claim(f.ctx, intent.id, 1, token, at, later, 'create');
  for (const audit of [
    'invalid-json',
    '{}',
    JSON.stringify(Array.from({ length: 17 }, () => ({}))),
    JSON.stringify([{ data: 'x'.repeat(4096) }]),
  ]) {
    f.sqlite
      .prepare('UPDATE jsm_intents SET audit_json = ? WHERE id = ?')
      .run(audit, intent.id);
    await expect(
      f.repo.settle(f.ctx, intent.id, token, {
        state: 'ambiguous',
        issue: null,
        dueAt: null,
        reason: 'AMBIGUOUS',
      }),
    ).rejects.toThrow('UNAVAILABLE');
    expect(
      f.sqlite.prepare('SELECT state, issue_id FROM jsm_intents').get(),
    ).toMatchObject({ state: 'sending', issue_id: null });
  }
  for (const result of [
    { state: 'linked' as const, issue: null, dueAt: null, reason: null },
    {
      state: 'linked' as const,
      issue: { id: '100', key: 'unexpected-key' },
      dueAt: null,
      reason: null,
    },
    {
      state: 'ambiguous' as const,
      issue: { id: '100', key: 'LH-1' },
      dueAt: null,
      reason: 'AMBIGUOUS' as const,
    },
  ])
    await expect(
      f.repo.settle(f.ctx, intent.id, token, result),
    ).rejects.toThrow('INVALID');
});
