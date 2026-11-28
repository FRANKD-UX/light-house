// Adapted SQLite with injected Jira gateway; not Forge/Jira/native enforcement acceptance.
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { database } from '../support/sqlite';
import monitoring from '../../src/infrastructure/sql/migrations.v002.json';
import incidents from '../../src/infrastructure/sql/migrations.v003.json';
import jsm from '../../src/infrastructure/sql/migrations.v004.json';
import operations from '../../src/infrastructure/sql/migrations.v005.json';
import transitions from '../../src/infrastructure/sql/migrations.v006.json';
import { SqlJsmTransitionRepository } from '../../src/infrastructure/sql/jsm-transition-repository';
import { NativeTransitionService } from '../../src/application/jsm-transitions/service';
import type {
  TransitionIntent,
  TransitionObservation,
  TransitionPlan,
  TransitionGateway,
} from '../../src/application/jsm-transitions/contracts';
import type { SqlDriver } from '../../src/infrastructure/sql/driver';
import type { TenantContext } from '../../src/application/ports/tenant-context';
const start = '2026-11-28T00:00:00.000Z';
async function fixture() {
  const h = database();
  const tenantId = await h.setup();
  for (const migration of [
    ...monitoring,
    ...incidents,
    ...jsm,
    ...operations,
    ...transitions,
  ])
    h.sqlite.exec(
      migration.ddl
        .replace(/ CHARACTER SET utf8mb4 COLLATE utf8mb4_bin/g, '')
        .replace(/,\s*INDEX \w+ \([^)]*\)/g, '')
        .replace(/UNIQUE KEY \w+/g, 'UNIQUE'),
    );
  for (const [table, version] of [
    ['monitoring_schema_state', 2],
    ['incident_schema_state', 3],
    ['jsm_schema_state', 4],
    ['operations_schema_state', 5],
    ['jsm_transition_schema_state', 6],
  ] as const)
    h.sqlite
      .prepare(`INSERT INTO ${table} VALUES (?, ?, 1, '[]', ?)`)
      .run(h.session.installationId, version, start);
  const ctx: TenantContext = {
    installationId: h.session.installationId,
    tenantId,
    actor: { kind: 'atlassian-user', accountId: h.session.accountId },
  };
  let clock = start,
    step = 0,
    beforeWrite: ((query: string) => void) | null = null;
  const db: SqlDriver = {
    rows: h.db.rows,
    write: async (query, params) => {
      beforeWrite?.(query);
      return h.db.write(query, params);
    },
  };
  const now = () => {
    const value = clock;
    if (step) clock = new Date(Date.parse(clock) + step).toISOString();
    return value;
  };
  const repository = new SqlJsmTransitionRepository(db, now);
  const incidentId = randomUUID();
  h.sqlite
    .prepare('INSERT INTO incidents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(
      ctx.installationId,
      tenantId,
      incidentId,
      randomUUID(),
      '100',
      start,
      start,
      'new',
      1,
      '{}',
    );
  const plan: TransitionPlan = {
    installationId: ctx.installationId,
    tenantId,
    accountId: h.session.accountId,
    incidentId,
    operation: 'resolve',
    expectedVersion: 7,
    factsVersion: 3,
    gateId: randomUUID(),
    mappingVersion: 2,
    issueId: '10000',
    projectId: '100',
    transitionId: '31',
    fromStatusId: '3',
    targetStatusId: '5',
    resolutionId: '1',
  };
  const review = randomUUID();
  const input = (change: Partial<TransitionIntent> = {}): TransitionIntent => ({
    id: randomUUID(),
    plan,
    enforcementReviewId: review,
    state: 'prepared',
    version: 1,
    attempts: 0,
    reconciliations: 0,
    leaseUntil: null,
    reason: null,
    postResponse: 'not-sent',
    observation: null,
    ...change,
  });
  const observed = (
    change: Partial<TransitionObservation> = {},
  ): TransitionObservation => ({
    issueId: plan.issueId,
    projectId: plan.projectId,
    statusId: plan.targetStatusId,
    causality: 'postcondition-only',
    observedAt: clock,
    ...change,
  });
  const gateway = {
    eligible: vi.fn<TransitionGateway['eligible']>(async () => true),
    post: vi.fn<TransitionGateway['post']>(async () => ({ kind: 'accepted' })),
    observe: vi.fn<TransitionGateway['observe']>(async () => observed()),
  };
  const service = new NativeTransitionService({
    repository,
    gateway,
    now,
    id: randomUUID,
    preflight: async () => ({
      plan,
      enforcement: {
        installationId: ctx.installationId,
        tenantId,
        projectId: plan.projectId,
        reviewId: review,
        verifiedAt: start,
        validUntil: '2026-11-28T01:00:00.000Z',
        kind: 'native-bypass-enforcement',
      },
    }),
  });
  const command = {
    incidentId,
    operation: plan.operation,
    expectedVersion: plan.expectedVersion,
  };
  return {
    ...h,
    inventoryService: h.service,
    ctx,
    repository,
    plan,
    review,
    input,
    observed,
    gateway,
    service,
    command,
    db,
    now,
    tick: (milliseconds: number) => {
      step = milliseconds;
    },
    until: () => new Date(Date.parse(clock) + 60000).toISOString(),
    setTime: (value: string) => {
      clock = value;
    },
    beforeWrite: (callback: typeof beforeWrite) => {
      beforeWrite = callback;
    },
  };
}
const ambiguous = {
  state: 'ambiguous' as const,
  reason: 'AMBIGUOUS' as const,
  postResponse: 'unknown' as const,
  observation: null,
};

