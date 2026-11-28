// Synthetic pure-domain and in-memory-port tests, not hosted Forge acceptance.
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type {
  InventoryRecord,
  Kind,
  Fields,
} from '../../src/domain/inventory/model';
import type {
  Incident,
  IncidentEvidence,
  IncidentInventory,
  IncidentPolicy,
  SlaSnapshot,
} from '../../src/domain/incidents/model';
import { determineImpact } from '../../src/domain/incidents/impact';
import {
  selectSla,
  parseIncidentPolicy,
  slaStatus,
  validatePolicies,
} from '../../src/domain/incidents/sla';
import {
  transitionIncident,
  type OperationalIncident,
  type WorkflowActor,
} from '../../src/domain/incidents/workflow';
import { IncidentService } from '../../src/application/incidents/service';
import type { IncidentDependencies } from '../../src/application/incidents/ports';
import type { TenantContext } from '../../src/application/ports/tenant-context';
const id = (n: number) =>
  `${n.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;
const tenant = id(1),
  site = id(2),
  carrier = id(3),
  uplink = id(4),
  backup = id(5),
  customer = id(6),
  service = id(7),
  tier = id(8),
  source = id(20);
const start = '2026-11-27T00:00:00.000Z';
function row(
  _kind: Kind,
  n: number,
  fields: Fields,
  status = 'active',
): InventoryRecord {
  return {
    id: id(n),
    tenant_id: tenant,
    status,
    version: 1,
    created_at: start,
    updated_at: start,
    fixture_key: null,
    pending: null,
    fields,
  };
}
function inventory(failover = false): IncidentInventory {
  return {
    sites: [row('sites', 2, { code: 'site', display_name: 'Synthetic site' })],
    carriers: [
      row('carriers', 3, {
        code: 'carrier',
        display_name: 'Synthetic carrier',
      }),
    ],
    uplinks: [
      row('uplinks', 4, {
        site_id: site,
        carrier_id: carrier,
        code: 'primary',
        role: 'primary',
        capacity_mbps: 100,
        protected_uplink_id: null,
      }),
      row('uplinks', 5, {
        site_id: site,
        carrier_id: carrier,
        code: 'backup',
        role: 'backup',
        capacity_mbps: 100,
        protected_uplink_id: uplink,
      }),
    ],
    customers: [
      row('customers', 6, {
        reference: 'customer',
        display_alias: 'Synthetic customer',
        site_id: site,
        sla_tier_id: tier,
      }),
    ],
    services: [
      row('customer_services', 7, {
        customer_id: customer,
        site_id: site,
        tier_id: tier,
        code: 'service',
      }),
    ],
    dependencies: [
      row('service_dependencies', 9, {
        service_id: service,
        uplink_id: uplink,
        dependency_mode: failover ? 'failover' : 'required',
        failover_group: failover ? 'group' : null,
      }),
      ...(failover
        ? [
            row('service_dependencies', 10, {
              service_id: service,
              uplink_id: backup,
              dependency_mode: 'failover',
              failover_group: 'group',
            }),
          ]
        : []),
    ],
    tiers: [row('sla_tiers', 8, { code: 'gold', name: 'Synthetic Gold' })],
    availability: [],
  };
}
function policy(overrides: Partial<IncidentPolicy> = {}): IncidentPolicy {
  return {
    id: id(30),
    tenantId: tenant,
    tierId: tier,
    version: 1,
    status: 'published',
    clock: 'elapsed-utc',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveUntil: null,
    severityMap: { '5': 'P1', '4': 'P2', '3': 'P3' },
    unknownImpact: 'manual-review',
    targets: {
      P1: { durationSeconds: 60, warningSeconds: 45 },
      P2: { durationSeconds: 240, warningSeconds: 180 },
      P3: { durationSeconds: 1440, warningSeconds: 1080 },
    },
    ...overrides,
  };
}
const impact = { confidence: 'known', tierIds: [tier] } as const;
function snapshot(): SlaSnapshot {
  const result = selectSla(tenant, start, '5', impact, [policy()]);
  if (result.kind !== 'selected') throw new Error('fixture');
  return result.snapshot;
}
describe('incident infrastructure and impact resolution', () => {
  it('keeps potential customer impact separate and refuses insufficient-capacity failover', () => {
    const inv = inventory(true);
    const unknown = determineImpact(tenant, uplink, start, inv);
    expect(unknown.affectedCustomerIds).toEqual([]);
    expect(unknown.potentiallyAffectedCustomerIds).toEqual([customer]);
    expect(unknown.potentiallyAffectedServiceIds).toEqual([service]);
    const constrained = {
      ...inv,
      uplinks: inv.uplinks.map((u) =>
        u.id === backup
          ? { ...u, fields: { ...u.fields, capacity_mbps: 50 } }
          : u,
      ),
      availability: [
        { uplinkId: backup, state: 'up' as const, observedAt: start },
      ],
    };
    expect(determineImpact(tenant, uplink, start, constrained)).toMatchObject({
      confidence: 'unknown',
      affectedCustomerIds: [],
      protectedServiceIds: [],
      potentiallyAffectedCustomerIds: [customer],
    });
  });

  it('resolves required services, customers, tiers and infrastructure independently', () => {
    const result = determineImpact(tenant, uplink, start, inventory());
    expect(result).toMatchObject({
      confidence: 'known',
      reason: 'COMPLETE',
      siteId: site,
      carrierId: carrier,
      affectedServiceIds: [service],
      affectedCustomerIds: [customer],
      tierIds: [tier],
    });
    expect(Object.isFrozen(result.affectedServiceIds)).toBe(true);
  });
  it('does not assume a configured backup is live', () => {
    expect(
      determineImpact(tenant, uplink, start, inventory(true)),
    ).toMatchObject({
      confidence: 'unknown',
      reason: 'UNKNOWN_FAILOVER',
      uncertainServiceIds: [service],
    });
  });
  it('distinguishes protected failover from an affected service', () => {
    const inv = inventory(true);
    expect(
      determineImpact(tenant, uplink, start, {
        ...inv,
        availability: [{ uplinkId: backup, state: 'up', observedAt: start }],
      }),
    ).toMatchObject({
      confidence: 'known',
      affectedServiceIds: [],
      protectedServiceIds: [service],
    });
    expect(
      determineImpact(tenant, uplink, start, {
        ...inv,
        availability: [{ uplinkId: backup, state: 'down', observedAt: start }],
      }),
    ).toMatchObject({ affectedServiceIds: [service], protectedServiceIds: [] });
  });
  it.each(['2026-11-26T23:58:59.999Z', '2026-11-27T00:00:00.001Z'])(
    'treats stale/future failover observation %s as unknown',
    (at) => {
      expect(
        determineImpact(tenant, uplink, start, {
          ...inventory(true),
          availability: [{ uplinkId: backup, state: 'up', observedAt: at }],
        }).confidence,
      ).toBe('unknown');
    },
  );
  it('deduplicates customers while retaining independent services and strictest tiers', () => {
    const inv = inventory();
    const second = {
      ...inv.services[0]!,
      id: id(11),
      fields: { ...inv.services[0]!.fields, code: 'second' },
    };
    const dep = {
      ...inv.dependencies[0]!,
      id: id(12),
      fields: { ...inv.dependencies[0]!.fields, service_id: second.id },
    };
    expect(
      determineImpact(tenant, uplink, start, {
        ...inv,
        services: [...inv.services, second],
        dependencies: [...inv.dependencies, dep],
      }),
    ).toMatchObject({
      affectedServiceIds: [service, id(11)],
      affectedCustomerIds: [customer],
    });
  });
  it('keeps missing active relationships visible as unknown impact', () => {
    expect(
      determineImpact(tenant, uplink, start, { ...inventory(), customers: [] }),
    ).toMatchObject({
      confidence: 'unknown',
      reason: 'INCOMPLETE_INVENTORY',
      uncertainServiceIds: [service],
    });
    expect(
      determineImpact(tenant, uplink, start, {
        ...inventory(),
        dependencies: [],
      }).confidence,
    ).toBe('unknown');
    expect(
      determineImpact(tenant, uplink, start, { ...inventory(), services: [] })
        .confidence,
    ).toBe('unknown');
  });
  it('denies foreign tenant rows anywhere in the snapshot', () => {
    const inv = inventory();
    expect(() =>
      determineImpact(tenant, uplink, start, {
        ...inv,
        customers: [{ ...inv.customers[0]!, tenant_id: id(99) }],
      }),
    ).toThrow('DENIED');
  });
  it('rejects pending, duplicate and missing/inactive infrastructure snapshots', () => {
    const inv = inventory();
    expect(() =>
      determineImpact(tenant, uplink, start, {
        ...inv,
        uplinks: [{ ...inv.uplinks[0]!, pending: 'pending' }],
      }),
    ).toThrow('NOT_READY');
    expect(() =>
      determineImpact(tenant, uplink, start, {
        ...inv,
        sites: [...inv.sites, ...inv.sites],
      }),
    ).toThrow('INVALID');
    expect(() =>
      determineImpact(tenant, uplink, start, { ...inv, uplinks: [] }),
    ).toThrow('NOT_READY');
    expect(() =>
      determineImpact(tenant, uplink, start, { ...inv, carriers: [] }),
    ).toThrow('NOT_READY');
  });
  it('rejects duplicate/unbound availability and classifies mismatched service site safely', () => {
    const inv = inventory(true);
    const observation = {
      uplinkId: backup,
      state: 'up' as const,
      observedAt: start,
    };
    expect(() =>
      determineImpact(tenant, uplink, start, {
        ...inv,
        availability: [observation, observation],
      }),
    ).toThrow('INVALID');
    expect(() =>
      determineImpact(tenant, uplink, start, {
        ...inv,
        availability: [{ ...observation, uplinkId: id(99) }],
      }),
    ).toThrow('INVALID');
    expect(
      determineImpact(tenant, uplink, start, {
        ...inv,
        services: [
          {
            ...inv.services[0]!,
            fields: { ...inv.services[0]!.fields, site_id: id(99) },
          },
        ],
      }).confidence,
    ).toBe('unknown');
  });
});
describe('immutable effective-time SLA selection', () => {
  it('projects unknown policy input and drops arbitrary payload fields at every level', () => {
    const original = policy();
    const parsed = parseIncidentPolicy(tenant, {
      ...original,
      secret: 'synthetic omitted',
      targets: {
        ...original.targets,
        arbitrary: 'omitted',
        P1: { ...original.targets.P1, hidden: 'omitted' },
      },
    });
    expect(parsed).toEqual(original);
    expect(Object.isFrozen(parsed.targets.P1)).toBe(true);
    expect(() =>
      parseIncidentPolicy(tenant, { ...original, tenantId: id(99) }),
    ).toThrow('DENIED');
    expect(() =>
      parseIncidentPolicy(tenant, { ...original, clock: 'business-hours' }),
    ).toThrow('INVALID');
    for (const malformed of [
      null,
      [],
      {},
      [policy()],
      { ...original, targets: null },
      { ...original, severityMap: { '4': 'critical' } },
    ])
      expect(() => parseIncidentPolicy(tenant, malformed)).toThrow();
  });
  it('rejects malformed unknown policy collections using fixed failure contracts', () => {
    for (const malformed of [
      null,
      {},
      [null],
      [{ ...policy(), targets: null }],
      [{ ...policy(), severityMap: [] }],
      [{ ...policy(), unknownImpact: 'P4' }],
    ])
      expect(() => validatePolicies(tenant, malformed)).toThrow('INVALID');
  });

  it.each([
    ['5', 'P1', 60],
    ['4', 'P2', 240],
    ['3', 'P3', 1440],
  ])(
    'maps severity %s through this ISP policy',
    (severity, priority, duration) => {
      expect(
        selectSla(tenant, start, severity, impact, [policy()]),
      ).toMatchObject({
        kind: 'selected',
        snapshot: { priority, durationSeconds: duration },
      });
    },
  );
  it('uses exclusive effective boundary and immutable scalar snapshot across policy edits', () => {
    const before = policy({ effectiveUntil: start });
    const current = policy({ id: id(31), version: 2, effectiveFrom: start });
    const selected = selectSla(tenant, start, '5', impact, [before, current]);
    expect(selected).toMatchObject({
      kind: 'selected',
      snapshot: { policyVersion: 2, policyId: id(31) },
    });
    if (selected.kind !== 'selected') throw new Error('fixture');
    expect(selected.snapshot.warningAt).toBe('2026-11-27T00:00:45.000Z');
    expect(Object.isFrozen(selected.snapshot)).toBe(true);
  });
  it('selects strictest affected tier and stable priority/tier tie breaks', () => {
    const other = id(40);
    const second = policy({
      id: id(41),
      tierId: other,
      targets: {
        ...policy().targets,
        P1: { durationSeconds: 30, warningSeconds: 20 },
      },
    });
    const result = selectSla(
      tenant,
      start,
      '5',
      { confidence: 'known', tierIds: [tier, other] },
      [policy(), second],
    );
    expect(result).toMatchObject({
      kind: 'selected',
      snapshot: {
        tierId: other,
        durationSeconds: 30,
        consideredTierIds: [tier, other],
      },
    });
    expect(
      selectSla(
        tenant,
        start,
        '5',
        { confidence: 'known', tierIds: [other, tier] },
        [policy(), { ...second, targets: policy().targets }],
      ),
    ).toMatchObject({ kind: 'selected', snapshot: { tierId: tier } });
  });
  it('uses explicit conservative unknown rule and otherwise requires manual review', () => {
    expect(
      selectSla(
        tenant,
        start,
        '5',
        { confidence: 'unknown', tierIds: [tier] },
        [policy()],
      ),
    ).toEqual({ kind: 'manual_triage', reason: 'UNKNOWN_IMPACT' });
    expect(
      selectSla(
        tenant,
        start,
        '0',
        { confidence: 'unknown', tierIds: [tier] },
        [policy({ unknownImpact: 'P1' })],
      ),
    ).toMatchObject({
      kind: 'selected',
      snapshot: { priority: 'P1', reason: 'CONFIGURED_UNKNOWN_IMPACT' },
    });
    expect(selectSla(tenant, start, '0', impact, [policy()])).toEqual({
      kind: 'manual_triage',
      reason: 'UNMAPPED_SEVERITY',
    });
    expect(
      selectSla(tenant, start, '5', { confidence: 'known', tierIds: [] }, [
        policy(),
      ]),
    ).toEqual({ kind: 'manual_triage', reason: 'UNKNOWN_IMPACT' });
    expect(selectSla(tenant, start, '5', impact, [])).toEqual({
      kind: 'manual_triage',
      reason: 'POLICY_GAP',
    });
  });
  it('rejects cross-tenant policy, duplicate versions, overlaps and invalid warnings', () => {
    expect(() =>
      validatePolicies(tenant, [policy({ tenantId: id(99) })]),
    ).toThrow('DENIED');
    expect(() =>
      validatePolicies(tenant, [policy(), policy({ id: id(31) })]),
    ).toThrow('CONFLICT');
    expect(() =>
      validatePolicies(tenant, [policy(), policy({ id: id(31), version: 2 })]),
    ).toThrow('CONFLICT');
    expect(() =>
      validatePolicies(tenant, [
        policy({
          targets: {
            ...policy().targets,
            P1: { durationSeconds: 1, warningSeconds: 1 },
          },
        }),
      ]),
    ).toThrow();
    expect(() =>
      validatePolicies(tenant, [
        policy({ effectiveUntil: policy().effectiveFrom }),
      ]),
    ).toThrow('INVALID');
  });
  it('handles leap-day UTC arithmetic and warning/deadline equality', () => {
    const decision = selectSla(
      tenant,
      '2028-02-29T23:59:30.000Z',
      '5',
      impact,
      [policy()],
    );
    if (decision.kind !== 'selected') throw new Error('fixture');
    expect(decision.snapshot.deadlineAt).toBe('2028-03-01T00:00:30.000Z');
    expect(slaStatus(decision.snapshot, '2028-02-29T23:59:31.000Z')).toBe(
      'on-track',
    );
    expect(slaStatus(decision.snapshot, decision.snapshot.warningAt)).toBe(
      'warning',
    );
    expect(slaStatus(decision.snapshot, decision.snapshot.deadlineAt)).toBe(
      'breached',
    );
    expect(
      slaStatus(
        decision.snapshot,
        '2028-03-02T00:00:00.000Z',
        '2028-03-01T00:00:29.999Z',
      ),
    ).toBe('warning');
    expect(() => slaStatus(decision.snapshot, start)).toThrow('INVALID');
  });
});
function fixture() {
  const ctx: TenantContext = {
    installationId: 'synthetic-installation',
    tenantId: tenant,
    actor: { kind: 'system' },
  };
  const inbox: IncidentEvidence = {
    inboxId: id(50),
    sourceId: source,
    correlationId: id(51),
    receivedAt: start,
    uplinkId: uplink,
    siteId: site,
    event: {
      externalEventId: '123',
      problemEventId: '123',
      resourceId: 'synthetic:link',
      kind: 'problem',
      occurredAt: start,
      severity: '5',
    },
  };
  const inputs = new Map([[inbox.inboxId, inbox]]),
    events = new Map<string, IncidentEvidence>(),
    incidents = new Map<string, Incident>();
  const key = (s: string, p: string) => s + ':' + p;
  const deps: IncidentDependencies = {
    now: () => start,
    id: randomUUID,
    repository: {
      inbox: vi.fn(async (_c, i) => inputs.get(i) ?? null),
      recordEvidence: vi.fn(async (_c, e) => {
        events.set(
          key(e.sourceId, e.event.externalEventId) + ':' + e.event.kind,
          e,
        );
      }),
      find: vi.fn(async (_c, s, p) => incidents.get(key(s, p)) ?? null),
      createIfAbsent: vi.fn(async (_c, i) => {
        const k = key(i.sourceId, i.problemEventId);
        if (!incidents.has(k)) incidents.set(k, i);
        return incidents.get(k)!;
      }),
      evidence: vi.fn(async (_c, s, p) =>
        [...events.values()].filter(
          (e) => e.sourceId === s && e.event.problemEventId === p,
        ),
      ),
    },
    inventory: {
      load: vi.fn(async () => inventory()),
      policies: vi.fn(async () => [policy()]),
    },
  };
  return {
    ctx,
    inbox,
    inputs,
    events,
    incidents,
    deps,
    service: new IncidentService(deps),
  };
}
describe('incident enrichment with durable in-memory ports', () => {
  it('concurrent problem replay converges to one incident, original start and snapshot', async () => {
    const f = fixture();
    const results = await Promise.all([
      f.service.process(f.ctx, { inboxId: f.inbox.inboxId }),
      f.service.process(f.ctx, { inboxId: f.inbox.inboxId }),
    ]);
    expect(f.incidents.size).toBe(1);
    expect(results[0]).toEqual(results[1]);
    vi.mocked(f.deps.inventory.policies).mockResolvedValue([]);
    const again = await f.service.process(f.ctx, { inboxId: f.inbox.inboxId });
    expect(again).toEqual(results[0]);
  });
  it('retains recovery-before-problem, without resolving or changing original SLA', async () => {
    const f = fixture();
    const recovery = {
      ...f.inbox,
      inboxId: id(52),
      event: {
        ...f.inbox.event,
        externalEventId: '124',
        kind: 'recovery' as const,
        occurredAt: '2026-11-27T00:00:30.000Z',
      },
    };
    f.inputs.set(recovery.inboxId, recovery);
    expect(
      await f.service.process(f.ctx, { inboxId: recovery.inboxId }),
    ).toEqual({ kind: 'awaiting_problem' });
    const result = await f.service.process(f.ctx, { inboxId: f.inbox.inboxId });
    expect(result).toMatchObject({
      kind: 'incident',
      incident: {
        state: 'new',
        occurredAt: start,
        sla: { snapshot: { startedAt: start } },
      },
      recoveryObservedAt: recovery.event.occurredAt,
    });
  });
  it('retains independent updates and persists evidence even when inventory enrichment fails', async () => {
    const f = fixture();
    vi.mocked(f.deps.inventory.load).mockRejectedValueOnce(
      new Error('synthetic port failure'),
    );
    await expect(
      f.service.process(f.ctx, { inboxId: f.inbox.inboxId }),
    ).rejects.toThrow();
    expect(f.events.size).toBe(1);
    await f.service.process(f.ctx, { inboxId: f.inbox.inboxId });
    const update = {
      ...f.inbox,
      inboxId: id(52),
      event: {
        ...f.inbox.event,
        externalEventId: '125',
        kind: 'update' as const,
        severity: '0',
      },
    };
    f.inputs.set(update.inboxId, update);
    expect(
      await f.service.process(f.ctx, { inboxId: update.inboxId }),
    ).toMatchObject({
      updateCount: 1,
      incident: { sla: { snapshot: { priority: 'P1' } } },
    });
  });
  it('keeps unknown/missing policy incidents visible for manual triage', async () => {
    const f = fixture();
    vi.mocked(f.deps.inventory.policies).mockResolvedValue([]);
    expect(
      await f.service.process(f.ctx, { inboxId: f.inbox.inboxId }),
    ).toMatchObject({
      incident: { state: 'manual_triage', sla: { reason: 'POLICY_GAP' } },
    });
  });
  it('rejects missing source context or foreign repository result without accepting client-selected authority', async () => {
    const f = fixture();
    await expect(f.service.process(f.ctx, { inboxId: id(99) })).rejects.toThrow(
      'NOT_READY',
    );
    await expect(
      f.service.process(
        { ...f.ctx, actor: { kind: 'monitoring-source', sourceId: id(99) } },
        { inboxId: f.inbox.inboxId },
      ),
    ).rejects.toThrow('DENIED');
    vi.mocked(f.deps.repository.inbox).mockResolvedValue({
      ...f.inbox,
      siteId: id(99),
    });
    await expect(
      f.service.process(f.ctx, { inboxId: f.inbox.inboxId }),
    ).rejects.toThrow('DENIED');
  });
  it('rejects malformed event kind and foreign incident/evidence returned by ports', async () => {
    const f = fixture();
    vi.mocked(f.deps.repository.inbox).mockResolvedValueOnce({
      ...f.inbox,
      event: { ...f.inbox.event, externalEventId: '0' },
    });
    await expect(
      f.service.process(f.ctx, { inboxId: f.inbox.inboxId }),
    ).rejects.toThrow('INVALID');
    const result = await f.service.process(f.ctx, { inboxId: f.inbox.inboxId });
    if (result.kind !== 'incident') throw new Error('fixture');
    vi.mocked(f.deps.repository.find).mockResolvedValueOnce({
      ...result.incident,
      tenantId: id(99),
    });
    await expect(
      f.service.process(f.ctx, { inboxId: f.inbox.inboxId }),
    ).rejects.toThrow('DENIED');
    vi.mocked(f.deps.repository.evidence).mockResolvedValueOnce([
      { ...f.inbox, sourceId: id(99) },
    ]);
    await expect(
      f.service.process(f.ctx, { inboxId: f.inbox.inboxId }),
    ).rejects.toThrow('DENIED');
  });
});
function operation(): OperationalIncident {
  return {
    id: id(60),
    tenantId: tenant,
    state: 'new',
    version: 1,
    ownerTeamId: id(61),
    ownerAssigneeId: null,
    sla: snapshot(),
    pendingHandoff: null,
    pendingReturn: null,
    recoveryObservedAt: null,
    restorationValidatedAt: null,
    resolvedAt: null,
  };
}
const actor: WorkflowActor = {
  tenantId: tenant,
  role: 'operator',
  teamId: id(61),
  assigneeId: id(64),
  nocTeamId: id(61),
};
function step(
  i: OperationalIncident,
  kind:
    | 'acknowledge'
    | 'triage'
    | 'start_work'
    | 'request_validation'
    | 'validate_restoration'
    | 'resolve'
    | 'close',
) {
  return transitionIncident(
    i,
    actor,
    i.version,
    { kind },
    '2026-11-27T00:01:00.000Z',
    true,
  );
}
describe('server-authoritative operational policy', () => {
  it('supports direct NOC remediation through three gates, preserving original SLA identity', () => {
    let i = operation();
    const original = i.sla;
    for (const kind of [
      'acknowledge',
      'triage',
      'start_work',
      'request_validation',
      'validate_restoration',
      'resolve',
      'close',
    ] as const)
      i = step(i, kind);
    expect(i.state).toBe('closed');
    expect(i.sla).toBe(original);
    expect(i.resolvedAt).toBe('2026-11-27T00:01:00.000Z');
  });
  it('retains ownership until handoff accepted and handles reject/return without reset', () => {
    let i = step(
      step(step(operation(), 'acknowledge'), 'triage'),
      'start_work',
    );
    const sla = i.sla;
    const target = { ...actor, teamId: id(62), assigneeId: id(65) };
    i = transitionIncident(
      i,
      actor,
      i.version,
      { kind: 'request_handoff', targetTeamId: target.teamId },
      start,
      true,
    );
    expect(i.ownerTeamId).toBe(actor.teamId);
    i = transitionIncident(
      i,
      target,
      i.version,
      { kind: 'reject_handoff' },
      start,
      true,
    );
    expect(i.ownerTeamId).toBe(actor.teamId);
    i = transitionIncident(
      i,
      actor,
      i.version,
      { kind: 'request_handoff', targetTeamId: target.teamId },
      start,
      true,
    );
    i = transitionIncident(
      i,
      target,
      i.version,
      { kind: 'accept_handoff' },
      start,
      true,
    );
    expect(i.ownerTeamId).toBe(target.teamId);
    i = transitionIncident(
      i,
      target,
      i.version,
      { kind: 'return_to_noc' },
      start,
      true,
    );
    expect(i.ownerTeamId).toBe(target.teamId);
    expect(i.pendingReturn?.fromTeamId).toBe(target.teamId);
    expect(() =>
      transitionIncident(
        i,
        target,
        i.version,
        { kind: 'request_handoff', targetTeamId: id(63) },
        start,
        true,
      ),
    ).toThrow('CONFLICT');
    i = transitionIncident(
      i,
      actor,
      i.version,
      { kind: 'reject_return' },
      start,
      true,
    );
    expect(i.ownerTeamId).toBe(target.teamId);
    expect(i.pendingReturn).toBeNull();
    i = transitionIncident(
      i,
      target,
      i.version,
      { kind: 'request_return' },
      start,
      true,
    );
    i = transitionIncident(
      i,
      actor,
      i.version,
      { kind: 'accept_return' },
      start,
      true,
    );
    expect(i).toMatchObject({
      state: 'restoration_validation',
      ownerTeamId: actor.teamId,
      pendingReturn: null,
    });
    expect(i.sla).toBe(sla);
  });
  it('denies viewer/foreign/stale/nonowner changes and bypassing required gates', () => {
    const i = operation();
    for (const denied of [
      { ...actor, role: 'viewer' as const },
      { ...actor, tenantId: id(99) },
      { ...actor, teamId: id(99) },
    ])
      expect(() =>
        transitionIncident(
          i,
          denied,
          i.version,
          { kind: 'acknowledge' },
          start,
          true,
        ),
      ).toThrow('DENIED');
    expect(() =>
      transitionIncident(i, actor, 9, { kind: 'acknowledge' }, start, true),
    ).toThrow('CONFLICT');
    const triage = step(step(i, 'acknowledge'), 'triage');
    expect(() =>
      transitionIncident(
        triage,
        actor,
        triage.version,
        { kind: 'start_work' },
        start,
        false,
      ),
    ).toThrow('CONFLICT');
    expect(() =>
      transitionIncident(
        i,
        actor,
        i.version,
        { kind: 'accept_handoff' },
        start,
        true,
      ),
    ).toThrow('DENIED');
  });
  it('monitoring recovery alone does not authorise resolution or closure', () => {
    const i = {
      ...operation(),
      state: 'restoration_validation' as const,
      recoveryObservedAt: start,
    };
    expect(() =>
      transitionIncident(i, actor, i.version, { kind: 'resolve' }, start, true),
    ).toThrow('CONFLICT');
    expect(() =>
      transitionIncident(i, actor, i.version, { kind: 'close' }, start, true),
    ).toThrow('CONFLICT');
  });
});
