// @vitest-environment jsdom
// Synthetic component/contract checks; no hosted acceptance or Jira transition.
import { afterEach, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import {
  NocBoard,
  incidentSlaStatus,
  useNocClock,
} from '../../static/app/src/NocBoard';
import {
  incidentOverview,
  type PublicIncident,
  type PublicOperationSummary,
} from '../../static/app/src/incident-contract';
const id = (n: number) =>
  `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const start = '2026-11-27T00:00:00.000Z';
function incident(n = 1): PublicIncident {
  return {
    id: id(n),
    tenantId: id(9),
    sourceId: id(8),
    problemEventId: String(n),
    correlationId: id(7),
    createdAt: start,
    occurredAt: start,
    state: 'new',
    version: 1,
    impact: {
      confidence: 'known',
      reason: 'COMPLETE',
      siteId: id(2),
      uplinkId: id(3),
      carrierId: id(4),
      affectedServiceIds: [id(5)],
      affectedCustomerIds: [id(6)],
      potentiallyAffectedCustomerIds: [id(6), id(7)],
      potentiallyAffectedServiceIds: [id(5)],
      protectedServiceIds: [],
      uncertainServiceIds: [],
      tierIds: [id(8)],
    },
    sla: {
      kind: 'selected',
      snapshot: {
        policyId: id(8),
        policyVersion: 1,
        tierId: id(8),
        consideredTierIds: [id(8)],
        priority: 'P1',
        severity: '5',
        confidence: 'known',
        reason: 'STRICTEST_AFFECTED_TIER',
        clock: 'elapsed-utc',
        startedAt: start,
        durationSeconds: 3600,
        warningSeconds: 2700,
        warningAt: '2026-11-27T00:45:00.000Z',
        deadlineAt: '2026-11-27T01:00:00.000Z',
      },
    },
  };
}
const operation = (): PublicOperationSummary => ({
  incidentId: id(1),
  state: 'in_progress',
  version: 3,
  ownerTeamId: id(2),
  ownerAssigneeId: id(3),
  nocTeamId: id(2),
  pendingMaterialisation: false,
  pendingHandoff: false,
  pendingReturn: false,
  resolvedAt: null,
});
const props = () => ({
  incidents: [incident()],
  operations: [operation()],
  operationsReady: true,
  selectedId: '',
  onSelect: vi.fn(),
  now: '2026-11-27T00:50:00.000Z',
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('shows mutable ownership separately from creation snapshots and distinct page counts', () => {
  const p = props();
  p.incidents.push(incident(2));
  p.operations[0] = {
    ...operation(),
    pendingHandoff: true,
    pendingMaterialisation: true,
  };
  render(<NocBoard {...p} />);
  expect(screen.getByText('In progress', { selector: 'strong' })).toBeTruthy();
  expect(screen.getAllByText('Creation snapshot: new')).toHaveLength(2);
  expect(screen.getByText('Handoff pending; ownership retained.')).toBeTruthy();
  expect(screen.getByText(/Saved command projections/)).toBeTruthy();
  expect(
    screen.getByText('Distinct confirmed customers on this page')
      .nextElementSibling?.textContent,
  ).toBe('1');
  expect(
    screen.getByText(/Potentially affected customers on this page/)
      .nextElementSibling?.textContent,
  ).toBe('2');
  expect(screen.getByText('Not initialised', { selector: 'p' })).toBeTruthy();
  fireEvent.click(
    screen.getByRole('button', { name: 'Open incident ' + id(1) }),
  );
  expect(p.onSelect).toHaveBeenCalledWith(id(1));
});
it('filters only the current page and distinguishes unmatched filters from empty results', () => {
  const p = props();
  const view = render(<NocBoard {...p} />);
  fireEvent.change(screen.getByLabelText('Operational stage filter'), {
    target: { value: 'closed' },
  });
  expect(
    screen.getByText(/No incidents match these local filters/),
  ).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Operational stage filter'), {
    target: { value: 'all' },
  });
  fireEvent.change(screen.getByLabelText('SLA filter'), {
    target: { value: 'warning' },
  });
  fireEvent.change(screen.getByLabelText('Incident or source problem ID'), {
    target: { value: 'missing' },
  });
  expect(screen.getByLabelText('Board filtered count').textContent).toContain(
    'Showing 0 of 1',
  );
  view.rerender(<NocBoard {...p} incidents={[]} />);
  expect(screen.getByText('No incidents returned for this page.')).toBeTruthy();
});
it('does not infer current operations from absent readiness and disables controls while busy', () => {
  const p = props();
  render(<NocBoard {...p} operationsReady={false} busy selectedId={id(1)} />);
  expect(screen.getByText(/Creation snapshots do not establish/)).toBeTruthy();
  expect(screen.queryByText('In progress', { selector: 'strong' })).toBeNull();
  expect(screen.getByText('P1 — operational-unverified')).toBeTruthy();
  const button = screen.getByRole('button', {
    name: 'Open incident ' + id(1),
  }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(button.getAttribute('aria-expanded')).toBe('true');
});
it('evaluates immutable SLA thresholds, confirmed resolution and untrusted local time conservatively', () => {
  const i = incident(),
    o = operation();
  expect(incidentSlaStatus(i, o, start)).toBe('on-track');
  expect(incidentSlaStatus(i, o, '2026-11-27T00:45:00.000Z')).toBe('warning');
  expect(incidentSlaStatus(i, o, '2026-11-27T01:00:00.000Z')).toBe('breached');
  expect(
    incidentSlaStatus(
      i,
      { ...o, state: 'resolved', resolvedAt: '2026-11-27T00:40:00.000Z' },
      '2026-11-27T02:00:00.000Z',
    ),
  ).toBe('on-track');
  expect(incidentSlaStatus(i, o, '2026-11-26T00:00:00.000Z')).toBe(
    'time-unverified',
  );
  expect(
    incidentSlaStatus(
      i,
      { ...o, resolvedAt: '2026-11-28T00:00:00.000Z' },
      start,
    ),
  ).toBe('time-unverified');
  expect(
    incidentSlaStatus(
      i,
      { ...o, resolvedAt: '2026-11-26T00:00:00.000Z' },
      start,
    ),
  ).toBe('time-unverified');
  expect(
    incidentSlaStatus(
      { ...i, sla: { kind: 'manual_triage', reason: 'UNKNOWN_IMPACT' } },
      undefined,
      start,
    ),
  ).toBe('blocked');
});
it('renders unknown impact, manual triage, confirmed resolution and pending return explicitly', () => {
  const p = props();
  p.incidents[0] = {
    ...incident(),
    impact: { ...incident().impact, confidence: 'unknown' },
  };
  p.operations[0] = { ...operation(), pendingReturn: true };
  const view = render(<NocBoard {...p} />);
  expect(screen.getByText(/department retains ownership/)).toBeTruthy();
  p.operations[0] = {
    ...operation(),
    state: 'resolved',
    resolvedAt: '2026-11-27T00:40:00.000Z',
  };
  view.rerender(<NocBoard {...p} />);
  expect(
    screen.getByText(/Clock evaluated at confirmed resolution/),
  ).toBeTruthy();
  p.incidents[0] = {
    ...incident(),
    sla: { kind: 'manual_triage', reason: 'UNKNOWN_IMPACT' },
  };
  view.rerender(<NocBoard {...p} />);
  expect(screen.getByText(/Manual triage: UNKNOWN_IMPACT/)).toBeTruthy();
});
it('refreshes only the local clock and releases its timer', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(start));
  function Clock() {
    return <output>{useNocClock()}</output>;
  }
  const view = render(<Clock />);
  expect(screen.getByRole('status').textContent).toBe(start);
  act(() => vi.advanceTimersByTime(30000));
  expect(screen.getByRole('status').textContent).toBe(
    '2026-11-27T00:00:30.000Z',
  );
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it('accepts only bounded same-page current-operation summaries with explicit readiness', () => {
  const base = { incidents: [incident()], policies: [], next: null };
  const op = operation();
  expect(incidentOverview(base, id(9)).operationsReady).toBe(false);
  expect(
    incidentOverview(
      { ...base, operationsReady: true, operations: [op] },
      id(9),
    ).operations,
  ).toEqual([op]);
  for (const extra of [
    { operationsReady: 'true' },
    { operations: [op] },
    { operationsReady: true, operations: [op, op] },
    { operationsReady: true, operations: [{ ...op, incidentId: id(20) }] },
    { operationsReady: true, operations: [{ ...op, pendingHandoff: 'false' }] },
    { operationsReady: true, operations: [{ ...op, accountId: 'private' }] },
    {
      operationsReady: true,
      operations: [{ ...op, state: 'closed', resolvedAt: null }],
    },
    {
      operationsReady: true,
      operations: [{ ...op, pendingReturn: true, pendingHandoff: true }],
    },
  ])
    expect(() => incidentOverview({ ...base, ...extra }, id(9))).toThrow();
});
