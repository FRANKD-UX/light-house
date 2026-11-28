// @vitest-environment jsdom
// Synthetic Bridge/rendered checks; never actual issue view, permission or native acceptance.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { IssueContext } from '../../static/app/src/IssueContext';
import { issueContextResult } from '../../static/app/src/issue-context-contract';
vi.mock('@forge/bridge', () => ({ invoke: vi.fn() }));
import { invoke } from '@forge/bridge';
const call = vi.mocked(invoke),
  id = (n: number) =>
    `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`,
  at = '2026-11-28T00:00:00.000Z';
const incident = () => ({
  id: id(1),
  tenantId: id(2),
  sourceId: id(3),
  problemEventId: '100',
  correlationId: id(4),
  createdAt: at,
  occurredAt: at,
  state: 'new',
  version: 1,
  impact: {
    confidence: 'known',
    reason: 'COMPLETE',
    siteId: id(5),
    uplinkId: id(6),
    carrierId: id(7),
    affectedCustomerIds: [id(8)],
    potentiallyAffectedCustomerIds: [id(8)],
    affectedServiceIds: [],
    potentiallyAffectedServiceIds: [],
    protectedServiceIds: [],
    uncertainServiceIds: [],
    tierIds: [],
  },
  sla: { kind: 'manual_triage', reason: 'POLICY_GAP' },
});
const available = () => ({
  kind: 'available',
  incident: incident(),
  operations: {
    readiness: 'ready',
    summary: {
      incidentId: id(1),
      state: 'in_progress',
      version: 3,
      ownerTeamId: id(5),
      ownerAssigneeId: id(6),
      nocTeamId: id(5),
      pendingHandoff: true,
      pendingReturn: false,
      pendingMaterialisation: true,
      resolvedAt: null,
    },
  },
});
const envelope = (value: unknown) => ({
  ok: true,
  value,
  correlationId: id(9),
});
beforeEach(() => call.mockReset());
afterEach(cleanup);
it('loads only the host issue without client selectors and separates creation/current state', async () => {
  call.mockResolvedValue(envelope(available()));
  render(<IssueContext />);
  expect(call).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Load linked incident' }));
  await screen.findByText('in_progress');
  expect(screen.getByText('new')).toBeTruthy();
  expect(screen.getByText(/1 confirmed \/ 1 potentially/)).toBeTruthy();
  expect(screen.getByText(/Manual triage: POLICY_GAP/)).toBeTruthy();
  expect(screen.getByText(/Handoff pending/)).toBeTruthy();
  expect(screen.getByText(/Saved projections/)).toBeTruthy();
  expect(call).toHaveBeenCalledExactlyOnceWith('embeddedIncident', {
    action: 'read',
  });
  expect(
    screen.queryByRole('button', {
      name: /Create|Queue|Save|Close|Retry receipt/,
    }),
  ).toBeNull();
});
it('clears stale rows on reload, prevents overlap and retries explicitly after transport failure', async () => {
  call
    .mockResolvedValueOnce(envelope(available()))
    .mockRejectedValueOnce(new Error('private raw transport'))
    .mockResolvedValueOnce(
      envelope({ kind: 'unavailable', reason: 'NOT_VISIBLE' }),
    );
  render(<IssueContext />);
  const button = screen.getByRole('button', { name: 'Load linked incident' });
  fireEvent.click(button);
  await screen.findByText('in_progress');
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(screen.queryByText('in_progress')).toBeNull());
  expect(document.body.textContent).not.toContain('private raw');
  await waitFor(() =>
    expect((button as HTMLButtonElement).disabled).toBe(false),
  );
  expect(call).toHaveBeenCalledTimes(2);
  fireEvent.click(button);
  await screen.findByText(/Linked incident unavailable: NOT_VISIBLE/);
  expect(call).toHaveBeenCalledTimes(3);
});
it('treats missing operational schema as unverified and rejects malformed responses', async () => {
  const value = {
    ...available(),
    operations: { readiness: 'not-ready', summary: null },
  };
  call.mockResolvedValueOnce(envelope(value)).mockResolvedValueOnce(
    envelope({
      ...value,
      operations: {
        readiness: 'not-ready',
        summary: available().operations.summary,
      },
    }),
  );
  render(<IssueContext />);
  const button = screen.getByRole('button', { name: 'Load linked incident' });
  fireEvent.click(button);
  await screen.findByText('Operational state not verified');
  fireEvent.click(button);
  await screen.findByText(/response contract failed/);
  expect(screen.queryByText('Operational state not verified')).toBeNull();
});
it('validates denial enums and foreign operational identities before accepting a result', () => {
  expect(
    issueContextResult({ kind: 'unavailable', reason: 'NOT_AVAILABLE' }),
  ).toEqual({ kind: 'unavailable', reason: 'NOT_AVAILABLE' });
  for (const v of [
    { kind: 'unavailable', reason: 'private text' },
    { kind: 'unexpected' },
    {
      ...available(),
      operations: {
        readiness: 'ready',
        summary: { ...available().operations.summary, incidentId: id(50) },
      },
    },
    { ...available(), operations: { readiness: 'bogus', summary: null } },
  ])
    expect(() => issueContextResult(v)).toThrow();
});

it('shows immutable SLA and accepted operational return separately without offering a mutation', async () => {
  const base = available();
  const value = {
    ...base,
    incident: {
      ...base.incident,
      sla: {
        kind: 'selected',
        snapshot: {
          policyId: id(10),
          policyVersion: 1,
          tierId: id(11),
          consideredTierIds: [id(11)],
          priority: 'P1',
          severity: '5',
          confidence: 'known',
          reason: 'STRICTEST_AFFECTED_TIER',
          clock: 'elapsed-utc',
          startedAt: at,
          durationSeconds: 3600,
          warningSeconds: 2700,
          warningAt: '2026-11-28T00:45:00.000Z',
          deadlineAt: '2026-11-28T01:00:00.000Z',
        },
      },
    },
    operations: {
      ...base.operations,
      summary: {
        ...base.operations.summary,
        pendingHandoff: false,
        pendingReturn: true,
      },
    },
  };
  call.mockResolvedValue(envelope(value));
  render(<IssueContext />);
  fireEvent.click(screen.getByRole('button', { name: 'Load linked incident' }));
  await screen.findByText('P1');
  expect(screen.getByText('2026-11-28T01:00:00.000Z')).toBeTruthy();
  expect(screen.getByText(/Return pending/)).toBeTruthy();
  expect(screen.getAllByRole('button')).toHaveLength(1);
});
it('distinguishes a resolved backend denial from Bridge invocation rejection and rejects missing correlation', async () => {
  call
    .mockResolvedValueOnce({ ok: false, code: 'DENIED', correlationId: id(9) })
    .mockResolvedValueOnce({ ok: true, value: available() });
  render(<IssueContext />);
  const button = screen.getByRole('button', { name: 'Load linked incident' });
  fireEvent.click(button);
  await screen.findByText(/Linked incident backend DENIED/);
  expect(document.body.textContent).not.toContain('invocation rejected');
  fireEvent.click(button);
  await screen.findByText(/response contract failed/);
});
it('accepts an explicitly ready empty state without inventing an assigned owner', async () => {
  call.mockResolvedValue(
    envelope({
      ...available(),
      operations: { readiness: 'ready', summary: null },
    }),
  );
  render(<IssueContext />);
  fireEvent.click(screen.getByRole('button', { name: 'Load linked incident' }));
  await screen.findByText('Not initialised');
  expect(screen.getByText('Not returned')).toBeTruthy();
});
