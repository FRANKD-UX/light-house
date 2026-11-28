// In-memory application-port regression tests, not hosted Forge acceptance.
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { IncidentService } from '../../src/application/incidents/service';
import type { IncidentDependencies } from '../../src/application/incidents/ports';
import type {
  Incident,
  IncidentEvidence,
} from '../../src/domain/incidents/model';
import type { TenantContext } from '../../src/application/ports/tenant-context';
const start = '2026-11-27T00:00:00.000Z',
  recovered = '2026-11-27T00:00:30.000Z';
function fixture() {
  const ctx: TenantContext = {
    installationId: 'synthetic-installation',
    tenantId: randomUUID(),
    actor: { kind: 'system' },
  };
  const original: IncidentEvidence = {
    inboxId: randomUUID(),
    sourceId: randomUUID(),
    correlationId: randomUUID(),
    receivedAt: start,
    uplinkId: randomUUID(),
    siteId: randomUUID(),
    event: {
      externalEventId: '100',
      problemEventId: '100',
      resourceId: 'synthetic:original',
      kind: 'problem',
      occurredAt: start,
      severity: '4',
    },
  };
  const incident: Incident = {
    id: randomUUID(),
    installationId: ctx.installationId,
    tenantId: ctx.tenantId,
    sourceId: original.sourceId,
    problemEventId: '100',
    correlationId: randomUUID(),
    createdAt: start,
    occurredAt: start,
    impact: {
      confidence: 'known',
      reason: 'COMPLETE',
      siteId: original.siteId,
      uplinkId: original.uplinkId,
      carrierId: randomUUID(),
      affectedServiceIds: [],
      affectedCustomerIds: [],
      potentiallyAffectedCustomerIds: [],
      potentiallyAffectedServiceIds: [],
      protectedServiceIds: [],
      uncertainServiceIds: [],
      tierIds: [],
    },
    sla: { kind: 'manual_triage', reason: 'POLICY_GAP' },
    state: 'manual_triage',
    version: 1,
  };
  const inbox = new Map([[original.inboxId, original]]),
    ledger = new Map([[original.inboxId, original]]);
  let saved: Incident | null = incident;
  const deps: IncidentDependencies = {
    now: () => recovered,
    id: randomUUID,
    inventory: { load: vi.fn(), policies: vi.fn() },
    repository: {
      inbox: vi.fn(async (_ctx, id) => inbox.get(id) ?? null),
      recordEvidence: vi.fn(async (_ctx, e) => {
        ledger.set(e.inboxId, e);
      }),
      find: vi.fn(async () => saved),
      createIfAbsent: vi.fn(async (_ctx, value) => value),
      evidence: vi.fn(async () => [...ledger.values()]),
    },
  };
  const service = new IncidentService(deps);
  function add(
    kind: 'recovery' | 'update',
    overrides: Partial<IncidentEvidence> = {},
    eventOverrides: Partial<IncidentEvidence['event']> = {},
  ) {
    const entry: IncidentEvidence = {
      ...original,
      ...overrides,
      inboxId: randomUUID(),
      correlationId: randomUUID(),
      event: {
        ...original.event,
        externalEventId: String(101 + inbox.size),
        kind,
        occurredAt: recovered,
        ...eventOverrides,
      },
    };
    inbox.set(entry.inboxId, entry);
    return entry;
  }
  return {
    ctx,
    original,
    incident,
    inbox,
    ledger,
    deps,
    service,
    add,
    setIncident: (value: Incident | null) => {
      saved = value;
    },
  };
}
describe('incident evidence remains bound to the original resource', () => {
  it.each(['site', 'uplink', 'resource'] as const)(
    'rejects current recovery with different %s but keeps its evidence durable',
    async (field) => {
      const f = fixture();
      const mismatched = f.add(
        'recovery',
        field === 'site'
          ? { siteId: randomUUID() }
          : field === 'uplink'
            ? { uplinkId: randomUUID() }
            : {},
        field === 'resource'
          ? { resourceId: 'synthetic:alias-on-same-uplink' }
          : {},
      );
      const before = structuredClone(f.incident);
      await expect(
        f.service.process(f.ctx, { inboxId: mismatched.inboxId }),
      ).rejects.toThrow('CONFLICT');
      expect(f.ledger.get(mismatched.inboxId)).toEqual(mismatched);
      expect(f.incident).toEqual(before);
    },
  );
  it('rejects mismapped updates and excludes them from subsequent valid update/recovery aggregation', async () => {
    const f = fixture();
    const bad = f.add('update', { uplinkId: randomUUID() });
    await expect(
      f.service.process(f.ctx, { inboxId: bad.inboxId }),
    ).rejects.toThrow('CONFLICT');
    const goodUpdate = f.add('update');
    expect(
      await f.service.process(f.ctx, { inboxId: goodUpdate.inboxId }),
    ).toMatchObject({
      updateCount: 1,
      conflictingEvidenceCount: 1,
      recoveryObservedAt: null,
    });
    const goodRecovery = f.add('recovery');
    expect(
      await f.service.process(f.ctx, { inboxId: goodRecovery.inboxId }),
    ).toMatchObject({
      updateCount: 1,
      recoveryObservedAt: recovered,
      conflictingEvidenceCount: 1,
      incident: f.incident,
    });
    expect(f.ledger.size).toBe(4);
  });
  it('does not let a prior foreign recovery poison legitimate recovery for the original resource', async () => {
    const f = fixture();
    const bad = f.add(
      'recovery',
      { siteId: randomUUID(), uplinkId: randomUUID() },
      { resourceId: 'synthetic:foreign' },
    );
    await expect(
      f.service.process(f.ctx, { inboxId: bad.inboxId }),
    ).rejects.toThrow('CONFLICT');
    const good = f.add('recovery');
    const result = await f.service.process(f.ctx, { inboxId: good.inboxId });
    expect(result).toMatchObject({
      kind: 'incident',
      recoveryObservedAt: recovered,
      updateCount: 0,
      conflictingEvidenceCount: 1,
    });
    expect(f.incident.state).toBe('manual_triage');
    expect(f.incident.occurredAt).toBe(start);
  });
  it('keeps foreign-resource recovery-before-problem durable then excludes it after the original problem is known', async () => {
    const f = fixture();
    f.setIncident(null);
    f.ledger.clear();
    const early = f.add(
      'recovery',
      {},
      { resourceId: 'synthetic:foreign-alias' },
    );
    expect(await f.service.process(f.ctx, { inboxId: early.inboxId })).toEqual({
      kind: 'awaiting_problem',
    });
    expect(f.ledger.has(early.inboxId)).toBe(true);
    f.setIncident(f.incident);
    const result = await f.service.process(f.ctx, {
      inboxId: f.original.inboxId,
    });
    expect(result).toMatchObject({
      recoveryObservedAt: null,
      updateCount: 0,
      conflictingEvidenceCount: 1,
    });
    await expect(
      f.service.process(f.ctx, { inboxId: early.inboxId }),
    ).rejects.toThrow('CONFLICT');
    const good = f.add('recovery');
    expect(
      await f.service.process(f.ctx, { inboxId: good.inboxId }),
    ).toMatchObject({
      recoveryObservedAt: recovered,
      conflictingEvidenceCount: 1,
    });
  });
  it('fails closed if the original durable problem evidence is missing or ambiguous', async () => {
    const f = fixture();
    f.ledger.clear();
    const recovery = f.add('recovery');
    await expect(
      f.service.process(f.ctx, { inboxId: recovery.inboxId }),
    ).rejects.toThrow('NOT_READY');
    f.ledger.set(f.original.inboxId, f.original);
    const conflictingProblem = {
      ...f.original,
      inboxId: randomUUID(),
      event: { ...f.original.event, resourceId: 'synthetic:other-original' },
    };
    f.ledger.set(conflictingProblem.inboxId, conflictingProblem);
    await expect(
      f.service.process(f.ctx, { inboxId: recovery.inboxId }),
    ).rejects.toThrow('CONFLICT');
  });
  it('returns the existing legitimate contract when all evidence binds to one original resource', async () => {
    const f = fixture();
    const recovery = f.add('recovery');
    expect(
      await f.service.process(f.ctx, { inboxId: recovery.inboxId }),
    ).toEqual({
      kind: 'incident',
      incident: f.incident,
      recoveryObservedAt: recovered,
      updateCount: 0,
    });
    expect(f.deps.inventory.load).not.toHaveBeenCalled();
    expect(f.deps.repository.createIfAbsent).not.toHaveBeenCalled();
  });
});
