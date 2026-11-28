// Mocked Forge transport only; no actual permissions, transitions or native enforcement evidence.
import { randomUUID } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ request: vi.fn(), asUser: vi.fn() }));
vi.mock('@forge/api', () => ({
  default: {
    asUser: (...args: unknown[]) => {
      sdk.asUser(...args);
      return { requestJira: sdk.request };
    },
  },
  route: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce(
      (result, piece, index) =>
        result +
        piece +
        (index < values.length
          ? encodeURIComponent(String(values[index]))
          : ''),
      '',
    ),
}));
import { ForgeJiraTransitionsGateway } from '../../src/infrastructure/jsm/transitions-gateway';
import type { TransitionPlan } from '../../src/application/jsm-transitions/contracts';
import type { JiraRequest } from '../../src/infrastructure/jsm/forge-gateway';
const now = '2026-11-28T00:00:00.000Z';
const plan = (): TransitionPlan => ({
  installationId: 'synthetic-installation',
  tenantId: randomUUID(),
  accountId: 'synthetic-user',
  incidentId: randomUUID(),
  operation: 'resolve',
  expectedVersion: 5,
  factsVersion: 1,
  gateId: randomUUID(),
  mappingVersion: 1,
  issueId: '10000',
  projectId: '20000',
  transitionId: '31',
  fromStatusId: '1',
  targetStatusId: '5',
  resolutionId: null,
});
const response = (status: number, value: unknown = {}) => ({
  status,
  headers: { get: () => null },
  json: vi.fn(async () => value),
});
function fixture(value = plan()) {
  const issue = response(200, {
    id: value.issueId,
    fields: {
      project: { id: value.projectId },
      status: { id: value.fromStatusId },
    },
  });
  const transitions = response(200, {
    transitions: [
      {
        id: value.transitionId,
        isAvailable: true,
        to: { id: value.targetStatusId },
        hasScreen: false,
      },
    ],
  });
  const request = vi
    .fn<JiraRequest>()
    .mockResolvedValueOnce(issue)
    .mockResolvedValueOnce(transitions);
  return {
    plan: value,
    issue,
    transitions,
    request,
    gateway: new ForgeJiraTransitionsGateway(request, () => now),
  };
}
beforeEach(() => {
  sdk.request.mockReset();
  sdk.asUser.mockClear();
});

it('checks exact issue/project/from/target and available transition without extra identity scopes or unsafe query flags', async () => {
  const f = fixture();
  expect(await f.gateway.eligible(f.plan)).toBe(true);
  expect(String(f.request.mock.calls[0]?.[0])).toBe(
    '/rest/api/3/issue/10000?fields=status,project',
  );
  const query = String(f.request.mock.calls[1]?.[0]);
  expect(f.request).toHaveBeenCalledTimes(2);
  expect(query).toBe(
    '/rest/api/3/issue/10000/transitions?expand=transitions.fields',
  );
  expect(query).not.toContain('skipRemoteOnlyCondition');
  expect(query).not.toContain('includeUnavailableTransitions');
  expect(
    f.request.mock.calls.every(([, options]) => options.method === 'GET'),
  ).toBe(true);
});

it('allows only reviewed resolution screen data and fails closed for missing/unavailable/duplicate transitions or unsupported required fields', async () => {
  const f = fixture({ ...plan(), resolutionId: '100' });
  f.request
    .mockReset()
    .mockResolvedValueOnce(f.issue)
    .mockResolvedValueOnce(
      response(200, {
        transitions: [
          {
            id: f.plan.transitionId,
            to: { id: f.plan.targetStatusId },
            hasScreen: true,
            fields: {
              resolution: {
                required: true,
                schema: { type: 'resolution' },
                allowedValues: [{ id: '100' }],
              },
            },
          },
        ],
      }),
    );
  expect(await f.gateway.eligible(f.plan)).toBe(true);
  const failures = [
    [],
    [{ id: '99', to: { id: '5' } }],
    [{ id: '31', isAvailable: false, to: { id: '5' } }],
    [{ id: '31', to: { id: '99' } }],
    [
      { id: '31', to: { id: '5' } },
      { id: '31', to: { id: '5' } },
    ],
    [{ id: '31', to: { id: '5' }, hasScreen: true }],
    [{ id: '31', to: { id: '5' }, fields: { summary: { required: true } } }],
    [{ id: '31', to: { id: '5' }, fields: { resolution: { required: true } } }],
    [{ id: '31', to: { id: '5' }, fields: { summary: { required: 'true' } } }],
  ];
  for (const transitions of failures) {
    const g = fixture();
    g.request
      .mockReset()
      .mockResolvedValueOnce(g.issue)
      .mockResolvedValueOnce(response(200, { transitions }));
    expect(await g.gateway.eligible(g.plan)).toBe(false);
  }
});

