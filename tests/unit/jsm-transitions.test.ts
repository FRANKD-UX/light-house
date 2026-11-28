// Synthetic durable-port simulation, not Forge SQL, Jira transition or native bypass evidence.
import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { NativeTransitionService } from '../../src/application/jsm-transitions/service';
import {
  TransitionError,
  type TransitionDependencies,
  type TransitionIntent,
  type TransitionPlan,
  type EnforcementEvidence,
  type TransitionGateway,
  type TransitionObservation,
  type TransitionRepository,
} from '../../src/application/jsm-transitions/contracts';
import type { TenantContext } from '../../src/application/ports/tenant-context';

function fixture() {
  let now = '2026-11-28T00:00:00.000Z',
    row: TransitionIntent | null = null,
    lease: string | null = null;
  const ctx: TenantContext = {
    installationId: 'synthetic-installation',
    tenantId: randomUUID(),
    actor: { kind: 'atlassian-user', accountId: 'synthetic-user' },
  };
  const command = {
    incidentId: randomUUID(),
    operation: 'resolve' as const,
    expectedVersion: 5,
  };
  const plan: TransitionPlan = {
    ...command,
    installationId: ctx.installationId,
    tenantId: ctx.tenantId,
    accountId: 'synthetic-user',
    factsVersion: 1,
    gateId: randomUUID(),
    mappingVersion: 1,
    issueId: '10000',
    projectId: '20000',
    transitionId: '31',
    fromStatusId: '1',
    targetStatusId: '5',
    resolutionId: null,
  };
  const enforcement: EnforcementEvidence = {
    installationId: ctx.installationId,
    tenantId: ctx.tenantId,
    projectId: plan.projectId,
    reviewId: randomUUID(),
    verifiedAt: '2026-11-27T00:00:00.000Z',
    validUntil: '2026-11-29T00:00:00.000Z',
    kind: 'native-bypass-enforcement',
  };
  const observation = (): TransitionObservation => ({
    issueId: plan.issueId,
    projectId: plan.projectId,
    statusId: plan.targetStatusId,
    observedAt: now,
    causality: 'postcondition-only',
  });
  const repository = {
    ensure: vi.fn<TransitionRepository['ensure']>(async (_ctx, candidate) => {
      row ??= structuredClone(candidate);
      return structuredClone(row);
    }),
    claim: vi.fn<TransitionRepository['claim']>(
      async (_ctx, id, expected, token, at, until, mode) => {
        if (
          !row ||
          row.id !== id ||
          row.version !== expected ||
          (row.leaseUntil !== null && row.leaseUntil > at) ||
          ['observed', 'manual_review'].includes(row.state)
        )
          return null;
        if (
          (mode === 'send' &&
            (row.state !== 'prepared' || row.attempts !== 0)) ||
          (mode === 'reconcile' && row.reconciliations >= 3)
        )
          return null;
        lease = token;
        row = {
          ...row,
          state: mode === 'send' ? 'sending' : 'reconciling',
          version: row.version + 1,
          attempts: row.attempts + (mode === 'send' ? 1 : 0),
          reconciliations: row.reconciliations + (mode === 'reconcile' ? 1 : 0),
          leaseUntil: until,
        };
        return structuredClone(row);
      },
    ),
    settle: vi.fn<TransitionRepository['settle']>(
      async (_ctx, id, token, result) => {
        if (
          !row ||
          row.id !== id ||
          lease !== token ||
          row.leaseUntil === null ||
          row.leaseUntil <= now
        )
          return false;
        row = {
          ...row,
          ...structuredClone(result),
          version: row.version + 1,
          leaseUntil: null,
        };
        lease = null;
        return true;
      },
    ),
  };
  const gateway = {
    eligible: vi.fn<TransitionGateway['eligible']>(async () => true),
    post: vi.fn<TransitionGateway['post']>(async () => ({ kind: 'accepted' })),
    observe: vi.fn<TransitionGateway['observe']>(async () => observation()),
  };
  const deps: TransitionDependencies = {
    repository,
    gateway,
    preflight: vi.fn(async () => ({ plan, enforcement })),
    now: () => now,
    id: randomUUID,
  };
  const service = new NativeTransitionService(deps);
  return {
    ctx,
    command,
    plan,
    enforcement,
    observation,
    repository,
    gateway,
    deps,
    service,
    setTime: (at: string) => {
      now = at;
    },
    get row() {
      return row;
    },
    setRow: (value: TransitionIntent) => {
      row = value;
    },
  };
}

