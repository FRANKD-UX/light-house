// Mocked Forge transport contracts. These tests perform no Atlassian requests.
import { beforeEach, expect, it, vi } from 'vitest';
const mocked = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@forge/api', () => ({
  default: { asApp: () => ({ requestJira: mocked.request }) },
  route: (parts: TemplateStringsArray, ...values: unknown[]) => ({
    value: parts.reduce(
      (all, part, i) =>
        all +
        part +
        (i < values.length ? encodeURIComponent(String(values[i])) : ''),
      '',
    ),
  }),
}));
import {
  ForgeJsmGateway,
  type JiraResponse,
} from '../../src/infrastructure/jsm/forge-gateway';
import type {
  JsmConfiguration,
  JsmRequest,
} from '../../src/application/jsm/contracts';
const config: JsmConfiguration = {
  installationId: 'synthetic-installation',
  tenantId: '11111111-1111-4111-8111-111111111111',
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
const marker = 'light-house-22222222-2222-4222-8222-222222222222';
const body: JsmRequest = {
  serviceDeskId: '20',
  requestTypeId: '30',
  requestFieldValues: { summary: 'Synthetic outage', customfield_101: marker },
};
const created = {
  issueId: '100',
  issueKey: 'SYN-1',
  serviceDeskId: '20',
  requestTypeId: '30',
};
const response = (
  status: number,
  value: unknown,
  retry: string | null = null,
): JiraResponse => ({
  status,
  headers: { get: () => retry },
  json: async () => value,
});
function metadata() {
  return [
    'summary',
    'description',
    'priority',
    ...Object.values(config.fields),
  ].map((fieldId) => ({
    fieldId,
    required: true,
    validValues: [],
    jiraSchema: {
      type:
        fieldId === 'priority'
          ? 'priority'
          : fieldId === config.fields.deadline ||
              fieldId === config.fields.warning
            ? 'datetime'
            : 'string',
    },
  }));
}
const candidate = () => ({
  id: '100',
  key: 'SYN-1',
  fields: { project: { id: '10' }, customfield_101: marker },
});
beforeEach(() => mocked.request.mockReset());
it('verifies configured desk project and all required field types without creating a request', async () => {
  mocked.request
    .mockResolvedValueOnce(response(200, { projectId: '10' }))
    .mockResolvedValueOnce(response(200, { requestTypeFields: metadata() }));
  expect(await new ForgeJsmGateway().verifyConfiguration(config)).toBe(true);
  expect(mocked.request).toHaveBeenCalledTimes(2);
  expect(
    mocked.request.mock.calls.every(([, options]) => options.method === 'GET'),
  ).toBe(true);
});
it('rejects incomplete, foreign, required-extra, enumerated or wrong-type metadata safely', async () => {
  const variants: unknown[] = [
    null,
    [],
    [{}],
    metadata().filter((x) => x.fieldId !== 'summary'),
    [
      ...metadata(),
      { fieldId: 'extra', required: true, jiraSchema: { type: 'string' } },
    ],
    metadata().map((x) =>
      x.fieldId === 'summary' ? { ...x, validValues: [{ value: 'only' }] } : x,
    ),
    metadata().map((x) =>
      x.fieldId === 'priority' ? { ...x, jiraSchema: { type: 'string' } } : x,
    ),
    Array.from({ length: 101 }, () => ({})),
  ];
  for (const requestTypeFields of variants) {
    mocked.request
      .mockResolvedValueOnce(response(200, { projectId: '10' }))
      .mockResolvedValueOnce(response(200, { requestTypeFields }));
    expect(await new ForgeJsmGateway().verifyConfiguration(config)).toBe(false);
  }
  mocked.request.mockResolvedValueOnce(response(200, { projectId: '99' }));
  expect(await new ForgeJsmGateway().verifyConfiguration(config)).toBe(false);
  mocked.request.mockResolvedValueOnce(response(403, {}));
  expect(await new ForgeJsmGateway().verifyConfiguration(config)).toBe(false);
  mocked.request
    .mockResolvedValueOnce(response(200, { projectId: '10' }))
    .mockResolvedValueOnce(response(403, {}));
  expect(await new ForgeJsmGateway().verifyConfiguration(config)).toBe(false);
  mocked.request.mockRejectedValueOnce(new Error('private'));
  expect(await new ForgeJsmGateway().verifyConfiguration(config)).toBe(false);
});
it('projects created identity only and uses the initial marker-bearing request payload', async () => {
  mocked.request.mockResolvedValueOnce(
    response(201, { ...created, private: 'never returned' }),
  );
  expect(await new ForgeJsmGateway().create(config, body)).toEqual({
    kind: 'created',
    issue: { id: '100', key: 'SYN-1' },
  });
  expect(mocked.request.mock.calls[0]![0].value).toBe(
    '/rest/servicedeskapi/request',
  );
  expect(JSON.parse(mocked.request.mock.calls[0]![1].body)).toEqual(body);
});
it('classifies permanent failures, bounded Retry-After and ambiguous POST outcomes', async () => {
  const gateway = new ForgeJsmGateway();
  for (const status of [400, 401, 403, 404, 422]) {
    mocked.request.mockResolvedValueOnce(
      response(status, { error: 'private' }),
    );
    expect(await gateway.create(config, body)).toEqual({
      kind: 'CONFIGURATION',
    });
  }
  mocked.request.mockResolvedValueOnce(response(429, {}, '120'));
  expect(await gateway.create(config, body)).toEqual({
    kind: 'RATE_LIMITED',
    retryAfterSeconds: 120,
  });
  for (const retry of [null, '0', '3601', '0.5', 'tomorrow']) {
    mocked.request.mockResolvedValueOnce(response(429, {}, retry));
    expect(await gateway.create(config, body)).toEqual({
      kind: 'CONFIGURATION',
    });
  }
  for (const data of [
    { ...created, requestTypeId: '99' },
    { ...created, serviceDeskId: '99' },
    { ...created, issueKey: '../private' },
    { ...created, issueId: null },
    null,
  ]) {
    mocked.request.mockResolvedValueOnce(response(201, data));
    expect(await gateway.create(config, body)).toEqual({ kind: 'AMBIGUOUS' });
  }
  mocked.request.mockResolvedValueOnce(response(503, {}));
  expect(await gateway.create(config, body)).toEqual({ kind: 'AMBIGUOUS' });
  mocked.request.mockRejectedValueOnce(new Error('private'));
  expect(await gateway.create(config, body)).toEqual({ kind: 'AMBIGUOUS' });
  expect(
    await gateway.create(config, { ...body, serviceDeskId: '99' }),
  ).toEqual({ kind: 'CONFIGURATION' });
  expect(
    await gateway.create(config, { ...body, requestTypeId: '99' }),
  ).toEqual({ kind: 'CONFIGURATION' });
});
it('uses bounded enhanced search and exact marker/project/request identity verification', async () => {
  mocked.request
    .mockResolvedValueOnce(
      response(200, { isLast: true, issues: [candidate()] }),
    )
    .mockResolvedValueOnce(response(200, created));
  expect(await new ForgeJsmGateway().find(config, marker)).toEqual({
    complete: true,
    issues: [{ id: '100', key: 'SYN-1' }],
  });
  expect(mocked.request.mock.calls[0]![0].value).toBe('/rest/api/3/search/jql');
  const sent = JSON.parse(mocked.request.mock.calls[0]![1].body);
  expect(sent.maxResults).toBe(2);
  expect(sent.jql).toBe(`project = 10 AND cf[101] ~ "${marker}"`);
});
it('zero matches remains a valid empty search, not proof that POST failed', async () => {
  mocked.request.mockResolvedValueOnce(
    response(200, { isLast: true, issues: [] }),
  );
  expect(await new ForgeJsmGateway().find(config, marker)).toEqual({
    complete: true,
    issues: [],
  });
});
it('fails closed on incomplete searches, near matches, foreign requests, duplicates and injection', async () => {
  const gateway = new ForgeJsmGateway();
  for (const value of [
    { isLast: false, issues: [candidate()] },
    { isLast: true, issues: null },
    { isLast: true, issues: [candidate(), candidate(), candidate()] },
    {
      isLast: true,
      issues: [
        {
          ...candidate(),
          fields: { project: { id: '99' }, customfield_101: marker },
        },
      ],
    },
    {
      isLast: true,
      issues: [
        {
          ...candidate(),
          fields: { project: { id: '10' }, customfield_101: marker + 'other' },
        },
      ],
    },
    null,
  ]) {
    mocked.request.mockResolvedValueOnce(response(200, value));
    expect(await gateway.find(config, marker)).toEqual({
      complete: false,
      issues: [],
    });
  }
  for (const value of [
    { ...created, requestTypeId: '99' },
    { ...created, serviceDeskId: '99' },
    { ...created, issueId: '101' },
  ]) {
    mocked.request
      .mockResolvedValueOnce(
        response(200, { isLast: true, issues: [candidate()] }),
      )
      .mockResolvedValueOnce(response(200, value));
    expect(await gateway.find(config, marker)).toEqual({
      complete: false,
      issues: [],
    });
  }
  mocked.request
    .mockResolvedValueOnce(
      response(200, { isLast: true, issues: [candidate()] }),
    )
    .mockResolvedValueOnce(response(403, {}));
  expect(await gateway.find(config, marker)).toEqual({
    complete: false,
    issues: [],
  });
  mocked.request
    .mockResolvedValueOnce(
      response(200, { isLast: true, issues: [candidate(), candidate()] }),
    )
    .mockResolvedValueOnce(response(200, created))
    .mockResolvedValueOnce(response(200, created));
  expect(await gateway.find(config, marker)).toEqual({
    complete: false,
    issues: [],
  });
  mocked.request.mockResolvedValueOnce(response(403, {}));
  expect(await gateway.find(config, marker)).toEqual({
    complete: false,
    issues: [],
  });
  mocked.request.mockRejectedValueOnce(new Error('private'));
  expect(await gateway.find(config, marker)).toEqual({
    complete: false,
    issues: [],
  });
  expect(await gateway.find(config, 'injection"')).toEqual({
    complete: false,
    issues: [],
  });
  expect(
    await gateway.find(
      { ...config, fields: { ...config.fields, marker: 'unsafe' } },
      marker,
    ),
  ).toEqual({ complete: false, issues: [] });
  expect(
    await gateway.find({ ...config, projectId: '10 OR 1=1' }, marker),
  ).toEqual({ complete: false, issues: [] });
});