it('rejects mismatched project/issue/from status and malformed mapping before write', async () => {
  for (const issue of [
    { id: '99999', fields: { project: { id: '20000' }, status: { id: '1' } } },
    { id: '10000', fields: { project: { id: '99999' }, status: { id: '1' } } },
    { id: '10000', fields: { project: { id: '20000' }, status: { id: '5' } } },
  ]) {
    const g = fixture();
    g.request.mockReset().mockResolvedValueOnce(response(200, issue));
    expect(await g.gateway.eligible(g.plan)).toBe(false);
    expect(g.request).toHaveBeenCalledTimes(1);
  }
  const g = fixture();
  expect(await g.gateway.eligible({ ...g.plan, issueId: '../foreign' })).toBe(
    false,
  );
  expect(g.request).not.toHaveBeenCalled();
});

it('POST sends only the mapped transition and optional reviewed resolution;204 is accepted without parsing raw body', async () => {
  const f = fixture({ ...plan(), resolutionId: '100' });
  const accepted = response(204);
  f.request.mockReset().mockResolvedValue(accepted);
  expect(await f.gateway.post(f.plan)).toEqual({ kind: 'accepted' });
  expect(String(f.request.mock.calls[0]?.[0])).toBe(
    '/rest/api/3/issue/10000/transitions',
  );
  expect(JSON.parse(f.request.mock.calls[0]![1].body!)).toEqual({
    transition: { id: '31' },
    fields: { resolution: { id: '100' } },
  });
  expect(accepted.json).not.toHaveBeenCalled();
  const noResolution = fixture();
  noResolution.request.mockReset().mockResolvedValue(response(204));
  await noResolution.gateway.post(noResolution.plan);
  expect(JSON.parse(noResolution.request.mock.calls[0]![1].body!)).toEqual({
    transition: { id: '31' },
  });
});

it.each([
  [401, 'PERMISSION'],
  [403, 'PERMISSION'],
  [400, 'CONFIGURATION'],
  [404, 'CONFIGURATION'],
  [409, 'CONFIGURATION'],
  [422, 'CONFIGURATION'],
  [429, 'RATE_LIMITED'],
] as const)(
  'projects HTTP%s to fixed %s without raw exceptions or response text',
  async (status, reason) => {
    const f = fixture();
    const raw = response(status, { message: 'SYNTHETIC-PRIVATE' });
    f.request.mockReset().mockResolvedValue(raw);
    expect(await f.gateway.post(f.plan)).toEqual({ kind: 'rejected', reason });
    expect(raw.json).not.toHaveBeenCalled();
  },
);

it('unknown status/network failures remain ambiguous without automatic retries', async () => {
  const f = fixture();
  f.request
    .mockReset()
    .mockResolvedValueOnce(response(500))
    .mockRejectedValueOnce(new Error('SYNTHETIC-PRIVATE'));
  expect(await f.gateway.post(f.plan)).toEqual({ kind: 'ambiguous' });
  expect(await f.gateway.post(f.plan)).toEqual({ kind: 'ambiguous' });
  expect(f.request).toHaveBeenCalledTimes(2);
});

it('observations bind exact issue/project and use server read time, never exact transition time', async () => {
  const f = fixture();
  f.request.mockReset().mockResolvedValueOnce(
    response(200, {
      id: '10000',
      fields: { project: { id: '20000' }, status: { id: '5' } },
    }),
  );
  expect(await f.gateway.observe(f.plan)).toEqual({
    issueId: '10000',
    projectId: '20000',
    statusId: '5',
    observedAt: now,
    causality: 'postcondition-only',
  });
  const g = fixture();
  g.request.mockReset().mockResolvedValueOnce(response(404));
  expect(await g.gateway.observe(g.plan)).toBeNull();
  const failed = fixture();
  failed.request.mockReset().mockRejectedValueOnce(new Error('private'));
  expect(await failed.gateway.eligible(failed.plan)).toBe(false);
  failed.request.mockRejectedValueOnce(new Error('private'));
  expect(await failed.gateway.observe(failed.plan)).toBeNull();
});

it('default transport uses current asUser with no accountId impersonation or app fallback', async () => {
  sdk.request.mockResolvedValue(response(204));
  expect(await new ForgeJiraTransitionsGateway().post(plan())).toEqual({
    kind: 'accepted',
  });
  expect(sdk.asUser).toHaveBeenCalledTimes(1);
  expect(sdk.asUser).toHaveBeenCalledWith();
  expect(sdk.request).toHaveBeenCalledTimes(1);
});

it('default eligibility and observation use only resolver-bound asUser without a user-profile read', async () => {
  const f = fixture();
  sdk.request
    .mockResolvedValueOnce(f.issue)
    .mockResolvedValueOnce(f.transitions)
    .mockResolvedValueOnce(f.issue);
  const gateway = new ForgeJiraTransitionsGateway(undefined, () => now);
  expect(await gateway.eligible(f.plan)).toBe(true);
  expect(await gateway.observe(f.plan)).toMatchObject({
    issueId: f.plan.issueId,
  });
  expect(sdk.asUser.mock.calls).toEqual([[], [], []]);
  expect(sdk.request.mock.calls.map(([path]) => String(path))).toEqual([
    '/rest/api/3/issue/10000?fields=status,project',
    '/rest/api/3/issue/10000/transitions?expand=transitions.fields',
    '/rest/api/3/issue/10000?fields=status,project',
  ]);
});