it('durably claims before POST, rechecks trusted preflight, observes exact postcondition and never calls it causal confirmation', async () => {
  const f = fixture();
  f.gateway.post.mockImplementation(async () => {
    expect(f.row).toMatchObject({ state: 'sending', attempts: 1, version: 2 });
    return { kind: 'accepted' };
  });
  const result = await f.service.execute(f.ctx, f.command);
  expect(result).toMatchObject({
    state: 'observed',
    observation: {
      issueId: f.plan.issueId,
      statusId: f.plan.targetStatusId,
      causality: 'postcondition-only',
    },
    nativeConfirmationAvailable: false,
  });
  expect(f.deps.preflight).toHaveBeenCalledTimes(2);
  expect(f.row).toMatchObject({
    state: 'observed',
    postResponse: 'accepted',
    attempts: 1,
  });
  expect(await f.service.execute(f.ctx, f.command)).toEqual(result);
  expect(f.gateway.post).toHaveBeenCalledTimes(1);
});

it('concurrent resolver commands share one immutable intent and one POST', async () => {
  const f = fixture();
  const results = await Promise.all(
    Array.from({ length: 6 }, () => f.service.execute(f.ctx, f.command)),
  );
  expect(new Set(results.map((value) => value.intentId)).size).toBe(1);
  expect(results.some((value) => value.state === 'observed')).toBe(true);
  expect(f.gateway.post).toHaveBeenCalledTimes(1);
  expect(f.repository.ensure).toHaveBeenCalledTimes(6);
});

it('lost/ambiguous POST responses reconcile stored intent without any second POST', async () => {
  const f = fixture();
  f.gateway.post.mockRejectedValueOnce(
    new Error('Bearer SYNTHETIC-PRIVATE-ERROR'),
  );
  f.gateway.observe.mockResolvedValueOnce(null);
  expect(await f.service.execute(f.ctx, f.command)).toMatchObject({
    state: 'ambiguous',
    observation: null,
    nativeConfirmationAvailable: false,
  });
  expect(f.row?.postResponse).toBe('unknown');
  const result = await f.service.execute(f.ctx, f.command);
  expect(result.state).toBe('observed');
  expect(JSON.stringify(result)).not.toContain('SYNTHETIC-PRIVATE');
  expect(f.gateway.post).toHaveBeenCalledTimes(1);
  expect(f.row?.reconciliations).toBe(1);
});

it('three incomplete reconciliations end in manual review and never authorize a replayed POST', async () => {
  const f = fixture();
  f.gateway.observe.mockResolvedValue(null);
  expect((await f.service.execute(f.ctx, f.command)).state).toBe('ambiguous');
  expect((await f.service.execute(f.ctx, f.command)).state).toBe('ambiguous');
  expect((await f.service.execute(f.ctx, f.command)).state).toBe('ambiguous');
  expect((await f.service.execute(f.ctx, f.command)).state).toBe(
    'manual_review',
  );
  expect((await f.service.execute(f.ctx, f.command)).state).toBe(
    'manual_review',
  );
  expect(f.gateway.post).toHaveBeenCalledTimes(1);
  expect(f.row).toMatchObject({
    attempts: 1,
    reconciliations: 3,
    reason: 'POSTCONDITION_UNAVAILABLE',
  });
});

