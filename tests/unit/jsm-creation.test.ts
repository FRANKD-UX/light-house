import { describe, expect, it, vi } from 'vitest';
import { JsmCreationService } from '../../src/application/jsm/service';
import {
  configuration,
  identifier,
  request,
} from '../../src/application/jsm/validation';
import type {
  JsmConfiguration,
  JsmDependencies,
  JsmIntent,
  JsmRepository,
} from '../../src/application/jsm/contracts';
import type { TenantContext } from '../../src/application/ports/tenant-context';
const tenantId = '11111111-1111-4111-8111-111111111111';
const incidentId = '22222222-2222-4222-8222-222222222222';
const ctx: TenantContext = {
  installationId: 'synthetic-installation',
  tenantId,
  actor: { kind: 'system' },
};
const config: JsmConfiguration = {
  installationId: ctx.installationId,
  tenantId,
  version: 1,
  projectId: '10',
  serviceDeskId: '20',
  requestTypeId: '30',
  fields: {
    marker: 'customfield_101',
    deadline: 'customfield_102',
    warning: 'customfield_103',
    policy: 'customfield_104',
  },
  priorityIds: { P1: '1', P2: '2', P3: '3' },
};
function setup() {
  let now = '2026-11-27T00:00:00.000Z';
  let sequence = 0;
  let row: JsmIntent | null = null;
  let token = '';
  const incident = {
    installationId: ctx.installationId,
    tenantId,
    id: incidentId,
    summary: 'Synthetic outage',
    description: 'Synthetic uplink and aggregate impact only.',
    priority: 'P1' as const,
    warningAt: '2026-11-27T00:45:00.000Z',
    deadlineAt: '2026-11-27T01:00:00.000Z',
    policyVersionId: '33333333-3333-4333-8333-333333333333',
  };
  const repository: JsmRepository = {
    incident: vi.fn(async () => incident),
    configuration: vi.fn(async () => config),
    saveConfiguration: vi.fn(async () => true),
    ensure: vi.fn(async (_ctx, next) => row ?? (row = next)),
    claim: vi.fn(async (_ctx, id, expected, claimToken, at, until, mode) => {
      if (
        !row ||
        row.id !== id ||
        row.version !== expected ||
        (row.leaseUntil && row.leaseUntil > at)
      )
        return null;
      token = claimToken;
      row = {
        ...row,
        state: mode === 'create' ? 'sending' : 'reconciling',
        version: row.version + 1,
        leaseUntil: until,
        attempts: row.attempts + (mode === 'create' ? 1 : 0),
        reconciliations: row.reconciliations + (mode === 'reconcile' ? 1 : 0),
      };
      return row;
    }),
    settle: vi.fn(async (_ctx, id, claimToken, value) => {
      if (!row || row.id !== id || token !== claimToken) return false;
      row = { ...row, ...value, version: row.version + 1, leaseUntil: null };
      return true;
    }),
  };
  const deps: JsmDependencies = {
    repository,
    gateway: {
      verifyConfiguration: vi.fn(async () => true),
      create: vi.fn(async () => ({
        kind: 'created' as const,
        issue: { id: '100', key: 'SYN-1' },
      })),
      find: vi.fn(async () => ({ complete: true, issues: [] })),
    },
    now: () => now,
    id: () =>
      `${String(++sequence).padStart(8, '0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
    authoriseConfiguration: vi.fn(async () => {}),
  };
  return {
    deps,
    repository,
    incident,
    service: new JsmCreationService(deps),
    get row() {
      return row;
    },
    set(value: Partial<JsmIntent>) {
      row = { ...row!, ...value };
    },
    advance() {
      now = '2026-11-27T02:00:00.000Z';
    },
  };
}
describe('JSM creation application contract — synthetic repository/gateway', () => {
  it('persists intent before create, maps once and returns mapping for replay', async () => {
    const s = setup();
    vi.mocked(s.deps.gateway.create).mockImplementation(async () => {
      expect(s.row?.state).toBe('sending');
      expect(s.row?.attempts).toBe(1);
      return { kind: 'created', issue: { id: '100', key: 'SYN-1' } };
    });
    expect((await s.service.create(ctx, incidentId)).state).toBe('linked');
    expect((await s.service.create(ctx, incidentId)).issue?.key).toBe('SYN-1');
    expect(s.deps.gateway.create).toHaveBeenCalledTimes(1);
  });
  it('suppresses concurrent duplicate POST through atomic ensure and claim', async () => {
    const s = setup();
    await Promise.all([
      s.service.create(ctx, incidentId),
      s.service.create(ctx, incidentId),
    ]);
    expect(s.deps.gateway.create).toHaveBeenCalledTimes(1);
  });
  it('reconciles network loss and never recreates when search is empty', async () => {
    const s = setup();
    vi.mocked(s.deps.gateway.create).mockRejectedValue(
      new Error('private arbitrary message'),
    );
    expect((await s.service.create(ctx, incidentId)).state).toBe('ambiguous');
    expect((await s.service.create(ctx, incidentId)).state).toBe('ambiguous');
    expect((await s.service.create(ctx, incidentId)).state).toBe('ambiguous');
    expect((await s.service.create(ctx, incidentId)).state).toBe(
      'manual_review',
    );
    await s.service.create(ctx, incidentId);
    expect(s.deps.gateway.create).toHaveBeenCalledTimes(1);
    expect(s.deps.gateway.find).toHaveBeenCalledTimes(3);
  });
  it('links exactly one verified reconciliation candidate', async () => {
    const s = setup();
    vi.mocked(s.deps.gateway.create).mockResolvedValue({ kind: 'AMBIGUOUS' });
    await s.service.create(ctx, incidentId);
    vi.mocked(s.deps.gateway.find).mockResolvedValue({
      complete: true,
      issues: [{ id: '100', key: 'SYN-1' }],
    });
    expect((await s.service.create(ctx, incidentId)).state).toBe('linked');
  });
  it('multiple candidates require manual review; incomplete/throwing search cannot link', async () => {
    const s = setup();
    vi.mocked(s.deps.gateway.create).mockResolvedValue({ kind: 'AMBIGUOUS' });
    await s.service.create(ctx, incidentId);
    vi.mocked(s.deps.gateway.find).mockRejectedValue(new Error('private'));
    expect((await s.service.create(ctx, incidentId)).state).toBe('ambiguous');
    vi.mocked(s.deps.gateway.find).mockResolvedValue({
      complete: false,
      issues: [{ id: '100', key: 'SYN-1' }],
    });
    expect((await s.service.create(ctx, incidentId)).state).toBe('ambiguous');
    vi.mocked(s.deps.gateway.find).mockResolvedValue({
      complete: true,
      issues: [
        { id: '100', key: 'SYN-1' },
        { id: '101', key: 'SYN-2' },
      ],
    });
    expect((await s.service.create(ctx, incidentId)).state).toBe(
      'manual_review',
    );
  });
  it('persists retry-after, waits and bounds known 429 rejections', async () => {
    const s = setup();
    vi.mocked(s.deps.gateway.create).mockResolvedValue({
      kind: 'RATE_LIMITED',
      retryAfterSeconds: 10,
    });
    expect((await s.service.create(ctx, incidentId)).state).toBe('retry_wait');
    expect(s.row?.dueAt).toBe('2026-11-27T00:00:10.000Z');
    expect((await s.service.create(ctx, incidentId)).state).toBe('retry_wait');
    expect(s.deps.gateway.create).toHaveBeenCalledTimes(1);
    s.advance();
    await s.service.create(ctx, incidentId);
    s.set({ dueAt: null });
    expect((await s.service.create(ctx, incidentId)).state).toBe(
      'manual_review',
    );
    expect(s.deps.gateway.create).toHaveBeenCalledTimes(3);
  });
  it('configuration drift stops before any POST', async () => {
    const s = setup();
    vi.mocked(s.deps.gateway.verifyConfiguration).mockResolvedValue(false);
    expect((await s.service.create(ctx, incidentId)).state).toBe(
      'manual_review',
    );
    expect(s.deps.gateway.create).not.toHaveBeenCalled();
  });
  it('permanent configuration response stops automatic work', async () => {
    const s = setup();
    vi.mocked(s.deps.gateway.create).mockResolvedValue({
      kind: 'CONFIGURATION',
    });
    expect((await s.service.create(ctx, incidentId)).state).toBe(
      'manual_review',
    );
  });
  it('unknown mapping write outcome waits for lease then reconciles rather than POST', async () => {
    const s = setup();
    vi.mocked(s.repository.settle).mockResolvedValue(false);
    expect((await s.service.create(ctx, incidentId)).state).toBe('pending');
    expect((await s.service.create(ctx, incidentId)).state).toBe('pending');
    s.advance();
    await s.service.create(ctx, incidentId);
    expect(s.deps.gateway.create).toHaveBeenCalledTimes(1);
    expect(s.deps.gateway.find).toHaveBeenCalledTimes(1);
  });
  it('fails closed on missing references and cross-tenant repository results', async () => {
    const s = setup();
    vi.mocked(s.repository.incident).mockResolvedValueOnce(null);
    await expect(s.service.create(ctx, incidentId)).rejects.toMatchObject({
      code: 'NOT_READY',
    });
    s.incident.tenantId = '44444444-4444-4444-8444-444444444444';
    await expect(s.service.create(ctx, incidentId)).rejects.toMatchObject({
      code: 'DENIED',
    });
    expect(s.deps.gateway.create).not.toHaveBeenCalled();
  });
  it('rejects foreign existing/claimed intent and lost claim', async () => {
    const s = setup();
    await s.service.create(ctx, incidentId);
    s.set({ tenantId: '44444444-4444-4444-8444-444444444444' });
    await expect(s.service.create(ctx, incidentId)).rejects.toMatchObject({
      code: 'DENIED',
    });
    s.set({ tenantId, incidentId: '44444444-4444-4444-8444-444444444444' });
    await expect(s.service.create(ctx, incidentId)).rejects.toMatchObject({
      code: 'DENIED',
    });
    s.set({ incidentId, state: 'prepared', leaseUntil: null });
    vi.mocked(s.repository.claim).mockResolvedValueOnce(null);
    expect((await s.service.create(ctx, incidentId)).state).toBe('pending');
    vi.mocked(s.repository.claim).mockResolvedValueOnce({
      ...s.row!,
      id: '55555555-5555-4555-8555-555555555555',
    });
    await expect(s.service.create(ctx, incidentId)).rejects.toMatchObject({
      code: 'DENIED',
    });
  });
  it('requires actual user/admin authorisation and verified configuration CAS', async () => {
    const s = setup();
    const admin: TenantContext = {
      ...ctx,
      actor: { kind: 'atlassian-user', accountId: 'synthetic-admin' },
    };
    await expect(s.service.configure(ctx, config, 0)).rejects.toMatchObject({
      code: 'DENIED',
    });
    await s.service.configure(admin, config, 0);
    expect(s.deps.authoriseConfiguration).toHaveBeenCalledWith(admin);
    await expect(s.service.configure(admin, config, 1)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    vi.mocked(s.deps.gateway.verifyConfiguration).mockResolvedValueOnce(false);
    await expect(s.service.configure(admin, config, 0)).rejects.toMatchObject({
      code: 'NOT_READY',
    });
    vi.mocked(s.repository.saveConfiguration).mockResolvedValueOnce(false);
    await expect(s.service.configure(admin, config, 0)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    vi.mocked(s.deps.authoriseConfiguration).mockRejectedValueOnce(
      new Error('DENIED'),
    );
    await expect(s.service.configure(admin, config, 0)).rejects.toThrow(
      'DENIED',
    );
  });
  it('validates field IDs, metadata bindings and safe request values', () => {
    expect(configuration(ctx, config)).toEqual(config);
    expect(() => configuration(ctx, null)).toThrow('INVALID');
    expect(() =>
      configuration(ctx, { ...config, projectId: '1 OR 1=1' }),
    ).toThrow('INVALID');
    expect(() =>
      configuration(ctx, {
        ...config,
        fields: { ...config.fields, marker: 'summary' },
      }),
    ).toThrow('INVALID');
    expect(() =>
      configuration(ctx, {
        ...config,
        fields: { ...config.fields, marker: config.fields.policy },
      }),
    ).toThrow('INVALID');
    expect(() =>
      configuration(ctx, {
        ...config,
        tenantId: '44444444-4444-4444-8444-444444444444',
      }),
    ).toThrow('DENIED');
    expect(() => identifier(1)).toThrow('INVALID');
    const s = setup();
    const marker = 'light-house-55555555-5555-4555-8555-555555555555';
    expect(
      request(config, s.incident, marker).requestFieldValues.priority,
    ).toEqual({ id: '1' });
    expect(() => request(config, s.incident, 'unsafe')).toThrow('INVALID');
    expect(() =>
      request(config, { ...s.incident, summary: '\n' }, marker),
    ).toThrow('INVALID');
    expect(() =>
      request(
        config,
        { ...s.incident, warningAt: s.incident.deadlineAt },
        marker,
      ),
    ).toThrow('INVALID');
  });
});

it('schedules Retry-After from response time rather than worker start', async () => {
  const s = setup();
  vi.mocked(s.deps.gateway.create).mockImplementation(async () => {
    s.advance();
    return { kind: 'RATE_LIMITED', retryAfterSeconds: 10 };
  });
  expect((await s.service.create(ctx, incidentId)).state).toBe('retry_wait');
  expect(s.row?.dueAt).toBe('2026-11-27T02:00:10.000Z');
});
