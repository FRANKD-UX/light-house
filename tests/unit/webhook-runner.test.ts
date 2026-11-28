// No HTTP/network execution: injected synthetic Fetch responses only.
import { expect, it, vi } from 'vitest';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const runner = await import(
  /* @vite-ignore */ pathToFileURL(resolve('scripts/webhook-acceptance.mjs'))
    .href
);
const env = {
  LH_ACCEPTANCE_APPROVAL: 'approved-development-synthetic-session',
  LH_WEBTRIGGER_URL:
    'https://00000000-0000-4000-8000-000000000001.webtrigger.atlassian.app/public/synthetic',
  LH_SOURCE_KEY_ID: '00000000-0000-4000-8000-000000000002',
  LH_SOURCE_SECRET: 'a'.repeat(43),
};
it('requires approved private configuration and refuses redirects, credentials, query strings and arbitrary hosts', () => {
  expect(runner.config(env)).toMatchObject({ keyId: env.LH_SOURCE_KEY_ID });
  for (const override of [
    { LH_ACCEPTANCE_APPROVAL: '' },
    { LH_WEBTRIGGER_URL: 'https://example.invalid/' },
    { LH_WEBTRIGGER_URL: env.LH_WEBTRIGGER_URL + '?secret=bad' },
    { LH_SOURCE_SECRET: 'short' },
    { LH_REVOKED_KEY_ID: env.LH_SOURCE_KEY_ID },
  ])
    expect(() => runner.config({ ...env, ...override })).toThrow();
});
it('runs bounded auth/validation/duplicate checks while preserving timestamps and evidence gaps', async () => {
  const statuses = [401, 401, 400, 400, 400, 401, 202, 202, 202, 202, 409];
  let i = 0;
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          outcome:
            statuses[i] === 202
              ? 'accepted'
              : statuses[i] === 409
                ? 'conflict'
                : statuses[i] === 400
                  ? 'invalid'
                  : 'unauthorised',
        }),
        { status: statuses[i++]! },
      ),
  );
  const settings = runner.config({
    ...env,
    LH_REVOKED_KEY_ID: env.LH_SOURCE_KEY_ID,
    LH_REVOKED_SECRET: 'b'.repeat(43),
  });
  const result = await runner.runAcceptance(settings, fetcher);
  expect(result).toMatchObject({
    requests: 11,
    stopped: false,
    processing: null,
  });
  expect(result.records.every((r: { passed: boolean }) => r.passed)).toBe(true);
  expect(JSON.stringify(result)).not.toContain(env.LH_SOURCE_SECRET);
  expect(JSON.stringify(result)).not.toContain(env.LH_WEBTRIGGER_URL);
  expect(result.records[0].serverCorrelationId).toBeNull();
  expect(result.records[0].initiatedAt).toMatch(/Z$/);
  expect(fetcher.mock.calls).toHaveLength(11);
});
it('stops on unexpected status, rejects arbitrary/oversized bodies and never copies request failures into reports', async () => {
  for (const response of [
    new Response('private payload', { status: 500 }),
    new Response('x'.repeat(2000), { status: 401 }),
    new Response(null, { status: 401 }),
  ]) {
    const fetcher = vi.fn(async () => response);
    const result = await runner.runAcceptance(runner.config(env), fetcher);
    expect(result.stopped).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain('private payload');
  }
  const result = await runner.runAcceptance(runner.config(env), async () => {
    throw new Error('secret endpoint');
  });
  expect(result.records[0].error).toBe('HTTP_REQUEST_FAILED');
  expect(JSON.stringify(result)).not.toContain('secret endpoint');
});
