// @vitest-environment jsdom
// Synthetic Bridge/React tests; never native workflow or permission acceptance.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { Operations } from '../../static/app/src/Operations';
import {
  checklistResult,
  operationExecution,
  operationMutation,
  operationsOverview,
  type PublicOperation,
} from '../../static/app/src/operations-contract';
vi.mock('@forge/bridge', () => ({ invoke: vi.fn() }));
import { invoke } from '@forge/bridge';
const call = vi.mocked(invoke);
const id = (n: number) =>
  `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const tenant = id(1),
  incidentId = id(2),
  noc = id(3),
  department = id(4),
  engineer = id(5),
  correlation = id(6),
  gateId = id(7);
const start = '2026-11-27T00:00:00.000Z';
const snapshot = {
  policyId: id(8),
  policyVersion: 1,
  tierId: id(9),
  consideredTierIds: [id(9)],
  priority: 'P1' as const,
  severity: '5',
  confidence: 'known' as const,
  reason: 'STRICTEST_AFFECTED_TIER' as const,
  clock: 'elapsed-utc' as const,
  startedAt: start,
  durationSeconds: 3600,
  warningSeconds: 2700,
  warningAt: '2026-11-27T00:45:00.000Z',
  deadlineAt: '2026-11-27T01:00:00.000Z',
};
const operation = (patch: Partial<PublicOperation> = {}): PublicOperation => ({
  id: incidentId,
  state: 'in_progress',
  version: 4,
  ownerTeamId: noc,
  ownerAssigneeId: engineer,
  nocTeamId: noc,
  pendingHandoff: null,
  pendingReturn: null,
  recoveryObservedAt: null,
  restorationValidatedAt: null,
  resolvedAt: null,
  sla: snapshot,
  factsVersion: 1,
  pendingMaterialisation: false,
  nativeClosureAvailable: false,
  ...patch,
});
const envelope = (value: unknown) => ({
  ok: true,
  value,
  correlationId: correlation,
});
let current: {
  operation: PublicOperation | null;
  configuration: { nocTeamId: string; version: number } | null;
};
let gateUntil: string;
beforeEach(() => {
  current = {
    operation: operation(),
    configuration: { nocTeamId: noc, version: 1 },
  };
  gateUntil = new Date(Date.now() + 300000).toISOString();
  call.mockReset();
  call.mockImplementation(async (_name, input) => {
    const data = input as Record<string, unknown>;
    if (data.action === 'overview') return envelope(current);
    if (data.action === 'checklist')
      return envelope({ gateId, validUntil: gateUntil });
    if (data.action === 'repair') return envelope({ completed: true });
    if (data.action === 'configure') return envelope({ saved: true });
    const command = data.command as { kind: string; expected: number };
    const state =
      command.kind === 'initialise'
        ? 'new'
        : command.kind === 'acknowledge'
          ? 'acknowledged'
          : command.kind === 'triage'
            ? 'triage'
            : command.kind === 'accept_return'
              ? 'restoration_validation'
              : (current.operation?.state ?? 'new');
    return envelope({
      incidentId,
      state,
      version: command.expected + 1,
      ownerTeamId:
        command.kind === 'accept_return'
          ? noc
          : (current.operation?.ownerTeamId ?? noc),
      ownerAssigneeId: state === 'new' ? null : engineer,
      correlationId: correlation,
      pendingMaterialisation: false,
    });
  });
});
afterEach(cleanup);
function mount(role: 'viewer' | 'operator' | 'admin' = 'operator') {
  render(<Operations tenantId={tenant} incidentId={incidentId} role={role} />);
}
async function load() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Load operational state' }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText('Operational status').textContent).toContain(
      'Operational state loaded.',
    ),
  );
}
function choose(kind: string) {
  fireEvent.change(screen.getByLabelText('Operational action'), {
    target: { value: kind },
  });
}
function fillOperational() {
  for (const label of [
    'Diagnostic findings',
    'Escalation or direct-work justification',
    'Reviewed supporting evidence',
    'Outstanding action completion or approved disposition',
  ])
    fireEvent.change(screen.getByLabelText(label), {
      target: { value: 'Synthetic reviewed evidence' },
    });
  for (const label of [
    'Receiving team capability reviewed',
    'Accountable engineer confirmed',
  ])
    fireEvent.click(screen.getByLabelText(label));
}
function fillRemediation() {
  for (const label of [
    'Remediation completed',
    'Reviewed supporting evidence',
    'Outstanding action completion or approved disposition',
  ])
    fireEvent.change(screen.getByLabelText(label), {
      target: { value: 'Synthetic repair reviewed' },
    });
}
const executes = () =>
  call.mock.calls.filter(
    ([, input]) => (input as { action: string }).action === 'execute',
  );
it('shows current accountable team/engineer and immutable deadlines with native closure disabled and explicit reassignment available', async () => {
  mount();
  await load();
  expect(screen.getAllByText(engineer)).toHaveLength(1);
  expect(screen.getByText(start + ' / ' + snapshot.deadlineAt)).toBeTruthy();
  for (const label of [
    'Resolve through confirmed Jira transition',
    'Close through confirmed Jira transition',
  ])
    expect(
      (screen.getByRole('button', { name: label }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  expect(
    screen.getByRole('option', { name: 'Reassign accountable engineer' }),
  ).toBeTruthy();
  expect(
    screen.getByText(/Native Jira transition confirmation is not available/),
  ).toBeTruthy();
});
it('does not render mutation controls to viewers or admin-only configuration to operators', async () => {
  mount('viewer');
  await load();
  expect(
    screen.queryByRole('button', { name: 'Execute operational action' }),
  ).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Save NOC configuration' }),
  ).toBeNull();
  expect(screen.queryByLabelText('Operational action')).toBeNull();
  cleanup();
  mount('operator');
  await load();
  expect(
    screen.queryByRole('button', { name: 'Save NOC configuration' }),
  ).toBeNull();
});
it('distinguishes a missing aggregate/configuration from a failed read and clears stale ownership while loading', async () => {
  mount();
  await load();
  let resolve: (result: unknown) => void = () => {};
  call.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Load operational state' }),
  );
  expect(screen.queryByText(engineer)).toBeNull();
  expect(
    (
      screen.getByRole('button', {
        name: 'Load operational state',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  resolve(envelope(current));
  await waitFor(() =>
    expect(screen.getByLabelText('Operational status').textContent).toContain(
      'Operational state loaded.',
    ),
  );
  cleanup();
  current = { operation: null, configuration: null };
  mount();
  await load();
  await screen.findByText(/No operational aggregate returned/);
  expect(
    (
      screen.getByRole('button', {
        name: 'Execute operational action',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  call.mockResolvedValueOnce({
    ok: false,
    code: 'NOT_READY',
    correlationId: correlation,
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Load operational state' }),
  );
  await screen.findByText(/Operations NOT_READY/);
  expect(screen.queryByText(/No operational aggregate returned/)).toBeNull();
});
it('initialises queue ownership without a caller actor and assigns only through the server response', async () => {
  current = { operation: null, configuration: { nocTeamId: noc, version: 1 } };
  mount();
  await load();
  expect(
    (screen.getByLabelText('Operational action') as HTMLSelectElement).value,
  ).toBe('initialise');
  fireEvent.click(
    screen.getByRole('button', { name: 'Execute operational action' }),
  );
  await screen.findByText(/Saved command completed/);
  const payload = executes()[0]![1] as { command: Record<string, unknown> };
  expect(payload.command).toMatchObject({
    incidentId,
    expected: 0,
    kind: 'initialise',
  });
  expect(payload.command).not.toHaveProperty('actor');
  expect(payload.command).not.toHaveProperty('gatePassed');
  expect(payload.command).not.toHaveProperty('ownerTeamId');
  expect(payload.command.commandId).toMatch(/^[0-9a-f-]{36}$/);
});
it('requires a fresh checklist, retains handoff selection across reload and sends exact typed fields', async () => {
  mount();
  await load();
  choose('request_handoff');
  fireEvent.change(screen.getByLabelText('Receiving team ID'), {
    target: { value: department },
  });
  expect(
    (
      screen.getByRole('button', {
        name: 'Execute operational action',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fillOperational();
  fireEvent.click(
    screen.getByRole('button', { name: 'Record operational checklist' }),
  );
  await screen.findByText(/Checklist recorded:/);
  await load();
  expect(
    (screen.getByLabelText('Operational action') as HTMLSelectElement).value,
  ).toBe('request_handoff');
  expect(
    (
      screen.getByRole('button', {
        name: 'Execute operational action',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  const checkpoint = call.mock.calls.find(
    ([, input]) => (input as { action: string }).action === 'checklist',
  )?.[1] as {
    checklist: {
      fields: Record<string, unknown>;
      kind: string;
      expected: number;
    };
  };
  expect(checkpoint.checklist.kind).toBe('request_handoff');
  expect(checkpoint.checklist.expected).toBe(4);
  expect(checkpoint.checklist.fields).toEqual({
    diagnosticFindings: 'Synthetic reviewed evidence',
    escalationJustification: 'Synthetic reviewed evidence',
    supportingEvidence: 'Synthetic reviewed evidence',
    receivingCapability: true,
    accountableEngineer: true,
    outstandingActions: 'Synthetic reviewed evidence',
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Execute operational action' }),
  );
  await screen.findByText(/Saved command completed/);
  expect((executes()[0]![1] as { command: unknown }).command).toMatchObject({
    kind: 'request_handoff',
    targetTeamId: department,
    expected: 4,
  });
});
it('invalidates a recorded checklist when the operation/evidence revision changes', async () => {
  current.operation = operation({ state: 'triage', version: 3 });
  mount();
  await load();
  fillOperational();
  fireEvent.click(
    screen.getByRole('button', { name: 'Record operational checklist' }),
  );
  await screen.findByText(/Checklist recorded:/);
  current.operation = operation({
    state: 'triage',
    version: 3,
    factsVersion: 2,
  });
  await load();
  expect(screen.queryByText(/Recorded checklist/)).toBeNull();
  expect(
    (
      screen.getByRole('button', {
        name: 'Execute operational action',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});
it('retains one command UUID and all original fields when an execute outcome is uncertain', async () => {
  current.operation = operation({
    state: 'new',
    version: 1,
    ownerAssigneeId: null,
  });
  mount();
  await load();
  call.mockRejectedValueOnce(new Error('PRIVATE_EXCEPTION_TEXT'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Execute operational action' }),
  );
  await screen.findByText(/unclassified rejection/);
  expect(screen.queryByText(/PRIVATE_EXCEPTION_TEXT/)).toBeNull();
  const first = (executes()[0]![1] as { command: unknown }).command;
  expect(
    screen.queryByRole('button', { name: 'Execute operational action' }),
  ).toBeNull();
  await load();
  fireEvent.click(
    screen.getByRole('button', { name: 'Retry exact saved command' }),
  );
  await screen.findByText(/Saved command completed/);
  expect((executes()[1]![1] as { command: unknown }).command).toEqual(first);
  expect(screen.queryByText(/Retained command ID:/)).toBeNull();
});
it('keeps pending accepted commands and allows admin projection-only repair', async () => {
  mount('admin');
  await load();
  choose('request_handoff');
  fillOperational();
  fireEvent.click(
    screen.getByRole('button', { name: 'Record operational checklist' }),
  );
  await screen.findByText(/Checklist recorded:/);
  await load();
  fireEvent.change(screen.getByLabelText('Receiving team ID'), {
    target: { value: department },
  });
  call.mockResolvedValueOnce(
    envelope({
      incidentId,
      state: 'in_progress',
      version: 5,
      ownerTeamId: noc,
      ownerAssigneeId: engineer,
      correlationId: correlation,
      pendingMaterialisation: true,
    }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Execute operational action' }),
  );
  await screen.findByText(/Saved projections remain pending/);
  current.operation = operation({
    version: 5,
    pendingMaterialisation: true,
    pendingHandoff: { targetTeamId: department, requestedAt: start },
  });
  await load();
  expect(
    screen.getByRole('button', { name: 'Retry exact saved command' }),
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole('button', { name: 'Repair saved command projections' }),
  );
  await screen.findByText(/Saved command projections completed/);
  expect(call).toHaveBeenCalledWith('operations', {
    action: 'repair',
    tenantId: tenant,
    incidentId,
  });
});
it('shows departmental ownership pending return, permits explicit rejection reason and then reflects NOC acceptance', async () => {
  current.operation = operation({
    ownerTeamId: department,
    ownerAssigneeId: id(10),
    pendingReturn: { fromTeamId: department, requestedAt: start },
  });
  mount();
  await load();
  expect(
    screen.getByText(/The department retains ownership until NOC acceptance/),
  ).toBeTruthy();
  expect(screen.getByText(id(10))).toBeTruthy();
  choose('reject_return');
  fireEvent.change(screen.getByLabelText('Rejection reason'), {
    target: { value: 'Impact verification remains outstanding' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Execute operational action' }),
  );
  await screen.findByText(/Saved command completed/);
  expect((executes()[0]![1] as { command: unknown }).command).toMatchObject({
    kind: 'reject_return',
    reason: 'Impact verification remains outstanding',
  });
  // A later departmental request has a fresh durable revision after rejection.
  current.operation = operation({
    version: 6,
    ownerTeamId: department,
    ownerAssigneeId: id(10),
    pendingReturn: { fromTeamId: department, requestedAt: start },
  });
  await load();
  choose('accept_return');
  fillRemediation();
  fireEvent.click(
    screen.getByRole('button', { name: 'Record operational checklist' }),
  );
  await screen.findByText(/Checklist recorded:/);
  await load();
  fireEvent.click(
    screen.getByRole('button', { name: 'Execute operational action' }),
  );
  await screen.findByText(/restoration_validation, version 7/);
  current.operation = operation({
    state: 'restoration_validation',
    version: 7,
  });
  await load();
  expect(screen.queryByText(/Return pending from/)).toBeNull();
  expect(screen.getByText(engineer)).toBeTruthy();
});
it('validates admin configuration and does not treat a changed NOC as an ownership transfer', async () => {
  mount('admin');
  await load();
  fireEvent.change(screen.getByLabelText('NOC team ID'), {
    target: { value: department },
  });
  fireEvent.change(
    screen.getByLabelText('Expected NOC configuration version'),
    { target: { value: '1' } },
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Save NOC configuration' }),
  );
  await screen.findByText(/NOC configuration saved/);
  expect(call).toHaveBeenCalledWith('operations', {
    action: 'configure',
    tenantId: tenant,
    configuration: { nocTeamId: department, version: 2 },
    expected: 1,
  });
  current.configuration = { nocTeamId: department, version: 2 };
  await load();
  expect(
    screen.getByText(/This incident retains its original NOC/),
  ).toBeTruthy();
  expect(screen.getByText(engineer)).toBeTruthy();
});
it('sanitises invalid resolved responses and precise backend conflicts', async () => {
  mount();
  call.mockResolvedValueOnce({
    ok: true,
    value: current,
    correlationId: 'unsafe',
  });
  await loadFailure(/Operational response contract failed/);
  call.mockResolvedValueOnce(
    envelope({ ...current, operation: { ...current.operation, id: id(99) } }),
  );
  await loadFailure(/Operational response contract failed/);
  call.mockResolvedValueOnce({
    ok: false,
    code: 'CONFLICT',
    correlationId: correlation,
  });
  await loadFailure(/Reload and reconcile/);
  call.mockResolvedValueOnce({
    ok: false,
    code: 'REPAIR_REQUIRED',
    correlationId: correlation,
  });
  await loadFailure(/saved command requires projection repair/);
});
async function loadFailure(pattern: RegExp) {
  fireEvent.click(
    screen.getByRole('button', { name: 'Load operational state' }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText('Operational status').textContent).toMatch(
      pattern,
    ),
  );
}
it('blocks incomplete checklist submissions and malformed target/rejection input locally', async () => {
  current.operation = operation({ state: 'triage', version: 3 });
  mount();
  await load();
  fireEvent.click(
    screen.getByRole('button', { name: 'Record operational checklist' }),
  );
  await screen.findByText(/Operational input invalid/);
  expect(
    call.mock.calls.some(
      ([, input]) => (input as { action: string }).action === 'checklist',
    ),
  ).toBe(false);
});
it('strictly projects public workflow results and rejects native-closure flags, foreign IDs and malformed snapshots', () => {
  expect(
    operationsOverview({ operation: null, configuration: null }, incidentId),
  ).toEqual({ operation: null, configuration: null });
  expect(
    operationsOverview(
      {
        operation: { ...operation(), private: 'not returned' },
        configuration: current.configuration,
      },
      incidentId,
    ).operation,
  ).not.toHaveProperty('private');
  for (const value of [
    { ...operation(), nativeClosureAvailable: true },
    { ...operation(), id: id(99) },
    { ...operation(), state: 'unsafe' },
    { ...operation(), pendingMaterialisation: 'false' },
    { ...operation(), ownerAssigneeId: null },
    { ...operation(), sla: { ...snapshot, warningAt: start } },
    { ...operation(), sla: { ...snapshot, consideredTierIds: [id(9), id(9)] } },
    {
      ...operation(),
      pendingHandoff: { targetTeamId: department, requestedAt: start },
      pendingReturn: { fromTeamId: noc, requestedAt: start },
    },
    {
      ...operation(),
      pendingReturn: { fromTeamId: department, requestedAt: start },
    },
  ])
    expect(() =>
      operationsOverview({ operation: value, configuration: null }, incidentId),
    ).toThrow();
  expect(() =>
    operationExecution({ incidentId: id(99) }, incidentId),
  ).toThrow();
  expect(() =>
    checklistResult({ gateId: 'unsafe', validUntil: start }),
  ).toThrow();
  expect(() => operationMutation('configure', { saved: false })).toThrow();
  expect(operationMutation('repair', { completed: false })).toContain(
    'remain pending',
  );
});

it('rejects a readback older than the last confirmed command instead of showing stale ownership', async () => {
  current.operation = operation({
    state: 'new',
    version: 1,
    ownerAssigneeId: null,
  });
  mount();
  await load();
  fireEvent.click(
    screen.getByRole('button', { name: 'Execute operational action' }),
  );
  await screen.findByText(/version 2/);
  await loadFailure(/Operational response contract failed/);
  expect(screen.queryByText('Awaiting acknowledgement')).toBeNull();
  current.operation = operation({ state: 'acknowledged', version: 2 });
  await load();
  expect(screen.getByText(engineer)).toBeTruthy();
});

it('submits explicit same-team engineer reassignment with a reason and preserves the SLA readback', async () => {
  mount('operator');
  await load();
  choose('assign');
  expect(
    screen.getByText(
      /Requires the accountable team's lead or an administrator/,
    ),
  ).toBeTruthy();
  fireEvent.change(screen.getByLabelText('New accountable engineer ID'), {
    target: { value: id(12) },
  });
  fireEvent.change(screen.getByLabelText('Reassignment reason'), {
    target: { value: 'Reviewed synthetic on-call rotation' },
  });
  call.mockResolvedValueOnce(
    envelope({
      incidentId,
      state: 'in_progress',
      version: 5,
      ownerTeamId: noc,
      ownerAssigneeId: id(12),
      correlationId: correlation,
      pendingMaterialisation: false,
    }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Execute operational action' }),
  );
  await screen.findByText(/Saved command completed/);
  const command = (executes()[0]![1] as { command: Record<string, unknown> })
    .command;
  expect(command).toMatchObject({
    kind: 'assign',
    targetAssigneeId: id(12),
    reason: 'Reviewed synthetic on-call rotation',
    incidentId,
    expected: 4,
  });
  expect(command).not.toHaveProperty('targetTeamId');
  expect(command).not.toHaveProperty('actor');
  expect(command).not.toHaveProperty('teamRole');
  current.operation = operation({ version: 5, ownerAssigneeId: id(12) });
  await load();
  expect(screen.getByText(id(12))).toBeTruthy();
  expect(screen.getByText(start + ' / ' + snapshot.deadlineAt)).toBeTruthy();
});
it('requires valid target/reason locally, preserves server denial, and never offers assignment while pending or terminal', async () => {
  mount('operator');
  await load();
  choose('assign');
  fireEvent.click(
    screen.getByRole('button', { name: 'Execute operational action' }),
  );
  await screen.findByText(/Operational input invalid/);
  expect(executes()).toHaveLength(0);
  await load();
  expect(
    (screen.getByLabelText('Operational action') as HTMLSelectElement).value,
  ).toBe('assign');
  fireEvent.change(screen.getByLabelText('New accountable engineer ID'), {
    target: { value: id(12) },
  });
  fireEvent.change(screen.getByLabelText('Reassignment reason'), {
    target: { value: 'Synthetic transfer' },
  });
  call.mockResolvedValueOnce({
    ok: false,
    code: 'DENIED',
    correlationId: correlation,
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Execute operational action' }),
  );
  await screen.findByText(/Operations DENIED/);
  cleanup();
  current.operation = operation({
    pendingHandoff: { targetTeamId: department, requestedAt: start },
  });
  mount();
  await load();
  expect(
    screen.queryByRole('option', { name: 'Reassign accountable engineer' }),
  ).toBeNull();
  cleanup();
  current.operation = operation({
    state: 'new',
    version: 1,
    ownerAssigneeId: null,
  });
  mount();
  await load();
  expect(
    screen.queryByRole('option', { name: 'Reassign accountable engineer' }),
  ).toBeNull();
  cleanup();
  current.operation = operation({ state: 'resolved', resolvedAt: start });
  mount();
  await load();
  expect(
    screen.queryByRole('option', { name: 'Reassign accountable engineer' }),
  ).toBeNull();
});