it('does not POST after eligibility consumed the lease; expired sending can only reconcile', async () => {
  const f = fixture();
  f.gateway.eligible.mockImplementationOnce(async () => {
    f.setTime('2026-11-28T00:01:00.000Z');
    return true;
  });
  await expect(f.service.execute(f.ctx, f.command)).rejects.toThrow('CONFLICT');
  expect(f.gateway.post).not.toHaveBeenCalled();
  expect((await f.service.execute(f.ctx, f.command)).state).toBe('observed');
  expect(f.gateway.post).not.toHaveBeenCalled();
  expect(f.row?.reconciliations).toBe(1);
});

it('late success and failed settlement remain fenced then reconcile without claiming exact causality', async () => {
  const f = fixture();
  f.gateway.post.mockImplementationOnce(async () => {
    f.setTime('2026-11-28T00:01:01.000Z');
    return { kind: 'accepted' };
  });
  expect(await f.service.execute(f.ctx, f.command)).toMatchObject({
    state: 'pending',
    observation: null,
    nativeConfirmationAvailable: false,
  });
  expect(f.row?.state).toBe('sending');
  expect((await f.service.execute(f.ctx, f.command)).state).toBe('observed');
  expect(f.gateway.post).toHaveBeenCalledTimes(1);
  const lost = fixture();
  lost.repository.settle.mockRejectedValueOnce(new Error('private SQL error'));
  await expect(lost.service.execute(lost.ctx, lost.command)).rejects.toThrow(
    'UNAVAILABLE',
  );
  expect((await lost.service.execute(lost.ctx, lost.command)).state).toBe(
    'pending',
  );
  lost.setTime('2026-11-28T00:01:01.000Z');
  expect((await lost.service.execute(lost.ctx, lost.command)).state).toBe(
    'observed',
  );
  expect(lost.gateway.post).toHaveBeenCalledTimes(1);
});

it.each(['PERMISSION', 'CONFIGURATION', 'RATE_LIMITED'] as const)(
  'explicit %s rejection remains manual review without automatic POST retries',
  async (reason) => {
    const f = fixture();
    f.gateway.post.mockResolvedValue({ kind: 'rejected', reason });
    expect((await f.service.execute(f.ctx, f.command)).state).toBe(
      'manual_review',
    );
    expect(f.row).toMatchObject({ reason, postResponse: 'rejected' });
    expect((await f.service.execute(f.ctx, f.command)).state).toBe(
      'manual_review',
    );
    expect(f.gateway.post).toHaveBeenCalledTimes(1);
    expect(f.gateway.observe).not.toHaveBeenCalled();
  },
);

it('missing native enforcement proof, expired reviews and foreign proof scope fail before durable/HTTP work', async () => {
  const f = fixture();
  const preflight = vi.mocked(f.deps.preflight);
  preflight.mockResolvedValueOnce({ plan: f.plan, enforcement: null });
  await expect(f.service.execute(f.ctx, f.command)).rejects.toThrow(
    'NOT_READY',
  );
  for (const evidence of [
    { ...f.enforcement, validUntil: '2026-11-28T00:00:00.000Z' },
    { ...f.enforcement, verifiedAt: '2026-12-01T00:00:00.000Z' },
  ]) {
    preflight.mockResolvedValueOnce({ plan: f.plan, enforcement: evidence });
    await expect(f.service.execute(f.ctx, f.command)).rejects.toThrow(
      'NOT_READY',
    );
  }
  preflight.mockResolvedValueOnce({
    plan: f.plan,
    enforcement: { ...f.enforcement, tenantId: randomUUID() },
  });
  await expect(f.service.execute(f.ctx, f.command)).rejects.toThrow('DENIED');
  expect(f.repository.ensure).not.toHaveBeenCalled();
  expect(f.gateway.post).not.toHaveBeenCalled();
});

