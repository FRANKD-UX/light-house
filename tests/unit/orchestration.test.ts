// Injected local port tests only; not Forge/Jira runtime acceptance.
import { expect, it, vi } from 'vitest';
import {
  OrchestrationService,
  type OrchestrationDependencies,
} from '../../src/application/orchestration/service';
import type { TenantContext } from '../../src/application/ports/tenant-context';
import {
  IncidentError,
  type Incident,
  type IncidentEvidence,
} from '../../src/domain/incidents/model';
import type { EnrichmentResult } from '../../src/application/incidents/service';

const id = (n: number) =>
  `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
function fixture() {
  const ctx: TenantContext = {
    installationId: 'installation-example',
    tenantId: id(1),
    actor: { kind: 'atlassian-user', accountId: 'synthetic-admin' },
  };
  const incident: Incident = {
    id: id(2),
    installationId: ctx.installationId,
    tenantId: ctx.tenantId,
    sourceId: id(3),
    problemEventId: '100',
    correlationId: id(4),
    createdAt: '2026-11-27T00:00:00.000Z',
    occurredAt: '2026-11-27T00:00:00.000Z',
    state: 'new',
    version: 1,
    impact: {
      confidence: 'known',
      reason: 'COMPLETE',
      siteId: id(5),
      uplinkId: id(6),
      carrierId: id(7),
      affectedServiceIds: [],
      affectedCustomerIds: [],
      potentiallyAffectedCustomerIds: [],
      potentiallyAffectedServiceIds: [],
      protectedServiceIds: [],
      uncertainServiceIds: [],
      tierIds: [id(8)],
    },
    sla: {
      kind: 'selected',
      snapshot: {
        policyId: id(9),
        policyVersion: 1,
        tierId: id(8),
        consideredTierIds: [id(8)],
        priority: 'P1',
        severity: '4',
        confidence: 'known',
        reason: 'STRICTEST_AFFECTED_TIER',
        clock: 'elapsed-utc',
        startedAt: '2026-11-27T00:00:00.000Z',
        durationSeconds: 3600,
        warningSeconds: 1800,
        warningAt: '2026-11-27T00:30:00.000Z',
        deadlineAt: '2026-11-27T01:00:00.000Z',
      },
    },
  };
  const entry: IncidentEvidence = {
    inboxId: id(10),
    sourceId: incident.sourceId,
    correlationId: id(4),
    receivedAt: incident.createdAt,
    uplinkId: incident.impact.uplinkId,
    siteId: incident.impact.siteId,
    event: {
      externalEventId: '100',
      problemEventId: '100',
      resourceId: 'trigger:synthetic',
      kind: 'problem',
      occurredAt: incident.occurredAt,
      severity: '4',
    },
  };
  const deps = {
    ready: vi.fn(async () => true),
    inbox: vi.fn<OrchestrationDependencies['inbox']>(async () => entry),
    candidates: vi.fn<OrchestrationDependencies['candidates']>(async () => []),
    enrich: vi.fn<OrchestrationDependencies['enrich']>(async () => ({
      kind: 'incident',
      incident,
      recoveryObservedAt: null,
      updateCount: 0,
    })),
    jsmReady: vi.fn(async () => true),
    configured: vi.fn(async () => true),
    createJsm: vi.fn<OrchestrationDependencies['createJsm']>(async () => ({
      state: 'linked',
      intentId: id(11),
      issue: { id: '10000', key: 'SYNTH-1' },
    })),
    authoriseRecovery: vi.fn<OrchestrationDependencies['authoriseRecovery']>(
      async () => undefined,
    ),
  };
  const service = new OrchestrationService(deps);
  return { ctx, incident, entry, deps, service };
}

it('reports distinct prerequisite states and performs no external work when an earlier stage is incomplete', async () => {
  const f = fixture();
  f.deps.ready.mockResolvedValueOnce(false);
  expect(await f.service.process(f.ctx, f.entry.inboxId)).toMatchObject({
    status: 'incident_schema_not_ready',
    incidentId: null,
  });
  expect(f.deps.inbox).not.toHaveBeenCalled();
  f.deps.inbox.mockResolvedValueOnce(null);
  expect(await f.service.process(f.ctx, f.entry.inboxId)).toMatchObject({
    status: 'receipt_not_ready',
    incidentId: null,
  });
  expect(f.deps.enrich).not.toHaveBeenCalled();
  f.deps.enrich.mockResolvedValueOnce({ kind: 'awaiting_problem' });
  expect((await f.service.process(f.ctx, f.entry.inboxId)).status).toBe(
    'awaiting_problem',
  );
  f.deps.enrich.mockResolvedValueOnce({
    kind: 'incident',
    incident: {
      ...f.incident,
      sla: { kind: 'manual_triage', reason: 'POLICY_GAP' },
      state: 'manual_triage',
    },
    recoveryObservedAt: null,
    updateCount: 0,
  });
  expect((await f.service.process(f.ctx, f.entry.inboxId)).status).toBe(
    'manual_triage',
  );
  expect(f.deps.jsmReady).not.toHaveBeenCalled();
  f.deps.jsmReady.mockResolvedValueOnce(false);
  expect((await f.service.process(f.ctx, f.entry.inboxId)).status).toBe(
    'jsm_schema_not_ready',
  );
  expect(f.deps.configured).not.toHaveBeenCalled();
  f.deps.configured.mockResolvedValueOnce(false);
  expect((await f.service.process(f.ctx, f.entry.inboxId)).status).toBe(
    'configuration_required',
  );
  expect(f.deps.createJsm).not.toHaveBeenCalled();
  expect(await f.service.process(f.ctx, f.entry.inboxId)).toEqual({
    inboxId: f.entry.inboxId,
    incidentId: f.incident.id,
    status: 'linked',
  });
  expect(f.deps.createJsm).toHaveBeenCalledWith(f.ctx, f.incident.id);
});

it.each(['pending', 'retry_wait', 'ambiguous', 'manual_review'] as const)(
  'preserves JSM %s as an observed stage, not a linked incident',
  async (state) => {
    const f = fixture();
    f.deps.createJsm.mockResolvedValue({
      state,
      intentId: id(11),
      issue: null,
    });
    expect((await f.service.process(f.ctx, f.entry.inboxId)).status).toBe(
      state,
    );
  },
);

it('rejects a foreign enriched incident and propagates a real worker failure for queue redelivery', async () => {
  const f = fixture();
  const enrichment = (incident: Incident): EnrichmentResult => ({
    kind: 'incident',
    incident,
    recoveryObservedAt: null,
    updateCount: 0,
  });
  for (const incident of [
    { ...f.incident, tenantId: id(99) },
    { ...f.incident, installationId: 'foreign-installation' },
  ]) {
    f.deps.enrich.mockResolvedValueOnce(enrichment(incident));
    await expect(f.service.process(f.ctx, f.entry.inboxId)).rejects.toThrow(
      'DENIED',
    );
  }
  expect(f.deps.createJsm).not.toHaveBeenCalled();
  f.deps.enrich.mockRejectedValueOnce(new IncidentError('CONFLICT'));
  await expect(f.service.process(f.ctx, f.entry.inboxId)).rejects.toThrow(
    'CONFLICT',
  );
  f.deps.createJsm.mockRejectedValueOnce(
    new Error('synthetic external failure'),
  );
  await expect(f.service.process(f.ctx, f.entry.inboxId)).rejects.toThrow(
    'synthetic external failure',
  );
});

it('freshly authorises every recovery call and denies nonuser actors before any candidate reads', async () => {
  const f = fixture();
  for (const actor of [
    { kind: 'system' as const },
    { kind: 'monitoring-source' as const, sourceId: id(3) },
  ])
    await expect(f.service.recover({ ...f.ctx, actor }, {})).rejects.toThrow(
      'DENIED',
    );
  expect(f.deps.authoriseRecovery).not.toHaveBeenCalled();
  expect(await f.service.recover(f.ctx, {})).toEqual({
    examined: 0,
    next: null,
    results: [],
  });
  f.deps.authoriseRecovery.mockRejectedValueOnce(new IncidentError('DENIED'));
  await expect(f.service.recover(f.ctx, {})).rejects.toThrow('DENIED');
  expect(f.deps.authoriseRecovery).toHaveBeenCalledTimes(2);
  expect(f.deps.candidates).toHaveBeenCalledTimes(1);
});

it('validates recovery input/cursor and schema before reading candidates', async () => {
  const f = fixture();
  for (const input of [
    null,
    [],
    { after: 'not-a-uuid' },
    { after: null },
    { after: '', tenantId: id(99) },
    { action: 'recover' },
  ])
    await expect(f.service.recover(f.ctx, input)).rejects.toThrow('INVALID');
  expect(f.deps.candidates).not.toHaveBeenCalled();
  f.deps.ready.mockResolvedValueOnce(false);
  await expect(f.service.recover(f.ctx, {})).rejects.toThrow('NOT_READY');
  expect(f.deps.candidates).not.toHaveBeenCalled();
  await f.service.recover(f.ctx, { after: id(10) });
  expect(f.deps.candidates).toHaveBeenCalledWith(f.ctx, id(10));
});

it('rejects invalid, duplicate, out-of-order, oversized and out-of-cursor candidate pages before processing', async () => {
  const f = fixture();
  for (const rows of [
    [{ id: id(12) }, { id: id(12) }],
    [{ id: id(13) }, { id: id(12) }],
    [{ id: 'not-a-uuid' }],
    Array.from({ length: 22 }, (_, n) => ({ id: id(n + 12) })),
  ]) {
    f.deps.candidates.mockResolvedValueOnce(rows);
    await expect(f.service.recover(f.ctx, {})).rejects.toThrow('INVALID');
  }
  f.deps.candidates.mockResolvedValueOnce([{ id: id(10) }]);
  await expect(f.service.recover(f.ctx, { after: id(10) })).rejects.toThrow(
    'INVALID',
  );
  f.deps.candidates.mockResolvedValueOnce(null as unknown as { id: string }[]);
  await expect(f.service.recover(f.ctx, {})).rejects.toThrow('INVALID');
  f.deps.candidates.mockResolvedValueOnce([null] as unknown as {
    id: string;
  }[]);
  await expect(f.service.recover(f.ctx, {})).rejects.toThrow('INVALID');
  expect(f.deps.enrich).not.toHaveBeenCalled();
});

it('processes only20 of21 ordered rows sequentially, preserves fixed failures, and advances past failures', async () => {
  const f = fixture();
  const rows = Array.from({ length: 21 }, (_, n) => ({ id: id(n + 20) }));
  f.deps.candidates.mockResolvedValueOnce(rows);
  let active = 0;
  f.deps.enrich.mockImplementation(async (_ctx, inboxId) => {
    expect(++active).toBe(1);
    await Promise.resolve();
    active--;
    if (inboxId === rows[0]!.id) throw new IncidentError('CONFLICT');
    if (inboxId === rows[19]!.id)
      throw new Error(
        'Bearer SYNTHETIC-DO-NOT-PUBLISH https://synthetic.example.invalid/private',
      );
    return { kind: 'awaiting_problem' };
  });
  const result = await f.service.recover(f.ctx, {});
  expect(result.examined).toBe(20);
  expect(result.next).toBe(rows[19]!.id);
  expect(result.results[0]).toEqual({
    inboxId: rows[0]!.id,
    status: 'failed',
    code: 'CONFLICT',
  });
  expect(result.results[19]).toEqual({
    inboxId: rows[19]!.id,
    status: 'failed',
    code: 'UNAVAILABLE',
  });
  expect(f.deps.enrich).toHaveBeenCalledTimes(20);
  expect(f.deps.enrich).not.toHaveBeenCalledWith(f.ctx, rows[20]!.id);
  expect(JSON.stringify(result)).not.toContain('SYNTHETIC-DO-NOT-PUBLISH');
  expect(JSON.stringify(result)).not.toContain('example.invalid');
  f.deps.candidates.mockResolvedValueOnce([rows[20]!]);
  expect(await f.service.recover(f.ctx, { after: result.next })).toMatchObject({
    examined: 1,
    next: null,
  });
});

it('uses fixed allowlisted codes for perrow failures without returning arbitrary exception codes', async () => {
  const f = fixture();
  const cases = [
    'INVALID',
    'DENIED',
    'NOT_READY',
    'CONFLICT',
    'UNAVAILABLE',
  ] as const;
  f.deps.candidates.mockResolvedValue(
    cases.map((_, n) => ({ id: id(n + 20) })),
  );
  // An arbitrary thrown object/code never becomes an unvalidated public field.
  for (const code of ['INVALID', 'DENIED', 'NOT_READY', 'CONFLICT'] as const)
    f.deps.enrich.mockRejectedValueOnce(new IncidentError(code));
  f.deps.enrich.mockRejectedValueOnce(
    Object.assign(new Error('unsafe-details'), { code: 'UNSAFE_CUSTOM' }),
  );
  const result = await f.service.recover(f.ctx, {});
  expect(
    result.results.map((row) =>
      row.status === 'failed' ? row.code : row.status,
    ),
  ).toEqual(cases);
  expect(JSON.stringify(result)).not.toContain('UNSAFE_CUSTOM');
  expect(JSON.stringify(result)).not.toContain('unsafe-details');
});
