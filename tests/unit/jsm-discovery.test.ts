// Mocked HTTP transport only; no Jira, Forge or native acceptance requests.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
const { discover, main } = await import(
  /* @vite-ignore */ pathToFileURL(resolve('scripts/jsm-discovery.mjs')).href
);
const input = {
  site: 'https://synthetic.atlassian.net',
  email: 'owner@example.com',
  token: 'private-token',
};
const desk = {
  id: '1',
  projectId: '10',
  projectKey: 'SYNTH',
  projectName: 'Synthetic desk',
  _links: { self: 'private-link' },
  secret: 'private-payload',
};
function page(
  values: unknown[] = [desk],
  start = 0,
  isLastPage = true,
  limit = 20,
) {
  return {
    values,
    start,
    limit,
    isLastPage,
    _links: { next: 'https://evil.example/' },
  };
}
function response(value: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(value), init);
}
describe('bounded owner-operated JSM discovery', () => {
  it('is inert on import, makes only the fixed GET, and projects allowlisted fields', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(page()));
    const result = await discover(input, fetcher);
    expect(result).toEqual({
      ok: true,
      kind: 'service-desks',
      values: [
        {
          id: '1',
          projectId: '10',
          projectKey: 'SYNTH',
          projectName: 'Synthetic desk',
        },
      ],
      isLastPage: true,
      nextCursor: null,
      truncated: false,
      visibility: 'current-credential-only',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      'https://synthetic.atlassian.net/rest/servicedeskapi/servicedesk?start=0&limit=20',
      expect.objectContaining({
        method: 'GET',
        redirect: 'error',
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${Buffer.from('owner@example.com:private-token').toString('base64')}`,
        },
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(
      /private|atlassian\.net|owner@example/,
    );
  });
  it('rejects unsafe origins, credentials, desk selectors and paging before transport', async () => {
    const fetcher = vi.fn();
    for (const site of [
      'http://synthetic.atlassian.net',
      'https://atlassian.net',
      'https://synthetic.atlassian.net.evil.example',
      'https://user@synthetic.atlassian.net',
      'https://synthetic.atlassian.net:443',
      'https://synthetic.atlassian.net/path',
      'https://synthetic.atlassian.net?x=1',
      'https://synthetic.atlassian.net#x',
      'https://synth%65tic.atlassian.net',
    ])
      expect(await discover({ ...input, site }, fetcher)).toEqual({
        ok: false,
        code: 'INVALID_INPUT',
      });
    for (const options of [
      { desk: '../1' },
      { desk: '01' },
      { desk: 1 },
      { start: '-1' },
      { start: '01' },
      { start: '1000001' },
      { maxPages: '6' },
      { maxPages: '0' },
    ])
      expect(await discover({ ...input, ...options }, fetcher)).toEqual({
        ok: false,
        code: 'INVALID_INPUT',
      });
    for (const options of [
      { email: 'a:b@example.com' },
      { token: '' },
      { token: 'private\nheader' },
    ])
      expect(await discover({ ...input, ...options }, fetcher)).toEqual({
        ok: false,
        code: 'CREDENTIALS_REQUIRED',
      });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('uses only an exact numeric desk path and checks response desk binding', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response(
          page([
            {
              id: '7',
              serviceDeskId: '1',
              name: 'Synthetic incident',
              description: 'private-description',
            },
          ]),
        ),
      )
      .mockResolvedValueOnce(
        response(
          page([{ id: '7', serviceDeskId: '2', name: 'Foreign request' }]),
        ),
      );
    expect(await discover({ ...input, desk: '1' }, fetcher)).toMatchObject({
      ok: true,
      kind: 'request-types',
      values: [{ id: '7', serviceDeskId: '1', name: 'Synthetic incident' }],
    });
    expect(fetcher.mock.calls[0]![0]).toBe(
      'https://synthetic.atlassian.net/rest/servicedeskapi/servicedesk/1/requesttype?start=0&limit=20',
    );
    expect(await discover({ ...input, desk: '1' }, fetcher)).toEqual({
      ok: false,
      code: 'INVALID_RESPONSE',
    });
  });
  it('bounds five pages and 100 rows, never follows supplied links, and exposes a resumable truncation', async () => {
    const fetcher = vi.fn(async (url: string) => {
      const start = Number(new URL(url).searchParams.get('start'));
      return response(
        page(
          Array.from({ length: 20 }, (_, index) => ({
            ...desk,
            id: String(start + index + 1),
          })),
          start,
          false,
        ),
      );
    });
    const result = await discover(input, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(result.values).toHaveLength(100);
    expect(result).toMatchObject({
      ok: true,
      truncated: true,
      isLastPage: false,
      nextCursor: '100',
    });
    const resumed = await discover(
      { ...input, start: '100', maxPages: '1' },
      fetcher,
    );
    expect(resumed).toMatchObject({ nextCursor: '120', truncated: true });
  });
  it('honours a smaller server page limit and stops on actual last page', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(page([desk], 0, false, 1)))
      .mockResolvedValueOnce(
        response(page([{ ...desk, id: '2' }], 1, true, 1)),
      );
    expect(await discover(input, fetcher)).toMatchObject({
      ok: true,
      isLastPage: true,
      nextCursor: null,
      truncated: false,
    });
    expect(fetcher.mock.calls[1]![0]).toContain('start=1&limit=20');
  });
  it('rejects malformed pagination, duplicate identities and untrusted row shapes', async () => {
    for (const value of [
      null,
      {},
      page([], 0, false),
      page([desk], 1),
      page([desk], 0, true, 21),
      page([desk, desk]),
      page([null]),
      page([{ ...desk, projectId: 'bad' }]),
      page([{ ...desk, projectName: 'raw\nmessage' }]),
      page(Array.from({ length: 21 }, () => desk)),
    ]) {
      expect(
        await discover(input, vi.fn().mockResolvedValue(response(value))),
      ).toEqual({ ok: false, code: 'INVALID_RESPONSE' });
    }
  });
  it('never retries or leaks error bodies, transport exceptions or redirect locations', async () => {
    for (const [status, code] of [
      [401, 'ACCESS_DENIED'],
      [403, 'ACCESS_DENIED'],
      [429, 'RATE_LIMITED'],
      [500, 'HTTP_FAILED'],
      [302, 'HTTP_FAILED'],
    ] as const) {
      const fetcher = vi
        .fn()
        .mockResolvedValue(response({ raw: 'private-token' }, { status }));
      expect(await discover(input, fetcher)).toEqual({ ok: false, code });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
    expect(
      await discover(
        input,
        vi.fn().mockRejectedValue(new Error('private-token')),
      ),
    ).toEqual({ ok: false, code: 'REQUEST_FAILED' });
    const redirected = response(page());
    Object.defineProperty(redirected, 'redirected', { value: true });
    expect(
      await discover(input, vi.fn().mockResolvedValue(redirected)),
    ).toEqual({ ok: false, code: 'REDIRECT_REJECTED' });
    const altered = response(page());
    Object.defineProperty(altered, 'url', { value: 'https://evil.example/' });
    expect(await discover(input, vi.fn().mockResolvedValue(altered))).toEqual({
      ok: false,
      code: 'REDIRECT_REJECTED',
    });
  });
  it('bounds response bytes with and without a content length and masks invalid JSON', async () => {
    const huge = 'x'.repeat(1_048_577);
    for (const result of [
      new Response(huge),
      new Response('{}', {
        headers: { 'content-length': String(huge.length) },
      }),
    ])
      expect(await discover(input, vi.fn().mockResolvedValue(result))).toEqual({
        ok: false,
        code: 'RESPONSE_TOO_LARGE',
      });
    expect(
      await discover(
        input,
        vi.fn().mockResolvedValue(new Response('private-broken-json')),
      ),
    ).toEqual({ ok: false, code: 'REQUEST_FAILED' });
  });
  it('reads a fixed field object without paging and omits descriptions, defaults, labels and identities', async () => {
    const metadata = {
      canRaiseOnBehalfOf: true,
      users: ['private-user'],
      requestTypeFields: [
        {
          fieldId: 'summary',
          name: 'Summary',
          required: true,
          jiraSchema: { type: 'string', system: 'summary' },
          validValues: [],
          defaultValues: ['private-default'],
          description: 'private-description',
        },
        {
          fieldId: 'customfield_100',
          name: 'Category',
          required: false,
          jiraSchema: { type: 'string', custom: 'private-schema' },
          validValues: [
            {
              value: '100',
              label: 'private-option-label',
              children: [
                { value: '101', label: 'private-child-label', children: [] },
              ],
            },
          ],
        },
        {
          fieldId: 'customfield_101',
          name: 'Nominee',
          required: false,
          jiraSchema: { type: 'user' },
          validValues: [],
        },
      ],
    };
    const fetcher = vi.fn().mockResolvedValue(response(metadata));
    const result = await discover({ ...input, desk: '1', type: '2' }, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]![0]).toBe(
      'https://synthetic.atlassian.net/rest/servicedeskapi/servicedesk/1/requesttype/2/field',
    );
    expect(result).toEqual({
      ok: true,
      kind: 'request-type-fields',
      serviceDeskId: '1',
      requestTypeId: '2',
      visibility: 'current-credential-only',
      metadataShape: 'bounded-nonpaginated-object',
      fields: [
        {
          fieldId: 'summary',
          name: 'Summary',
          required: true,
          jiraSchema: { type: 'string' },
          validValues: [],
        },
        {
          fieldId: 'customfield_100',
          name: 'Category',
          required: false,
          jiraSchema: { type: 'string' },
          validValues: [{ id: '100', children: [{ id: '101', children: [] }] }],
        },
        {
          fieldId: 'customfield_101',
          name: 'Nominee',
          required: false,
          jiraSchema: { type: 'user' },
          validValues: [],
        },
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /private|users|default|description|label/,
    );
    expect(result).not.toHaveProperty('isLastPage');
  });
  it('rejects type selectors without a desk or with pagination and rejects unsupported field metadata', async () => {
    const fetcher = vi.fn();
    for (const options of [
      { type: '2' },
      { desk: '1', type: '2/field' },
      { desk: '1', type: '02' },
      { desk: '1', type: '2', start: '0' },
      { desk: '1', type: '2', maxPages: '1' },
    ])
      expect(await discover({ ...input, ...options }, fetcher)).toEqual({
        ok: false,
        code: 'INVALID_INPUT',
      });
    expect(fetcher).not.toHaveBeenCalled();
    const field = {
      fieldId: 'summary',
      name: 'Summary',
      required: true,
      jiraSchema: { type: 'string' },
      validValues: [],
    };
    const leaf = { value: '1', children: [] as unknown[] };
    const nested = {
      value: '2',
      children: [
        {
          value: '3',
          children: [
            { value: '4', children: [{ value: '5', children: [leaf] }] },
          ],
        },
      ],
    };
    for (const requestTypeFields of [
      null,
      Array.from({ length: 101 }, () => field),
      [null],
      [field, field],
      [{ ...field, required: 'true' }],
      [{ ...field, jiraSchema: null }],
      [{ ...field, validValues: [{ value: 'private-account-id' }] }],
      [
        {
          ...field,
          jiraSchema: { type: 'user' },
          validValues: [{ value: '123' }],
        },
      ],
      [{ ...field, validValues: Array.from({ length: 101 }, () => leaf) }],
      [
        {
          ...field,
          jiraSchema: { type: 'array', items: 'user' },
          validValues: [leaf],
        },
      ],
      Array.from({ length: 11 }, (_, index) => ({
        ...field,
        fieldId: `customfield_${index + 1}`,
        validValues: Array.from({ length: 100 }, (_, option) => ({
          value: String(option + 1),
          children: [],
        })),
      })),
      [{ ...field, validValues: [nested] }],
    ]) {
      const result = await discover(
        { ...input, desk: '1', type: '2' },
        vi.fn().mockResolvedValue(response({ requestTypeFields })),
      );
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toMatch(/private|Summary/);
    }
    expect(
      await discover(
        { ...input, desk: '1', type: '2' },
        vi.fn().mockResolvedValue(response(page())),
      ),
    ).toEqual({ ok: false, code: 'INVALID_RESPONSE' });
  });
  it('CLI validates a closed argument set and prints only curated JSON', async () => {
    const output = vi.fn(),
      fetcher = vi.fn().mockResolvedValue(response(page()));
    const env = {
      LH_JSM_SITE: input.site,
      LH_JSM_EMAIL: input.email,
      LH_JSM_API_TOKEN: input.token,
    };
    for (const args of [
      ['--url', 'private'],
      ['--desk'],
      ['--start', '0', '--start', '1'],
      ['--help'],
      ['constructor', 'private'],
      ['__proto__', 'private'],
    ])
      expect(await main(args, env, fetcher, output)).toBe(1);
    expect(fetcher).not.toHaveBeenCalled();
    expect(await main([], env, fetcher, output)).toBe(0);
    expect(JSON.stringify(output.mock.calls)).not.toMatch(
      /private-token|owner@example|synthetic\.atlassian/,
    );
  });
});
