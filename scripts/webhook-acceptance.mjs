// Synthetic HTTP acceptance runner. Importing this module never performs network operations.
import { randomUUID, randomInt } from 'node:crypto';
import { pathToFileURL, URL } from 'node:url';
import { TextDecoder } from 'node:util';
const outcomes = new Set([
  'accepted',
  'invalid',
  'unauthorised',
  'conflict',
  'too_large',
  'method',
  'rate_limited',
  'unavailable',
]);
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function config(env) {
  if (env.LH_ACCEPTANCE_APPROVAL !== 'approved-development-synthetic-session')
    throw new Error('APPROVAL_REQUIRED');
  let url;
  try {
    url = new URL(env.LH_WEBTRIGGER_URL);
  } catch {
    throw new Error('PRIVATE_CONFIGURATION_INVALID');
  }
  if (
    url.protocol !== 'https:' ||
    !/^[0-9a-f-]{36}\.webtrigger\.atlassian\.app$/i.test(url.hostname) ||
    !/^\/public\/[A-Za-z0-9_-]+$/.test(url.pathname) ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    !uuid.test(env.LH_SOURCE_KEY_ID ?? '') ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(env.LH_SOURCE_SECRET ?? '')
  )
    throw new Error('PRIVATE_CONFIGURATION_INVALID');
  if (
    (env.LH_REVOKED_KEY_ID || env.LH_REVOKED_SECRET) &&
    (!uuid.test(env.LH_REVOKED_KEY_ID ?? '') ||
      !/^[A-Za-z0-9_-]{43,128}$/.test(env.LH_REVOKED_SECRET ?? ''))
  )
    throw new Error('PRIVATE_CONFIGURATION_INVALID');
  return {
    url: url.href,
    keyId: env.LH_SOURCE_KEY_ID,
    secret: env.LH_SOURCE_SECRET,
    revokedKey: env.LH_REVOKED_KEY_ID,
    revokedSecret: env.LH_REVOKED_SECRET,
  };
}
async function safeBody(response) {
  if (!response.body) return null;
  const reader = response.body.getReader();
  let size = 0;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    return value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length === 1 &&
      outcomes.has(value.outcome)
      ? { outcome: value.outcome }
      : null;
  } catch {
    return null;
  }
}
export async function runAcceptance(
  settings,
  fetcher = globalThis.fetch,
  now = () => new Date().toISOString(),
) {
  const startedAt = now();
  const externalEventId =
    String(Date.now()) + String(randomInt(100000, 999999));
  const payload = {
    schemaVersion: 1,
    externalEventId,
    problemEventId: externalEventId,
    kind: 'problem',
    externalResourceId: 'synthetic:lh-103-acceptance',
    occurredAt: startedAt,
    severity: '4',
    title: 'Synthetic Light House acceptance',
  };
  const records = [];
  async function submit(name, body, expected, auth = 'valid') {
    const clickAt = now();
    let response;
    try {
      const headers = {
        'content-type': 'application/json',
        'x-light-house-sent-at': now(),
        'x-light-house-key-id':
          auth === 'revoked' ? settings.revokedKey : settings.keyId,
      };
      if (auth !== 'missing')
        headers.authorization =
          'Bearer ' +
          (auth === 'wrong'
            ? 'x'.repeat(43)
            : auth === 'revoked'
              ? settings.revokedSecret
              : settings.secret);
      response = await fetcher(settings.url, {
        method: 'POST',
        headers,
        body: typeof body === 'string' ? body : JSON.stringify(body),
        redirect: 'error',
        signal: globalThis.AbortSignal.timeout(15000),
      });
      const sanitisedBody = await safeBody(response);
      const header = response.headers.get('x-correlation-id');
      const record = {
        name,
        initiatedAt: clickAt,
        completedAt: now(),
        httpStatus: response.status,
        body: sanitisedBody,
        serverCorrelationId: uuid.test(header ?? '') ? header : null,
        correlationEvidence: uuid.test(header ?? '')
          ? 'response-header'
          : 'unavailable-static-response',
        expected,
        passed: response.status === expected && sanitisedBody !== null,
      };
      records.push(record);
      return record.passed;
    } catch {
      records.push({
        name,
        initiatedAt: clickAt,
        completedAt: now(),
        httpStatus: null,
        body: null,
        serverCorrelationId: null,
        passed: false,
        error: 'HTTP_REQUEST_FAILED',
      });
      return false;
    }
  }
  // Stop after the current bounded batch on unexpected response; never retry automatically.
  const checks = [
    ['missing-auth', payload, 401, 'missing'],
    ['wrong-auth', payload, 401, 'wrong'],
    ['malformed', '{', 400],
    ['unsupported-kind', { ...payload, kind: 'unknown' }, 400],
    ['tenant-impersonation', { ...payload, tenantId: randomUUID() }, 400],
  ];
  if (settings.revokedKey)
    checks.push(['revoked-auth', payload, 401, 'revoked']);
  for (const [name, body, status, auth] of checks)
    if (!(await submit(name, body, status, auth))) return finish(true);
  if (!(await submit('valid-event', payload, 202))) return finish(true);
  if (!(await submit('duplicate-replay', payload, 202))) return finish(true);
  const concurrent = await Promise.all([
    submit('concurrent-duplicate-a', payload, 202),
    submit('concurrent-duplicate-b', payload, 202),
  ]);
  if (concurrent.some((ok) => !ok)) return finish(true);
  if (!(await submit('changed-duplicate', { ...payload, severity: '3' }, 409)))
    return finish(true);
  return finish(false);
  function finish(stopped) {
    return {
      schemaVersion: 1,
      runId: randomUUID(),
      startedAt,
      completedAt: now(),
      externalEventId,
      requests: records.length,
      stopped,
      records,
      processing: null,
      processingEvidence:
        'NOT_OBSERVED: reconcile externalEventId with authorised UI receipts and curated hosted logs; HTTP 202 is not processing completion',
      duplicateEvidence:
        'HTTP outcomes only; verify one durable receipt and duplicate count separately',
      revocationEvidence: settings.revokedKey
        ? 'attempted'
        : 'NOT_TESTED: no approved revoked credential supplied',
    };
  }
}
async function main() {
  if (process.argv.includes('--dry-run')) {
    console.log(
      JSON.stringify({
        dryRun: true,
        maxRequests: 11,
        permittedWrites:
          'synthetic inbox, authentication-valid observations and bounded processing only; no configuration or SQL DDL',
        processing: 'requires separate curated receipt/log evidence',
      }),
    );
    return;
  }
  try {
    const report = await runAcceptance(config(process.env));
    console.log(JSON.stringify(report, null, 2));
    if (report.stopped) process.exitCode = 1;
  } catch (error) {
    console.error(
      ['APPROVAL_REQUIRED', 'PRIVATE_CONFIGURATION_INVALID'].includes(
        error?.message,
      )
        ? error.message
        : 'ACCEPTANCE_RUNNER_FAILED',
    );
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