it('strictly validates client input and rejects source/system and foreign actor/plan bindings', async () => {
  const f = fixture();
  for (const input of [
    null,
    [],
    { ...f.command, targetStatusId: '5' },
    { ...f.command, operation: ['resolve'] },
    { ...f.command, expectedVersion: '5' },
    { ...f.command, expectedVersion: [5] },
  ])
    await expect(f.service.execute(f.ctx, input)).rejects.toThrow('INVALID');
  for (const actor of [
    { kind: 'system' as const },
    { kind: 'monitoring-source' as const, sourceId: randomUUID() },
  ])
    await expect(
      f.service.execute({ ...f.ctx, actor }, f.command),
    ).rejects.toThrow('DENIED');
  for (const plan of [
    { ...f.plan, tenantId: randomUUID() },
    { ...f.plan, installationId: 'foreign' },
    { ...f.plan, accountId: 'foreign-user' },
  ]) {
    vi.mocked(f.deps.preflight).mockResolvedValueOnce({
      plan,
      enforcement: f.enforcement,
    });
    await expect(f.service.execute(f.ctx, f.command)).rejects.toThrow('DENIED');
  }
  expect(f.gateway.post).not.toHaveBeenCalled();
});

it('fresh facts/mapping drift after eligibility prevents POST and cannot rewrite the saved plan', async () => {
  const f = fixture();
  vi.mocked(f.deps.preflight)
    .mockResolvedValueOnce({ plan: f.plan, enforcement: f.enforcement })
    .mockResolvedValueOnce({
      plan: { ...f.plan, factsVersion: 2 },
      enforcement: f.enforcement,
    });
  await expect(f.service.execute(f.ctx, f.command)).rejects.toThrow('CONFLICT');
  expect(f.gateway.post).not.toHaveBeenCalled();
  expect(f.row?.plan.factsVersion).toBe(1);
  vi.mocked(f.deps.preflight).mockResolvedValueOnce({
    plan: { ...f.plan, mappingVersion: 2 },
    enforcement: f.enforcement,
  });
  await expect(f.service.execute(f.ctx, f.command)).rejects.toThrow('CONFLICT');
});

it('unavailable eligibility never sends and untrusted postcondition observations never become confirmations', async () => {
  const f = fixture();
  f.gateway.eligible.mockRejectedValueOnce(
    new Error('private transport failure'),
  );
  expect((await f.service.execute(f.ctx, f.command)).state).toBe(
    'manual_review',
  );
  expect(f.gateway.post).not.toHaveBeenCalled();
  for (const change of [
    { issueId: '99999' },
    { projectId: '99999' },
    { observedAt: '2099-01-01T00:00:00.000Z' },
    { statusId: '3' },
  ]) {
    const other = fixture();
    other.gateway.observe.mockResolvedValue({
      ...other.observation(),
      ...change,
    });
    expect(await other.service.execute(other.ctx, other.command)).toMatchObject(
      {
        state: 'ambiguous',
        observation: null,
        nativeConfirmationAvailable: false,
      },
    );
  }
});

it('rejects forged claim identity/version before HTTP and sanitizes unexpected preflight failures', async () => {
  const f = fixture();
  const original = f.repository.claim.getMockImplementation()!;
  f.repository.claim.mockImplementationOnce(async (...args) => {
    const value = (await original(...args))!;
    return { ...value, id: randomUUID() };
  });
  await expect(f.service.execute(f.ctx, f.command)).rejects.toThrow('CONFLICT');
  expect(f.gateway.post).not.toHaveBeenCalled();
  const unavailable = fixture();
  vi.mocked(unavailable.deps.preflight).mockRejectedValueOnce(
    new Error('SYNTHETIC-PRIVATE'),
  );
  await expect(
    unavailable.service.execute(unavailable.ctx, unavailable.command),
  ).rejects.toEqual(new TransitionError('UNAVAILABLE'));
});
