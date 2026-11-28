import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  OperationService,
  operationCommand,
  parseGateFields,
} from '../../src/application/operations/service';
import type {
  OperationAggregate,
  OperationCommand,
  OperationDependencies,
  OperationFacts,
  OperationReceipt,
  OperationKind,
  GateRecord,
  NativeConfirmation,
} from '../../src/application/operations/contracts';
import type { TenantContext } from '../../src/application/ports/tenant-context';
import type { Incident } from '../../src/domain/incidents/model';
import type { WorkflowActor } from '../../src/domain/incidents/workflow';
const id = (n: number) =>
  `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const tenant = id(1),
  incidentId = id(2),
  noc = id(3),
  department = id(4),
  gateId = id(5);
const ctx: TenantContext = {
  installationId: 'synthetic-installation',
  tenantId: tenant,
  actor: { kind: 'atlassian-user', accountId: 'synthetic-operator' },
};
const startedAt = '2026-11-27T00:00:00.000Z';
const snapshot = {
  policyId: id(6),
  policyVersion: 1,
  tierId: id(7),
  consideredTierIds: [id(7)],
  priority: 'P1' as const,
  severity: '5',
  confidence: 'known' as const,
  reason: 'STRICTEST_AFFECTED_TIER' as const,
  clock: 'elapsed-utc' as const,
  startedAt,
  durationSeconds: 3600,
  warningSeconds: 2700,
  warningAt: '2026-11-27T00:45:00.000Z',
  deadlineAt: '2026-11-27T01:00:00.000Z',
};
function fixture() {
  let row: OperationAggregate | null = null,
    actor: WorkflowActor = {
      tenantId: tenant,
      role: 'operator',
      teamId: noc,
      assigneeId: id(14),
      nocTeamId: noc,
    };
  let now = '2026-11-27T00:10:00.000Z';
  let currentFacts: OperationFacts = { revision: 1, recoveryObservedAt: null };
  const receipts = new Map<string, OperationReceipt>();
  const audits: unknown[] = [];
  let enriched: Incident = {
    id: incidentId,
    installationId: ctx.installationId,
    tenantId: tenant,
    sourceId: id(8),
    problemEventId: '100',
    correlationId: id(9),
    createdAt: startedAt,
    occurredAt: startedAt,
    state: 'new',
    version: 1,
    sla: { kind: 'selected', snapshot },
    impact: {
      confidence: 'known',
      reason: 'COMPLETE',
      siteId: id(10),
      uplinkId: id(11),
      carrierId: id(12),
      affectedServiceIds: [],
      affectedCustomerIds: [],
      potentiallyAffectedCustomerIds: [],
      potentiallyAffectedServiceIds: [],
      protectedServiceIds: [],
      uncertainServiceIds: [],
      tierIds: [id(7)],
    },
  };
  const templates: Partial<Record<OperationKind, GateRecord['template']>> = {
    start_work: 'operational',
    request_handoff: 'operational',
    accept_handoff: 'operational',
    request_validation: 'remediation',
    request_return: 'remediation',
    return_to_noc: 'remediation',
    accept_return: 'remediation',
    validate_restoration: 'restoration',
    resolve: 'closure',
    close: 'closure',
  };
  const required = {
    operational: [
      'diagnosticFindings',
      'escalationJustification',
      'supportingEvidence',
      'receivingCapability',
      'accountableEngineer',
      'outstandingActions',
    ],
    remediation: ['workCompleted', 'supportingEvidence', 'outstandingActions'],
    restoration: [
      'restorationEvidence',
      'impactReassessed',
      'outstandingActions',
      'validatorRecorded',
    ],
    closure: [
      'closureEvidence',
      'outstandingActions',
      'nativePermissionConfirmed',
    ],
  } as const;
  const gate = (
    aggregate: OperationAggregate,
    kind: OperationKind,
  ): GateRecord => {
    const record: GateRecord = {
      installationId: ctx.installationId,
      tenantId: tenant,
      incidentId,
      id: gateId,
      template: templates[kind]!,
      templateVersion: 1,
      incidentVersion: aggregate.incident.version,
      factsVersion: currentFacts.revision,
      evaluatedAt: now,
      validUntil: '2026-11-27T00:30:00.000Z',
      fields: {
        diagnosticFindings: 'Synthetic diagnostics',
        escalationJustification: 'Synthetic justification',
        supportingEvidence: 'Synthetic reviewed evidence',
        receivingCapability: true,
        accountableEngineer: true,
        outstandingActions: 'All actions completed or explicitly dispositioned',
        workCompleted: 'Synthetic repair completed',
        restorationEvidence: 'Validated synthetic service diagnostics',
        impactReassessed: true,
        validatorRecorded: true,
        closureEvidence: 'Synthetic closure review',
        nativePermissionConfirmed: true,
      },
    };
    return {
      ...record,
      fields: Object.fromEntries(
        required[record.template].map((key) => [key, record.fields[key]]),
      ),
    };
  };
  const deps: OperationDependencies = {
    repository: {
      enriched: vi.fn(async () => enriched),
      load: vi.fn(async () => row),
      initialise: vi.fn(async (_ctx, aggregate) => row ?? (row = aggregate)),
      facts: vi.fn(async () => currentFacts),
      receipt: vi.fn(
        async (_ctx, _incident, command) => receipts.get(command) ?? null,
      ),
      save: vi.fn(async (_ctx, expected, aggregate) => {
        if (!row || row.incident.version !== expected || row.pending)
          return false;
        row = aggregate;
        return true;
      }),
      materialise: vi.fn(async (_ctx, _id, command) => {
        if (!row?.pending || row.pending.receipt.commandId !== command)
          return false;
        receipts.set(command, row.pending.receipt);
        audits.push(row.pending.audit);
        row = { ...row, pending: null };
        return true;
      }),
      saveGate: vi.fn(async () => true),
      gate: vi.fn(async (_ctx, aggregate, kind) => gate(aggregate, kind)),
      nativeConfirmation: vi.fn(async () => null),
    },
    authorise: vi.fn(async () => actor),
    now: () => now,
    id: randomUUID,
    digest: (value) => createHash('sha256').update(value).digest('hex'),
  };
  const service = new OperationService(deps);
  const command = (
    kind: OperationCommand['kind'],
    extra: Record<string, unknown> = {},
  ) => ({
    commandId: randomUUID(),
    incidentId,
    expected: row?.incident.version ?? 0,
    kind,
    ...extra,
  });
  async function execute(
    kind: OperationCommand['kind'],
    extra: Record<string, unknown> = {},
  ) {
    return service.execute(ctx, command(kind, extra));
  }
  return {
    deps,
    service,
    get enriched() {
      return enriched;
    },
    setEnriched(value: Partial<Incident>) {
      enriched = { ...enriched, ...value };
    },
    receipts,
    audits,
    command,
    execute,
    gate,
    get row() {
      return row;
    },
    setRow(value: OperationAggregate | null) {
      row = value;
    },
    setActor(value: Partial<WorkflowActor>) {
      actor = { ...actor, ...value };
    },
    setFacts(value: OperationFacts) {
      currentFacts = value;
    },
    setNow(value: string) {
      now = value;
    },
    native(kind: 'resolve' | 'close'): NativeConfirmation {
      return {
        installationId: ctx.installationId,
        tenantId: tenant,
        incidentId,
        operation: kind,
        expectedVersion: row!.incident.version,
        intentId: id(13),
        issueId: '100',
        confirmedAt: now,
        gateId,
      };
    },
  };
}
async function working(f: ReturnType<typeof fixture>) {
  await f.execute('initialise');
  await f.execute('acknowledge');
  await f.execute('triage');
  await f.execute('start_work');
}
describe('durable operations application with synthetic repository', () => {
  it('initialises selected-SLA incident under configured NOC with durable audit and receipt', async () => {
    const f = fixture();
    const result = await f.execute('initialise');
    expect(result).toMatchObject({
      incidentId,
      state: 'new',
      ownerTeamId: noc,
      version: 1,
      pendingMaterialisation: false,
    });
    expect(f.row?.incident.sla).toBe(snapshot);
    expect(f.audits).toHaveLength(1);
    expect(f.receipts.size).toBe(1);
  });
  it('preserves SLA through direct NOC work and requires confirmed native resolve/close', async () => {
    const f = fixture();
    await working(f);
    await f.execute('request_validation');
    await f.execute('validate_restoration');
    await expect(f.execute('resolve')).rejects.toThrow('NOT_READY');
    vi.mocked(f.deps.repository.nativeConfirmation).mockImplementation(
      async (_ctx, _id, kind) => f.native(kind),
    );
    await f.execute('resolve');
    expect(f.row?.incident.resolvedAt).toBe('2026-11-27T00:10:00.000Z');
    await f.execute('close');
    expect(f.row?.incident.state).toBe('closed');
    expect(f.row?.incident.sla).toBe(snapshot);
  });
  it('retains origin ownership pending handoff, requires rejection reason and records accepted transfer', async () => {
    const f = fixture();
    await working(f);
    await f.execute('request_handoff', { targetTeamId: department });
    expect(f.row?.incident.ownerTeamId).toBe(noc);
    f.setActor({ teamId: department });
    await expect(f.execute('reject_handoff')).rejects.toThrow('INVALID');
    await f.execute('reject_handoff', {
      reason: 'Missing synthetic diagnostics',
    });
    expect(f.row?.incident.ownerTeamId).toBe(noc);
    f.setActor({ teamId: noc });
    await f.execute('request_handoff', { targetTeamId: department });
    f.setActor({ teamId: department });
    await f.execute('accept_handoff');
    expect(f.row?.incident.ownerTeamId).toBe(department);
    expect(f.audits).toContainEqual(
      expect.objectContaining({
        action: 'accept_handoff',
        fromOwner: noc,
        toOwner: department,
        slaDeadlineAt: snapshot.deadlineAt,
      }),
    );
  });
  it('retains departmental accountability until explicit NOC accept; rejects return without transfer', async () => {
    const f = fixture();
    await working(f);
    await f.execute('request_handoff', { targetTeamId: department });
    f.setActor({ teamId: department });
    await f.execute('accept_handoff');
    await f.execute('return_to_noc');
    expect(f.row?.incident.ownerTeamId).toBe(department);
    expect(f.row?.incident.pendingReturn).not.toBeNull();
    await expect(f.execute('request_validation')).rejects.toThrow('CONFLICT');
    f.setActor({ teamId: noc });
    await f.execute('reject_return', {
      reason: 'Incomplete impact verification',
    });
    expect(f.row?.incident.ownerTeamId).toBe(department);
    f.setActor({ teamId: department });
    await f.execute('request_return');
    f.setActor({ teamId: noc });
    await f.execute('accept_return');
    expect(f.row?.incident).toMatchObject({
      state: 'restoration_validation',
      ownerTeamId: noc,
      pendingReturn: null,
    });
    expect(f.row?.incident.sla).toBe(snapshot);
  });
  it('returns the recorded result on exact command replay and rejects content reuse', async () => {
    const f = fixture();
    const command = f.command('initialise');
    const first = await f.service.execute(ctx, command);
    expect(await f.service.execute(ctx, command)).toEqual(first);
    expect(f.audits).toHaveLength(1);
    await expect(
      f.service.execute(ctx, { ...command, expected: 1 }),
    ).rejects.toThrow('CONFLICT');
    expect(f.deps.authorise).toHaveBeenCalledTimes(3);
  });
  it('retains pending envelope on projection failure, blocks new commands, resumes same command', async () => {
    const f = fixture();
    vi.mocked(f.deps.repository.materialise).mockRejectedValueOnce(
      new Error('private'),
    );
    const command = f.command('initialise');
    expect((await f.service.execute(ctx, command)).pendingMaterialisation).toBe(
      true,
    );
    expect(f.row?.pending).not.toBeNull();
    await expect(f.execute('acknowledge')).rejects.toThrow('REPAIR_REQUIRED');
    expect((await f.service.execute(ctx, command)).pendingMaterialisation).toBe(
      false,
    );
    expect(f.audits).toHaveLength(1);
  });
  it('prevents two stale parallel commands, source/system mutation, viewer and revoked authority', async () => {
    const f = fixture();
    await f.execute('initialise');
    const a = f.command('acknowledge'),
      b = f.command('acknowledge');
    const results = await Promise.allSettled([
      f.service.execute(ctx, a),
      f.service.execute(ctx, b),
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    for (const actor of [
      { kind: 'system' as const },
      { kind: 'monitoring-source' as const, sourceId: id(8) },
    ])
      await expect(
        f.service.execute({ ...ctx, actor }, f.command('triage')),
      ).rejects.toThrow('DENIED');
    f.setActor({ role: 'viewer' });
    await expect(f.execute('triage')).rejects.toThrow('DENIED');
    vi.mocked(f.deps.authorise).mockRejectedValueOnce(new Error('DENIED'));
    await expect(f.execute('triage')).rejects.toThrow('DENIED');
  });
  it('denies cross-tenant actors, aggregate/config references and source snapshots', async () => {
    const f = fixture();
    f.setActor({ tenantId: id(99) });
    await expect(f.execute('initialise')).rejects.toThrow('DENIED');
    f.setActor({ tenantId: tenant, teamId: department });
    await expect(f.execute('initialise')).rejects.toThrow('DENIED');
    f.setActor({ teamId: noc });
    f.setEnriched({ tenantId: id(99) });
    await expect(f.execute('initialise')).rejects.toThrow('DENIED');
    f.setEnriched({ tenantId: tenant });
    await f.execute('initialise');
    f.setRow({ ...f.row!, installationId: 'foreign' });
    await expect(f.execute('acknowledge')).rejects.toThrow('DENIED');
  });
  it('requires selected SLA, valid current facts and no unexplained leases', async () => {
    const f = fixture();
    f.setEnriched({ sla: { kind: 'manual_triage', reason: 'POLICY_GAP' } });
    await expect(f.execute('initialise')).rejects.toThrow('NOT_READY');
    f.setEnriched({ sla: { kind: 'selected', snapshot } });
    f.setFacts({ revision: 1, recoveryObservedAt: '2026-11-27T02:00:00.000Z' });
    await expect(f.execute('initialise')).rejects.toThrow('NOT_READY');
    f.setFacts({ revision: 1, recoveryObservedAt: null });
    await f.execute('initialise');
    f.setRow({
      ...f.row!,
      lease: { token: id(50), until: '2026-11-27T00:15:00.000Z' },
    });
    await expect(f.execute('acknowledge')).rejects.toThrow('CONFLICT');
    f.setRow({ ...f.row!, lease: { token: id(50), until: startedAt } });
    await expect(f.execute('acknowledge')).rejects.toThrow('REPAIR_REQUIRED');
  });
  it('never equates recovery observation with restoration validation or closure', async () => {
    const f = fixture();
    await working(f);
    f.setFacts({ revision: 2, recoveryObservedAt: startedAt });
    await expect(f.execute('resolve')).rejects.toThrow();
    expect(f.row?.incident.state).toBe('in_progress');
    expect(f.row?.incident.resolvedAt).toBeNull();
    await f.execute('request_validation');
    await expect(f.execute('resolve')).rejects.toThrow('CONFLICT');
  });
  it('evaluates stored checklist template/version/facts/freshness and typed required evidence', async () => {
    const f = fixture();
    await f.execute('initialise');
    await f.execute('acknowledge');
    await f.execute('triage');
    const valid = f.gate(f.row!, 'start_work');
    for (const change of [
      { template: 'closure' },
      { templateVersion: 2 },
      { incidentVersion: 0 },
      { factsVersion: 99 },
      { evaluatedAt: '2026-11-27T02:00:00.000Z' },
      { validUntil: startedAt },
    ]) {
      vi.mocked(f.deps.repository.gate).mockResolvedValueOnce({
        ...valid,
        ...change,
      } as GateRecord);
      await expect(f.execute('start_work')).rejects.toThrow('CONFLICT');
    }
    vi.mocked(f.deps.repository.gate).mockResolvedValueOnce(null);
    await expect(f.execute('start_work')).rejects.toThrow('NOT_READY');
    vi.mocked(f.deps.repository.gate).mockResolvedValueOnce({
      ...valid,
      tenantId: id(99),
    });
    await expect(f.execute('start_work')).rejects.toThrow('DENIED');
    for (const fields of [
      { ...valid.fields, receivingCapability: false },
      { ...valid.fields, supportingEvidence: '' },
    ]) {
      vi.mocked(f.deps.repository.gate).mockResolvedValueOnce({
        ...valid,
        fields,
      });
      await expect(f.execute('start_work')).rejects.toThrow();
    }
    expect(f.row?.incident.state).toBe('triage');
  });
  it('requires fresh final validation and exact confirmed native gate/version/binding', async () => {
    const f = fixture();
    await working(f);
    await f.execute('request_validation');
    await f.execute('validate_restoration');
    const valid = f.native('resolve');
    for (const change of [
      { expectedVersion: 1 },
      { gateId: id(99) },
      { incidentId: id(99) },
      { operation: 'close' },
      { issueId: 'unsafe' },
      { confirmedAt: '2026-11-27T02:00:00.000Z' },
      { confirmedAt: startedAt },
    ]) {
      vi.mocked(f.deps.repository.nativeConfirmation).mockResolvedValueOnce({
        ...valid,
        ...change,
      } as NativeConfirmation);
      await expect(f.execute('resolve')).rejects.toThrow('CONFLICT');
    }
    vi.mocked(f.deps.repository.nativeConfirmation).mockResolvedValueOnce({
      ...valid,
      tenantId: id(99),
    });
    await expect(f.execute('resolve')).rejects.toThrow('DENIED');
    f.setFacts({ revision: 2, recoveryObservedAt: startedAt });
    await expect(f.execute('resolve')).rejects.toThrow('CONFLICT');
    f.setFacts({ revision: 1, recoveryObservedAt: null });
    f.setNow('2026-11-27T00:31:00.000Z');
    await expect(f.execute('resolve')).rejects.toThrow('CONFLICT');
  });
  it('requires matching expected revision and atomic repository CAS', async () => {
    const f = fixture();
    await expect(f.execute('acknowledge')).rejects.toThrow('NOT_READY');
    await f.execute('initialise');
    await expect(f.execute('acknowledge', { expected: 0 })).rejects.toThrow(
      'CONFLICT',
    );
    vi.mocked(f.deps.repository.save).mockResolvedValueOnce(false);
    await expect(f.execute('acknowledge')).rejects.toThrow('CONFLICT');
    expect(f.row?.incident.state).toBe('new');
    await expect(f.execute('initialise')).rejects.toThrow('CONFLICT');
  });
  it('validates unknown commands and rejects privileged caller fields or missing rejection reason', () => {
    for (const value of [
      null,
      [],
      {},
      { commandId: randomUUID(), incidentId, expected: 0, kind: 'unknown' },
      { ...fixture().command('acknowledge'), gatePassed: true },
      { ...fixture().command('acknowledge'), actor: 'admin' },
      { ...fixture().command('acknowledge'), targetTeamId: department },
      { ...fixture().command('acknowledge'), reason: 'override' },
      fixture().command('reject_return'),
    ])
      expect(() => operationCommand(value)).toThrow('INVALID');
    expect(
      operationCommand(
        fixture().command('request_handoff', { targetTeamId: department }),
      ),
    ).toMatchObject({ targetTeamId: department });
  });
});

it('does not silently reroute an existing incident when configured NOC changes', async () => {
  const f = fixture();
  await f.execute('initialise');
  f.setActor({ nocTeamId: id(99) });
  await expect(f.execute('acknowledge')).rejects.toThrow('CONFLICT');
  expect(f.row?.incident.ownerTeamId).toBe(noc);
});

it('records only server-bound current checklist results with a bounded five-minute lifetime', async () => {
  const f = fixture();
  await working(f);
  const fields = f.gate(f.row!, 'request_handoff').fields;
  const result = await f.service.recordChecklist(ctx, {
    incidentId,
    kind: 'request_handoff',
    expected: f.row!.incident.version,
    fields,
  });
  expect(result.validUntil).toBe('2026-11-27T00:15:00.000Z');
  expect(f.deps.repository.saveGate).toHaveBeenCalledWith(
    ctx,
    expect.objectContaining({
      incidentId,
      template: 'operational',
      templateVersion: 1,
      factsVersion: 1,
      incidentVersion: f.row!.incident.version,
      fields,
    }),
  );
  expect(result.gateId).not.toBe(gateId);
  expect(f.row!.incident.state).toBe('in_progress');
  vi.mocked(f.deps.repository.saveGate).mockResolvedValueOnce(false);
  await expect(
    f.service.recordChecklist(ctx, {
      incidentId,
      kind: 'request_handoff',
      expected: f.row!.incident.version,
      fields,
    }),
  ).rejects.toThrow('CONFLICT');
});
it('denies checklist source actors, stale versions, nonowners, pending materialisation and privileged input', async () => {
  const f = fixture();
  await working(f);
  const fields = f.gate(f.row!, 'request_handoff').fields;
  const input = {
    incidentId,
    kind: 'request_handoff',
    expected: f.row!.incident.version,
    fields,
  };
  for (const bad of [
    null,
    { ...input, gatePassed: true },
    { ...input, kind: 'acknowledge' },
    { ...input, expected: 0 },
  ])
    await expect(f.service.recordChecklist(ctx, bad)).rejects.toThrow();
  await expect(
    f.service.recordChecklist({ ...ctx, actor: { kind: 'system' } }, input),
  ).rejects.toThrow('DENIED');
  f.setActor({ teamId: department });
  await expect(f.service.recordChecklist(ctx, input)).rejects.toThrow('DENIED');
  f.setActor({ teamId: noc });
  await expect(
    f.service.recordChecklist(ctx, { ...input, expected: 1 }),
  ).rejects.toThrow('CONFLICT');
  vi.mocked(f.deps.repository.materialise).mockResolvedValueOnce(false);
  await f.execute('request_handoff', { targetTeamId: department });
  await expect(
    f.service.recordChecklist(ctx, {
      ...input,
      expected: f.row!.incident.version,
    }),
  ).rejects.toThrow('REPAIR_REQUIRED');
});
it('projects exact checklist fields and never turns a false or missing attestation into a pass', () => {
  const f = fixture();
  const fields = f.gate(
    { incident: { version: 1 } } as OperationAggregate,
    'start_work',
  ).fields;
  expect(parseGateFields('operational', fields)).toEqual(fields);
  for (const input of [
    null,
    [],
    {},
    { ...fields, gatePassed: true },
    { ...fields, receivingCapability: false },
    { ...fields, supportingEvidence: '\n' },
    { ...fields, supportingEvidence: 'x'.repeat(1001) },
  ])
    expect(() => parseGateFields('operational', input)).toThrow();
  expect(() =>
    parseGateFields('unknown' as GateRecord['template'], fields),
  ).toThrow('INVALID');
});
it('requires receiver authority and a fresh current operational gate on handoff acceptance', async () => {
  const f = fixture();
  await working(f);
  await f.execute('request_handoff', { targetTeamId: department });
  const fields = f.gate(f.row!, 'accept_handoff').fields;
  await expect(
    f.service.recordChecklist(ctx, {
      incidentId,
      kind: 'accept_handoff',
      expected: f.row!.incident.version,
      fields,
    }),
  ).rejects.toThrow('DENIED');
  f.setActor({ teamId: department });
  await f.service.recordChecklist(ctx, {
    incidentId,
    kind: 'accept_handoff',
    expected: f.row!.incident.version,
    fields,
  });
  vi.mocked(f.deps.repository.gate).mockResolvedValueOnce(null);
  await expect(f.execute('accept_handoff')).rejects.toThrow('NOT_READY');
  expect(f.row!.incident.ownerTeamId).toBe(noc);
  await f.execute('accept_handoff');
  expect(f.row!.incident.ownerTeamId).toBe(department);
});
it('rejects pending envelopes whose receipt/audit/result linkage is inconsistent', async () => {
  const f = fixture();
  vi.mocked(f.deps.repository.materialise).mockResolvedValueOnce(false);
  const input = f.command('initialise');
  await f.service.execute(ctx, input);
  const current = f.row!;
  const pending = current.pending!;
  f.setRow({
    ...current,
    pending: { ...pending, audit: { ...pending.audit, commandId: id(99) } },
  });
  await expect(f.service.execute(ctx, input)).rejects.toThrow('INVALID');
});

it('assigns accountable mapped engineer on acknowledgement and preserves assignment until accepted transfer', async () => {
  const f = fixture();
  await f.execute('initialise');
  expect(f.row!.incident.ownerAssigneeId).toBeNull();
  await f.execute('acknowledge');
  expect(f.row!.incident.ownerAssigneeId).toBe(id(14));
  f.setActor({ assigneeId: id(15) });
  await expect(f.execute('triage')).rejects.toThrow('DENIED');
  f.setActor({ assigneeId: id(14) });
  await f.execute('triage');
  await f.execute('start_work');
  await f.execute('request_handoff', { targetTeamId: department });
  expect(f.row!.incident.ownerAssigneeId).toBe(id(14));
  f.setActor({ teamId: department, assigneeId: id(15) });
  await f.execute('reject_handoff', { reason: 'Need more synthetic evidence' });
  expect(f.row!.incident.ownerAssigneeId).toBe(id(14));
  f.setActor({ teamId: noc, assigneeId: id(14) });
  await f.execute('request_handoff', { targetTeamId: department });
  f.setActor({ teamId: department, assigneeId: id(15) });
  await f.execute('accept_handoff');
  expect(f.row!.incident.ownerAssigneeId).toBe(id(15));
  await f.execute('request_return');
  expect(f.row!.incident.ownerAssigneeId).toBe(id(15));
  f.setActor({ teamId: noc, assigneeId: id(16) });
  await f.execute('accept_return');
  expect(f.row!.incident.ownerAssigneeId).toBe(id(16));
  expect(f.audits).toContainEqual(
    expect.objectContaining({
      action: 'accept_return',
      fromAssigneeId: id(15),
      toAssigneeId: id(16),
      assigneeId: id(16),
    }),
  );
});

it('allows a fresh team lead or administrator to reassign with immutable SLA and explicit audit', async () => {
  for (const privilege of [
    { teamRole: 'lead' as const },
    { role: 'admin' as const },
  ]) {
    const f = fixture();
    await working(f);
    await f.execute('request_validation');
    await f.execute('validate_restoration');
    const before = f.row!;
    f.setActor({ ...privilege, assigneeId: id(16) });
    const input = f.command('assign', {
      targetAssigneeId: id(17),
      reason: 'Reviewed synthetic on-call responsibility transfer',
    });
    const result = await f.service.execute(ctx, input);
    expect(result).toMatchObject({
      version: before.incident.version + 1,
      state: before.incident.state,
      ownerTeamId: noc,
      ownerAssigneeId: id(17),
    });
    expect(f.row!.incident.sla).toBe(snapshot);
    expect(f.row!.incident.restorationValidatedAt).toBeNull();
    expect(f.row!.validation).toBeNull();
    expect(f.audits).toContainEqual(
      expect.objectContaining({
        action: 'assign',
        assigneeId: id(16),
        targetAssigneeId: id(17),
        fromAssigneeId: id(14),
        toAssigneeId: id(17),
        fromOwner: noc,
        toOwner: noc,
        reason: 'Reviewed synthetic on-call responsibility transfer',
        slaStartedAt: snapshot.startedAt,
        slaDeadlineAt: snapshot.deadlineAt,
      }),
    );
    expect(f.deps.authorise).toHaveBeenLastCalledWith(
      ctx,
      expect.objectContaining({
        kind: 'assign',
        targetAssigneeId: id(17),
        reason: 'Reviewed synthetic on-call responsibility transfer',
      }),
    );
    const count = f.audits.length;
    expect(await f.service.execute(ctx, input)).toEqual(result);
    expect(f.audits).toHaveLength(count);
    await expect(
      f.service.execute(ctx, { ...input, targetAssigneeId: id(18) }),
    ).rejects.toThrow('CONFLICT');
    f.setActor({ assigneeId: id(14) });
    await expect(f.execute('validate_restoration')).rejects.toThrow('DENIED');
  }
});
it('does not grant assignment to a normal engineer or a missing team role, even the current engineer', async () => {
  const f = fixture();
  await working(f);
  for (const actor of [
    { teamRole: undefined },
    { teamRole: 'engineer' as const },
  ]) {
    if (actor.teamRole === undefined) f.setActor({ role: 'operator' });
    else f.setActor({ teamRole: actor.teamRole });
    await expect(
      f.execute('assign', {
        targetAssigneeId: id(17),
        reason: 'Synthetic transfer',
      }),
    ).rejects.toThrow('DENIED');
  }
  f.setActor({ role: 'admin', teamId: department });
  await expect(
    f.execute('assign', {
      targetAssigneeId: id(17),
      reason: 'Synthetic transfer',
    }),
  ).rejects.toThrow('DENIED');
  expect(f.row!.incident.ownerAssigneeId).toBe(id(14));
});
it('denies inactive/foreign target authority, stale versions and unsettled transfer boundaries', async () => {
  const f = fixture();
  await working(f);
  f.setActor({ teamRole: 'lead' });
  vi.mocked(f.deps.authorise).mockRejectedValueOnce(new Error('DENIED'));
  const writes = vi.mocked(f.deps.repository.save).mock.calls.length;
  await expect(
    f.execute('assign', {
      targetAssigneeId: id(99),
      reason: 'Synthetic foreign target',
    }),
  ).rejects.toThrow('DENIED');
  expect(vi.mocked(f.deps.repository.save).mock.calls.length).toBe(writes);
  await expect(
    f.execute('assign', {
      targetAssigneeId: id(17),
      reason: 'Synthetic transfer',
      expected: 1,
    }),
  ).rejects.toThrow('CONFLICT');
  await f.execute('request_handoff', { targetTeamId: department });
  await expect(
    f.execute('assign', {
      targetAssigneeId: id(17),
      reason: 'Synthetic transfer',
    }),
  ).rejects.toThrow('CONFLICT');
  f.setActor({ teamId: department, assigneeId: id(15) });
  await f.execute('accept_handoff');
  await f.execute('request_return');
  await expect(
    f.execute('assign', {
      targetAssigneeId: id(17),
      reason: 'Synthetic transfer',
    }),
  ).rejects.toThrow('CONFLICT');
});
it('strictly parses assignment target and reason and rejects caller authority or mixed target types', () => {
  const valid = fixture().command('assign', {
    targetAssigneeId: id(17),
    reason: 'Synthetic transfer',
  });
  expect(operationCommand(valid)).toMatchObject({
    kind: 'assign',
    targetAssigneeId: id(17),
    reason: 'Synthetic transfer',
  });
  for (const bad of [
    { ...valid, targetAssigneeId: undefined },
    { ...valid, targetAssigneeId: [id(17)] },
    { ...valid, reason: undefined },
    { ...valid, reason: '' },
    { ...valid, reason: 'x'.repeat(301) },
    { ...valid, targetTeamId: department },
    { ...valid, actor: { role: 'admin' } },
    { ...valid, teamRole: 'lead' },
    { ...valid, kind: 'triage' },
    { ...valid, kind: 'initialise' },
  ])
    expect(() => operationCommand(bad)).toThrow('INVALID');
});
it('blocks reassigning an unacknowledged queue, terminal record, no-op target or unresolved command envelope', async () => {
  const f = fixture();
  await f.execute('initialise');
  f.setActor({ teamRole: 'lead' });
  await expect(
    f.execute('assign', {
      targetAssigneeId: id(17),
      reason: 'Synthetic transfer',
    }),
  ).rejects.toThrow('CONFLICT');
  await f.execute('acknowledge');
  await expect(
    f.execute('assign', {
      targetAssigneeId: id(14),
      reason: 'Synthetic no-op',
    }),
  ).rejects.toThrow('CONFLICT');
  f.setRow({
    ...f.row!,
    incident: { ...f.row!.incident, state: 'resolved', resolvedAt: startedAt },
  });
  await expect(
    f.execute('assign', {
      targetAssigneeId: id(17),
      reason: 'Synthetic terminal transfer',
    }),
  ).rejects.toThrow('CONFLICT');
  f.setRow({
    ...f.row!,
    incident: { ...f.row!.incident, state: 'acknowledged', resolvedAt: null },
  });
  vi.mocked(f.deps.repository.materialise).mockResolvedValueOnce(false);
  await f.execute('assign', {
    targetAssigneeId: id(17),
    reason: 'Synthetic transfer',
  });
  await expect(
    f.execute('assign', {
      targetAssigneeId: id(18),
      reason: 'Another transfer',
    }),
  ).rejects.toThrow('REPAIR_REQUIRED');
});
