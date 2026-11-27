// @vitest-environment jsdom
// Synthetic Bridge/UI contract tests, never hosted acceptance evidence.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { Incidents } from '../../static/app/src/Incidents';
import {
  incidentMutation,
  incidentOverview,
  incidentPolicy,
  publicIncident,
} from '../../static/app/src/incident-contract';
vi.mock('@forge/bridge', () => ({ invoke: vi.fn() }));
import { invoke } from '@forge/bridge';
const call = vi.mocked(invoke);
const tenant = '11111111-1111-4111-8111-111111111111',
  id = '22222222-2222-4222-8222-222222222222',
  other = '33333333-3333-4333-8333-333333333333';
const correlation = '44444444-4444-4444-8444-444444444444';
const snapshot = {
  policyId: other,
  policyVersion: 1,
  tierId: other,
  consideredTierIds: [other],
  priority: 'P1',
  severity: '5',
  confidence: 'known',
  reason: 'STRICTEST_AFFECTED_TIER',
  clock: 'elapsed-utc',
  startedAt: '2026-11-27T00:00:00.000Z',
  durationSeconds: 3600,
  warningSeconds: 2700,
  warningAt: '2026-11-27T00:45:00.000Z',
  deadlineAt: '2026-11-27T01:00:00.000Z',
};
const incident = {
  id,
  tenantId: tenant,
  sourceId: other,
  problemEventId: '100',
  correlationId: correlation,
  createdAt: snapshot.startedAt,
  occurredAt: snapshot.startedAt,
  state: 'new',
  version: 1,
  impact: {
    confidence: 'known',
    reason: 'COMPLETE',
    siteId: other,
    uplinkId: other,
    carrierId: other,
    affectedServiceIds: [other],
    affectedCustomerIds: [other],
    potentiallyAffectedCustomerIds: [other],
    potentiallyAffectedServiceIds: [other],
    protectedServiceIds: [],
    uncertainServiceIds: [],
    tierIds: [other],
  },
  sla: { kind: 'selected', snapshot },
};
const policy = {
  id: other,
  tenantId: tenant,
  tierId: other,
  version: 1,
  status: 'published',
  effectiveFrom: snapshot.startedAt,
  effectiveUntil: null,
  clock: 'elapsed-utc',
  severityMap: { '5': 'P1' },
  unknownImpact: 'manual-review',
  targets: {
    P1: { durationSeconds: 3600, warningSeconds: 2700 },
    P2: { durationSeconds: 7200, warningSeconds: 3600 },
    P3: { durationSeconds: 14400, warningSeconds: 7200 },
  },
};
const envelope = (value: unknown) => ({
  ok: true,
  value,
  correlationId: correlation,
});
let current: unknown, memberRole: string;
beforeEach(() => {
  memberRole = 'admin';
  current = { incidents: [incident], next: null, policies: [policy] };
  call.mockReset();
  call.mockImplementation(async (name, payload) => {
    const data = payload as Record<string, unknown>;
    if (name === 'inventory')
      return envelope({
        tenants: [
          { tenantId: tenant, name: 'Synthetic ISP', role: memberRole },
        ],
      });
    if (data.action === 'overview') return envelope(current);
    if (data.action === 'migrate') return envelope({ queued: true });
    if (data.action === 'process')
      return envelope({ kind: 'awaiting_problem' });
    if (data.action === 'createJsm')
      return envelope({
        state: 'linked',
        intentId: other,
        issue: { id: '100', key: 'SYN-1' },
      });
    return envelope({ saved: true });
  });
});
afterEach(cleanup);
async function choose() {
  render(<Incidents />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Load incident tenants' }),
  );
  await screen.findByRole('option', {
    name: 'Synthetic ISP (' + memberRole + ')',
  });
  fireEvent.change(screen.getByLabelText('Incident tenant'), {
    target: { value: tenant },
  });
}
async function load() {
  fireEvent.click(screen.getByRole('button', { name: 'Load incidents' }));
  await screen.findByRole('button', { name: 'Open incident ' + id });
}
it('loads a tenant-isolated workspace and shows actual impact/immutable UTC SLA', async () => {
  await choose();
  await load();
  fireEvent.click(screen.getByRole('button', { name: 'Open incident ' + id }));
  expect(screen.getByText(snapshot.deadlineAt)).toBeTruthy();
  expect(
    screen.getByText(/1 confirmed customers, 1 affected services/),
  ).toBeTruthy();
  expect(screen.getByText(/Elapsed UTC;/)).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Create or reconcile JSM incident' }),
  ).toBeTruthy();
  expect(call).toHaveBeenCalledWith('incidents', {
    action: 'overview',
    tenantId: tenant,
    after: '',
  });
});
it('hides mutations from a viewer while preserving read-only visibility', async () => {
  memberRole = 'viewer';
  await choose();
  await load();
  expect(
    screen.queryByRole('button', { name: 'Queue incident schema setup' }),
  ).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Open incident ' + id }));
  expect(
    screen.queryByRole('button', { name: 'Create or reconcile JSM incident' }),
  ).toBeNull();
});
it('clears stale rows during loading and prevents overlap', async () => {
  await choose();
  await load();
  let resolve: (value: unknown) => void = () => {};
  call.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Load incidents' }));
  expect(
    screen.queryByRole('button', { name: 'Open incident ' + id }),
  ).toBeNull();
  expect(
    (
      screen.getByRole('button', {
        name: 'Load incidents',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  resolve(envelope({ incidents: [], policies: [], next: null }));
  await screen.findByText('No incidents returned for this page.');
});
it('keeps backend failure, malformed response and empty success distinct', async () => {
  await choose();
  await load();
  current = { incidents: [], policies: [], next: null };
  fireEvent.click(screen.getByRole('button', { name: 'Load incidents' }));
  await screen.findByText('No incidents returned for this page.');
  call.mockResolvedValueOnce({
    ok: false,
    code: 'NOT_READY',
    correlationId: correlation,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Load incidents' }));
  await screen.findByText(/Incidents NOT_READY/);
  expect(screen.queryByText('No incidents returned for this page.')).toBeNull();
  current = {
    incidents: [{ ...incident, tenantId: other }],
    policies: [],
    next: null,
  };
  fireEvent.click(screen.getByRole('button', { name: 'Load incidents' }));
  await waitFor(() =>
    expect(screen.getByLabelText('Incident status').textContent).toMatch(
      /No result accepted|unclassified rejection/,
    ),
  );
  call.mockResolvedValueOnce({
    ok: true,
    value: current,
    correlationId: 'unsafe',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Load incidents' }));
  await waitFor(() =>
    expect(screen.getByLabelText('Incident status').textContent).toMatch(
      /Incident response contract failed/,
    ),
  );
});
it('does not expose arbitrary Bridge or backend error content', async () => {
  await choose();
  call.mockRejectedValueOnce(new Error('PRIVATE_TOKEN_NEVER_RENDER'));
  fireEvent.click(screen.getByRole('button', { name: 'Load incidents' }));
  await screen.findByText(/unclassified rejection/);
  expect(screen.queryByText(/PRIVATE_TOKEN/)).toBeNull();
  call.mockResolvedValueOnce({
    ok: false,
    code: 'CONFLICT',
    correlationId: correlation,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Load incidents' }));
  await screen.findByText(/Reload before retrying/);
});
it('queues schema setup honestly, processes explicit receipt and reconciles JSM', async () => {
  await choose();
  fireEvent.click(
    screen.getByRole('button', { name: 'Queue incident schema setup' }),
  );
  await screen.findByText(/queued is not readiness/);
  fireEvent.change(screen.getByLabelText('Ready monitoring receipt ID'), {
    target: { value: other },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Enrich monitoring receipt' }),
  );
  await screen.findByText(/awaiting the problem event/);
  expect(call).toHaveBeenCalledWith('incidents', {
    action: 'process',
    tenantId: tenant,
    inboxId: other,
  });
  await load();
  fireEvent.click(screen.getByRole('button', { name: 'Open incident ' + id }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Create or reconcile JSM incident' }),
  );
  await screen.findByText(/JSM linked: SYN-1/);
  expect(call).toHaveBeenCalledWith('incidents', {
    action: 'createJsm',
    tenantId: tenant,
    incidentId: id,
  });
});
it('publishes explicit tenant-specific policy and saves reviewed JSM field configuration', async () => {
  await choose();
  fireEvent.change(screen.getByLabelText('SLA tier ID'), {
    target: { value: other },
  });
  fireEvent.change(screen.getByLabelText('Effective from UTC'), {
    target: { value: snapshot.startedAt },
  });
  fireEvent.change(screen.getByLabelText('Severity 5 priority'), {
    target: { value: 'P1' },
  });
  for (const p of ['P1', 'P2', 'P3']) {
    fireEvent.change(screen.getByLabelText(p + ' deadline seconds'), {
      target: { value: '3600' },
    });
    fireEvent.change(
      screen.getByLabelText(p + ' warning seconds after start'),
      { target: { value: '1800' } },
    );
  }
  fireEvent.click(
    screen.getByRole('button', { name: 'Publish operational policy' }),
  );
  await screen.findByText(/Operational policy saved/);
  const publication = call.mock.calls.find(
    ([, v]) => (v as { action: string }).action === 'publishPolicy',
  )?.[1] as {
    policy: { tenantId: string; severityMap: unknown; targets: unknown };
    expected: number;
  };
  expect(publication.policy.tenantId).toBe(tenant);
  expect(publication.policy.severityMap).toEqual({ '5': 'P1' });
  expect(publication.expected).toBe(0);
  for (const [label, value] of Object.entries({
    'Project ID': '10',
    'Service desk ID': '20',
    'Request type ID': '30',
    'Marker field ID': 'customfield_101',
    'Deadline field ID': 'customfield_102',
    'Warning field ID': 'customfield_103',
    'Policy field ID': 'customfield_104',
    'P1 priority ID': '1',
    'P2 priority ID': '2',
    'P3 priority ID': '3',
    'Expected configuration version': '0',
  }))
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(
    screen.getByRole('button', { name: 'Save JSM configuration' }),
  );
  await screen.findByText(/JSM configuration saved/);
});
it('shows manual triage and disables JSM creation without a selected SLA', async () => {
  current = {
    incidents: [
      {
        ...incident,
        state: 'manual_triage',
        sla: { kind: 'manual_triage', reason: 'POLICY_GAP' },
      },
    ],
    policies: [],
    next: other,
  };
  await choose();
  await load();
  fireEvent.click(screen.getByRole('button', { name: 'Open incident ' + id }));
  expect(screen.getByText(/Manual triage required: POLICY_GAP/)).toBeTruthy();
  expect(
    (
      screen.getByRole('button', {
        name: 'Create or reconcile JSM incident',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  current = { incidents: [], next: null, policies: [] };
  fireEvent.click(screen.getByRole('button', { name: 'Next incident page' }));
  await screen.findByText('No incidents returned for this page.');
  expect(call).toHaveBeenCalledWith('incidents', {
    action: 'overview',
    tenantId: tenant,
    after: other,
  });
});
it('rejects incomplete forms without invoking mutations and sanitises invalid tenant payload', async () => {
  await choose();
  fireEvent.click(
    screen.getByRole('button', { name: 'Publish operational policy' }),
  );
  await screen.findByText(/Incident response contract failed/);
  fireEvent.click(
    screen.getByRole('button', { name: 'Save JSM configuration' }),
  );
  await screen.findByText(/Incident response contract failed/);
  expect(
    call.mock.calls.filter(([, v]) =>
      ['publishPolicy', 'configureJsm'].includes(
        (v as { action: string }).action,
      ),
    ),
  ).toHaveLength(0);
  call.mockResolvedValueOnce(envelope({ tenants: 'invalid' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Load incident tenants' }),
  );
  await screen.findByText(/Incident response contract failed/);
});
it('strictly projects incident/policy/result contracts and rejects foreign or inconsistent data', () => {
  expect(
    incidentOverview(
      {
        incidents: [{ ...incident, installationId: 'discard' }],
        policies: [policy],
        next: other,
      },
      tenant,
    ).incidents[0],
  ).not.toHaveProperty('installationId');
  expect(() =>
    publicIncident({ ...incident, tenantId: other }, tenant),
  ).toThrow();
  expect(() =>
    publicIncident({ ...incident, sla: { kind: 'unsafe' } }, tenant),
  ).toThrow();
  expect(() =>
    publicIncident(
      {
        ...incident,
        sla: {
          kind: 'selected',
          snapshot: { ...snapshot, warningAt: snapshot.startedAt },
        },
      },
      tenant,
    ),
  ).toThrow();
  expect(() =>
    publicIncident(
      {
        ...incident,
        impact: { ...incident.impact, affectedCustomerIds: [other, other] },
      },
      tenant,
    ),
  ).toThrow();
  expect(() =>
    incidentOverview(
      { incidents: [incident, incident], policies: [], next: null },
      tenant,
    ),
  ).toThrow();
  expect(() =>
    incidentOverview({ incidents: null, policies: [], next: null }, tenant),
  ).toThrow();
  expect(() =>
    incidentPolicy({ ...policy, tenantId: other }, tenant),
  ).toThrow();
  expect(() =>
    incidentPolicy({ ...policy, severityMap: { '5': 'unsafe' } }, tenant),
  ).toThrow();
  expect(() => incidentMutation('unknown', {}, tenant)).toThrow();
  expect(() =>
    incidentMutation(
      'createJsm',
      {
        state: 'linked',
        intentId: other,
        issue: { id: '../unsafe', key: 'private' },
      },
      tenant,
    ),
  ).toThrow();
  expect(() =>
    incidentMutation(
      'createJsm',
      { state: 'linked', intentId: other, issue: null },
      tenant,
    ),
  ).toThrow();
  expect(
    incidentMutation(
      'createJsm',
      { state: 'ambiguous', intentId: other, issue: null },
      tenant,
    ),
  ).toContain('Inspect persisted state');
  expect(
    incidentMutation('process', { kind: 'incident', incident }, tenant),
  ).toContain('persisted');
});

it('keeps confirmed JSM identities visible after reload and rejects unbound mapping records', async () => {
  current = {
    incidents: [incident],
    policies: [],
    next: null,
    jsmLinks: [
      { incidentId: id, state: 'linked', issueId: '100', issueKey: 'SYN-1' },
    ],
  };
  await choose();
  await load();
  fireEvent.click(screen.getByRole('button', { name: 'Open incident ' + id }));
  expect(screen.getByText('linked: SYN-1')).toBeTruthy();
  for (const link of [
    { incidentId: other, state: 'linked', issueId: '100', issueKey: 'SYN-1' },
    { incidentId: id, state: 'linked', issueId: null, issueKey: null },
    { incidentId: id, state: 'ambiguous', issueId: '100', issueKey: 'SYN-1' },
    { incidentId: id, state: 'linked', issueId: 'unsafe', issueKey: 'SYN-1' },
  ])
    expect(() =>
      incidentOverview(
        { incidents: [incident], policies: [], next: null, jsmLinks: [link] },
        tenant,
      ),
    ).toThrow();
  expect(() =>
    incidentOverview(
      { incidents: [incident], policies: [], next: null, jsmLinks: 'invalid' },
      tenant,
    ),
  ).toThrow();
  const duplicate = {
    incidentId: id,
    state: 'ambiguous',
    issueId: null,
    issueKey: null,
  };
  expect(() =>
    incidentOverview(
      {
        incidents: [incident],
        policies: [],
        next: null,
        jsmLinks: [duplicate, duplicate],
      },
      tenant,
    ),
  ).toThrow();
});