describe('durable native transition intent SQL simulation', () => {
  it('interoperates with an advancing clock on the first service execution without a continuation replay', async () => {
    const f = await fixture();
    f.tick(100);
    expect(await f.service.execute(f.ctx, f.command)).toMatchObject({
      state: 'observed',
      nativeConfirmationAvailable: false,
    });
    expect(f.gateway.post).toHaveBeenCalledTimes(1);
    expect(await f.service.execute(f.ctx, f.command)).toMatchObject({
      state: 'observed',
      nativeConfirmationAvailable: false,
    });
    expect(f.gateway.post).toHaveBeenCalledTimes(1);
  });
  it('rejects forged initial lifecycle counters and cross-boundary observation fields', async () => {
    const f = await fixture();
    for (const change of [
      { attempts: 1 },
      { reconciliations: 1 },
      { version: 2 },
      { state: 'sending' as const },
      { leaseUntil: f.until() },
    ])
      await expect(f.repository.ensure(f.ctx, f.input(change))).rejects.toThrow(
        'INVALID',
      );
    expect(
      f.sqlite
        .prepare('SELECT COUNT(*) AS total FROM jsm_transition_intents')
        .get(),
    ).toMatchObject({ total: 0 });
  });

  it('stores one immutable plan/review per operation version, returning the existing winner without another write', async () => {
    const f = await fixture();
    const first = await f.repository.ensure(f.ctx, f.input());
    const statements = f.statements.length;
    const replay = await f.repository.ensure(f.ctx, f.input());
    expect(replay).toEqual(first);
    expect(
      f.statements.slice(statements).some((s) => s.query.startsWith('INSERT')),
    ).toBe(false);
    for (const change of [
      { plan: { ...f.plan, gateId: randomUUID() } },
      { plan: { ...f.plan, factsVersion: 4 } },
      { plan: { ...f.plan, transitionId: '32' } },
      { enforcementReviewId: randomUUID() },
    ])
      await expect(f.repository.ensure(f.ctx, f.input(change))).rejects.toThrow(
        'CONFLICT',
      );
    expect(
      f.sqlite
        .prepare('SELECT COUNT(*) AS total FROM jsm_transition_intents')
        .get(),
    ).toMatchObject({ total: 1 });
  });
  it('concurrent service executions produce one durable intent and at most one POST, never a NativeConfirmation', async () => {
    const f = await fixture();
    const results = await Promise.all([
      f.service.execute(f.ctx, f.command),
      f.service.execute(f.ctx, f.command),
    ]);
    expect(results.some((r) => r.state === 'observed')).toBe(true);
    expect(results.every((r) => r.nativeConfirmationAvailable === false)).toBe(
      true,
    );
    expect(f.gateway.post).toHaveBeenCalledTimes(1);
    expect(
      f.sqlite
        .prepare('SELECT state, attempts FROM jsm_transition_intents')
        .get(),
    ).toMatchObject({ state: 'observed', attempts: 1 });
    const writes = f.statements.filter((s) =>
      /^(INSERT|UPDATE)/.test(s.query),
    ).length;
    expect(await f.service.execute(f.ctx, f.command)).toMatchObject({
      state: 'observed',
      nativeConfirmationAvailable: false,
    });
    expect(
      f.statements.filter((s) => /^(INSERT|UPDATE)/.test(s.query)),
    ).toHaveLength(writes);
    expect(f.gateway.post).toHaveBeenCalledTimes(1);
  });
  it('reconciles uncertainty through GET observation without resending the transition', async () => {
    const f = await fixture();
    f.gateway.post.mockResolvedValueOnce({ kind: 'ambiguous' });
    f.gateway.observe.mockResolvedValueOnce(null);
    expect(await f.service.execute(f.ctx, f.command)).toMatchObject({
      state: 'ambiguous',
      observation: null,
    });
    expect(await f.service.execute(f.ctx, f.command)).toMatchObject({
      state: 'observed',
      observation: { causality: 'postcondition-only' },
      nativeConfirmationAvailable: false,
    });
    expect(f.gateway.post).toHaveBeenCalledTimes(1);
    expect(f.gateway.observe).toHaveBeenCalledTimes(2);
    expect(
      f.sqlite
        .prepare('SELECT attempts, reconciliations FROM jsm_transition_intents')
        .get(),
    ).toMatchObject({ attempts: 1, reconciliations: 1 });
  });
  it('claims sending once before side effects and fences expired senders after reconciliation claims', async () => {
    const f = await fixture();
    const first = await f.repository.ensure(f.ctx, f.input()),
      oldToken = randomUUID();
    const sending = (await f.repository.claim(
      f.ctx,
      first.id,
      first.version,
      oldToken,
      f.now(),
      f.until(),
      'send',
    ))!;
    expect(sending).toMatchObject({
      state: 'sending',
      attempts: 1,
      version: 2,
    });
    expect(
      await f.repository.claim(
        f.ctx,
        first.id,
        sending.version,
        randomUUID(),
        f.now(),
        f.until(),
        'send',
      ),
    ).toBe(null);
    expect(
      await f.repository.claim(
        f.ctx,
        first.id,
        sending.version,
        randomUUID(),
        f.now(),
        f.until(),
        'reconcile',
      ),
    ).toBe(null);
    f.setTime('2026-11-28T00:01:01.000Z');
    const token = randomUUID();
    const reconciling = (await f.repository.claim(
      f.ctx,
      first.id,
      sending.version,
      token,
      f.now(),
      f.until(),
      'reconcile',
    ))!;
    expect(reconciling).toMatchObject({
      state: 'reconciling',
      attempts: 1,
      reconciliations: 1,
      version: 3,
    });
    expect(
      await f.repository.settle(f.ctx, first.id, oldToken, ambiguous),
    ).toBe(false);
    expect(
      await f.repository.settle(f.ctx, first.id, token, {
        state: 'observed',
        reason: null,
        postResponse: 'unknown',
        observation: f.observed(),
      }),
    ).toBe(true);
    expect(await f.repository.settle(f.ctx, first.id, token, ambiguous)).toBe(
      false,
    );
  });
  it('limits reconciliation to three claims and persists bounded allowlisted audit fields', async () => {
    const f = await fixture();
    let current = await f.repository.ensure(f.ctx, f.input());
    let token = randomUUID();
    current = (await f.repository.claim(
      f.ctx,
      current.id,
      current.version,
      token,
      f.now(),
      f.until(),
      'send',
    ))!;
    expect(await f.repository.settle(f.ctx, current.id, token, ambiguous)).toBe(
      true,
    );
    for (let attempt = 1; attempt <= 3; attempt++) {
      const row = f.sqlite
        .prepare('SELECT version FROM jsm_transition_intents')
        .get() as { version: number };
      token = randomUUID();
      current = (await f.repository.claim(
        f.ctx,
        current.id,
        row.version,
        token,
        f.now(),
        f.until(),
        'reconcile',
      ))!;
      expect(current.reconciliations).toBe(attempt);
      expect(
        await f.repository.settle(f.ctx, current.id, token, ambiguous),
      ).toBe(true);
    }
    const row = f.sqlite
      .prepare('SELECT version, audit_json FROM jsm_transition_intents')
      .get() as { version: number; audit_json: string };
    expect(
      await f.repository.claim(
        f.ctx,
        current.id,
        row.version,
        randomUUID(),
        f.now(),
        f.until(),
        'reconcile',
      ),
    ).toBe(null);
    const audit = JSON.parse(row.audit_json) as Record<string, unknown>[];
    expect(audit.length).toBeLessThanOrEqual(16);
    expect(Buffer.byteLength(row.audit_json)).toBeLessThanOrEqual(4096);
    expect(
      audit.every(
        (entry) =>
          Object.keys(entry).sort().join(',') ===
          'at,attempts,kind,reconciliations,version',
      ),
    ).toBe(true);
    expect(row.audit_json).not.toContain(f.plan.accountId);
    expect(row.audit_json).not.toContain(token);
  });
  it('rejects foreign tenant/installation/account plans and nonuser actors, without crossing stored identity', async () => {
    const f = await fixture();
    const first = await f.repository.ensure(f.ctx, f.input());
    await expect(
      f.repository.ensure(
        f.ctx,
        f.input({ plan: { ...f.plan, tenantId: randomUUID() } }),
      ),
    ).rejects.toThrow('DENIED');
    await expect(
      f.repository.ensure({ ...f.ctx, actor: { kind: 'system' } }, f.input()),
    ).rejects.toThrow('DENIED');
    await expect(
      f.repository.claim(
        { ...f.ctx, installationId: 'foreign-installation' },
        first.id,
        1,
        randomUUID(),
        f.now(),
        f.until(),
        'send',
      ),
    ).rejects.toThrow('NOT_READY');
    const foreign = (
      await f.inventoryService.bootstrap({
        name: 'Synthetic foreign ISP',
        slug: 'transition-foreign',
      })
    ).tenantId;
    const foreignCtx = { ...f.ctx, tenantId: foreign };
    expect(
      await f.repository.claim(
        foreignCtx,
        first.id,
        1,
        randomUUID(),
        f.now(),
        f.until(),
        'send',
      ),
    ).toBe(null);
    expect(
      await f.repository.settle(foreignCtx, first.id, randomUUID(), ambiguous),
    ).toBe(false);
    await expect(
      f.repository.ensure(
        foreignCtx,
        f.input({ plan: { ...f.plan, tenantId: foreign } }),
      ),
    ).rejects.toThrow('CONFLICT');
    const account = 'synthetic-other-operator';
    await f.inventoryService.grant({
      tenantId: f.ctx.tenantId,
      accountId: account,
      role: 'operator',
      expiresAt: null,
      expected: null,
      status: 'active',
    });
    const otherCtx = {
      ...f.ctx,
      actor: { kind: 'atlassian-user' as const, accountId: account },
    };
    expect(
      await f.repository.claim(
        otherCtx,
        first.id,
        1,
        randomUUID(),
        f.now(),
        f.until(),
        'send',
      ),
    ).toBe(null);
    await expect(
      f.repository.ensure(
        otherCtx,
        f.input({ plan: { ...f.plan, accountId: account } }),
      ),
    ).rejects.toThrow('DENIED');
  });
  it('fences parent/actor revocation and lease/version changes racing before claim or settlement', async () => {
    const f = await fixture();
    const first = await f.repository.ensure(f.ctx, f.input());
    let changed = false;
    f.beforeWrite((query) => {
      if (!changed && query.startsWith('UPDATE jsm_transition_intents')) {
        changed = true;
        f.sqlite
          .prepare(
            'UPDATE tenant_memberships SET expires_at = ? WHERE tenant_id = ? AND account_id = ?',
          )
          .run(f.now(), f.ctx.tenantId, f.plan.accountId);
      }
    });
    expect(
      await f.repository.claim(
        f.ctx,
        first.id,
        1,
        randomUUID(),
        f.now(),
        f.until(),
        'send',
      ),
    ).toBe(null);
    f.beforeWrite(null);
    f.sqlite.prepare('UPDATE tenant_memberships SET expires_at = NULL').run();
    const token = randomUUID();
    const sending = (await f.repository.claim(
      f.ctx,
      first.id,
      1,
      token,
      f.now(),
      f.until(),
      'send',
    ))!;
    f.beforeWrite((query) => {
      if (query.startsWith('UPDATE jsm_transition_intents')) {
        f.beforeWrite(null);
        f.sqlite
          .prepare(
            'UPDATE jsm_transition_intents SET version = version + 1, lease_token = ? WHERE id = ?',
          )
          .run(randomUUID(), first.id);
      }
    });
    expect(await f.repository.settle(f.ctx, first.id, token, ambiguous)).toBe(
      false,
    );
    expect(sending.attempts).toBe(1);
  });
  it('validates observations and rejects stale/future/wrong-issue evidence before durable settlement', async () => {
    const f = await fixture();
    const first = await f.repository.ensure(f.ctx, f.input()),
      token = randomUUID();
    await f.repository.claim(
      f.ctx,
      first.id,
      1,
      token,
      f.now(),
      f.until(),
      'send',
    );
    for (const invalid of [
      f.observed({ issueId: '999' }),
      f.observed({ projectId: '999' }),
    ])
      await expect(
        f.repository.settle(f.ctx, first.id, token, {
          state: 'observed',
          reason: null,
          postResponse: 'accepted',
          observation: invalid,
        }),
      ).rejects.toThrow('DENIED');
    for (const invalid of [
      f.observed({ observedAt: '2026-11-28T00:00:00.001Z' }),
      f.observed({ observedAt: '2026-11-27T23:59:59.999Z' }),
      f.observed({ statusId: f.plan.fromStatusId }),
    ])
      await expect(
        f.repository.settle(f.ctx, first.id, token, {
          state: 'observed',
          reason: null,
          postResponse: 'accepted',
          observation: invalid,
        }),
      ).rejects.toThrow('INVALID');
    expect(
      await f.repository.settle(f.ctx, first.id, token, {
        state: 'manual_review',
        reason: 'PERMISSION',
        postResponse: 'rejected',
        observation: null,
      }),
    ).toBe(true);
  });
  it('fails closed on missing readiness, pending parent, malformed audit and unbounded leases', async () => {
    const f = await fixture();
    f.sqlite.prepare('UPDATE jsm_transition_schema_state SET ready = 0').run();
    await expect(f.repository.ensure(f.ctx, f.input())).rejects.toThrow(
      'NOT_READY',
    );
    f.sqlite.prepare('UPDATE jsm_transition_schema_state SET ready = 1').run();
    f.sqlite
      .prepare('UPDATE isp_tenants SET pending_mutation = ? WHERE id = ?')
      .run('synthetic pending', f.ctx.tenantId);
    await expect(f.repository.ensure(f.ctx, f.input())).rejects.toThrow(
      'DENIED',
    );
    f.sqlite.prepare('UPDATE isp_tenants SET pending_mutation = NULL').run();
    const first = await f.repository.ensure(f.ctx, f.input());
    await expect(
      f.repository.claim(
        f.ctx,
        first.id,
        1,
        randomUUID(),
        f.now(),
        '2026-11-28T00:01:00.001Z',
        'send',
      ),
    ).rejects.toThrow('INVALID');
    f.sqlite
      .prepare('UPDATE jsm_transition_intents SET audit_json = ?')
      .run('[{"untrusted":"synthetic-private"}]');
    await expect(
      f.repository.claim(
        f.ctx,
        first.id,
        1,
        randomUUID(),
        f.now(),
        f.until(),
        'send',
      ),
    ).rejects.toThrow('INVALID');
  });
});
