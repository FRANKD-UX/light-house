import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertReadButton,
  approvedTarget,
  assertTarget,
  safeText,
  target,
  visibleFailure,
} from '../src/policy.js';
import { correlate, parseLogs } from '../src/logs.js';
import { escapeHtml, reportHtml } from '../src/report.js';
import type { Operation, Report } from '../src/model.js';
const id = '878d3b6f-6fec-4e2d-bb07-829509844583';
const other = '31fb85d8-dc27-43ee-8fa6-be0f80c2cd18';
const op: Operation = {
  operation: 'inventory',
  inventoryType: 'sites',
  page: 1,
  startedAt: '2026-11-26T19:29:19.000Z',
  completedAt: '2026-11-26T19:29:20.000Z',
  durationMs: 1000,
  outcome: 'success',
  visibleResult: 'success',
  displayedRowCount: 0,
  records: [],
  recordsFresh: true,
  backendCode: null,
  correlationId: null,
  error: null,
};
const lines = (correlationId = id) =>
  [
    'resolver.entry',
    'inventory.sql',
    'inventory.mapping',
    'response.contract',
    'response.serialization',
    'resolver.completion',
  ]
    .map(
      (stage) =>
        `INFO 2026-11-26T19:29:19.500Z ${JSON.stringify({ event: 'inventory.diagnostic', operation: 'inventory.list', correlationId, stage, outcome: 'success', message: 'token=secret', tenantId: 'private' })}`,
    )
    .concat(
      `INFO 2026-11-26T19:29:19.100Z ${JSON.stringify({ event: 'inventory.diagnostic', operation: 'inventory.list', correlationId, stage: 'resolver.entry', outcome: 'started' })}`,
    )
    .join('\n');

test('only exact approved DEVELOPMENT path and read actions are admitted', () => {
  assert.doesNotThrow(() => assertTarget(target.url));
  for (const url of [
    target.url + '?environment=production',
    target.url + '#other',
    target.url + '/other',
    'https://example.com/',
  ])
    assert.throws(() => assertTarget(url));
  for (const action of [
    'Queue migration',
    'Bootstrap ISP',
    'Seed next batch',
    'Create repair probe',
    'Repair pending mutation',
    'Save record',
    'Save ISP configuration',
    'Save access grant',
    'Edit',
    'Publish',
  ])
    assert.throws(() => assertReadButton(action));
  assert.doesNotThrow(() => assertReadButton('Load inventory'));
  const configured = {
    url: 'https://example.atlassian.net/jira/apps/1ef4af03-f1ed-4498-a83e-1a8978cf5430/22222222-2222-4222-8222-222222222222',
    environment: 'DEVELOPMENT',
    deployedVersion: '3.3.0',
    tenantLabel: 'Lantern Fibre (admin)',
  };
  assert.equal(approvedTarget(configured).url, configured.url);
  for (const invalid of [
    null,
    { ...configured, environment: 'PRODUCTION' },
    { ...configured, url: configured.url + '?other=1' },
    { ...configured, url: 'https://example.invalid/' },
    { ...configured, token: 'not-permitted' },
    {
      ...configured,
      url: configured.url.replace(
        '22222222-2222-4222-8222-222222222222',
        'invalid',
      ),
    },
  ])
    assert.throws(() => approvedTarget(invalid));
});
test('redacts auth patterns and escapes report markup', () => {
  const privateText =
    'token=private Bearer secret owner@example.com https://example.com/?secret=secret';
  assert.doesNotMatch(
    safeText(privateText),
    /private|Bearer secret|owner@|https:/,
  );
  assert.equal(escapeHtml('<script>"&'), '&lt;script&gt;&quot;&amp;');
  assert.deepEqual(
    visibleFailure(`Backend code: UNAVAILABLE. Correlation ID: ${id}.`),
    { backendCode: 'UNAVAILABLE', correlationId: id },
  );
  assert.deepEqual(
    visibleFailure('Backend code: SECRET. Correlation ID: token.'),
    { backendCode: null, correlationId: null },
  );
});
test('projects only fixed hosted fields, never raw log content', () => {
  const events = parseLogs(lines());
  assert.equal(events.length, 7);
  assert.doesNotMatch(
    JSON.stringify(events),
    /secret|private|tenantId|message/,
  );
  assert.deepEqual(
    parseLogs(
      'token=secret\nINFO 2026-11-26T19:29:19.500Z {"event":"untrusted"}',
    ),
    [],
  );
});
test('grouped CLI time-only output needs a unique bounded UTC date', () => {
  const raw = lines().replaceAll('2026-11-26T', '');
  assert.deepEqual(parseLogs(raw), []);
  const projected = parseLogs(raw, {
    since: op.startedAt,
    until: op.completedAt,
  });
  assert.equal(projected.length, 7);
  assert.equal(projected[0]!.timestamp, '2026-11-26T19:29:19.500Z');
  assert.equal(projected[0]!.timestampBasis, 'unique-bounded-utc-date');
  assert.deepEqual(
    parseLogs(raw, {
      since: '2026-11-25T00:00:00.000Z',
      until: '2026-11-26T23:59:59.000Z',
    }),
    [],
  );
  const midnight = parseLogs(raw, {
    since: '2026-11-26T23:59:00.000Z',
    until: '2026-11-27T19:30:00.000Z',
  });
  assert.equal(midnight[0]!.timestamp, '2026-11-27T19:29:19.500Z');
});
test('unique timed candidates remain explicitly distinct from UUID matches', () => {
  const match = correlate([op], parseLogs(lines()))[0]!;
  assert.equal(match.basis, 'unique-time-candidate');
  assert.equal(match.lifecycleComplete, true);
  assert.equal(
    correlate([{ ...op, correlationId: id }], parseLogs(lines()))[0]!.basis,
    'displayed-uuid',
  );
});
test('ambiguous, reused, out-of-window and absent events never become matches', () => {
  assert.equal(
    correlate([op], parseLogs(lines() + '\n' + lines(other)))[0]!.basis,
    'ambiguous',
  );
  assert.equal(correlate([op, op], parseLogs(lines()))[0]!.basis, 'ambiguous');
  assert.equal(
    correlate([{ ...op, startedAt: op.completedAt }], parseLogs(lines()))[0]!
      .basis,
    'unmatched',
  );
  assert.equal(
    correlate([{ ...op, correlationId: other }], parseLogs(lines()))[0]!.basis,
    'unmatched',
  );
});
test('partial/failing lifecycles are not reported as hosted success', () => {
  const events = parseLogs(lines());
  events[1]!.outcome = 'failure';
  assert.equal(correlate([op], events)[0]!.lifecycleComplete, false);
  assert.equal(
    correlate([op], events.slice(0, 3))[0]!.lifecycleComplete,
    false,
  );
});
test('HTML evidence cannot run displayed record scripts or external resources', () => {
  const report: Report = {
    schemaVersion: 1,
    target: 'Light House DEVELOPMENT',
    expectedDeployedVersion: '3.3.0',
    versionVerification: 'not inferred',
    startedAt: op.startedAt,
    completedAt: op.completedAt,
    outcome: 'failed',
    operations: [{ ...op, visibleResult: '<script>alert(1)</script>' }],
    pageErrorCount: 0,
    logs: { status: 'not-requested', reason: null, matches: [] },
    limitations: [],
  };
  const html = reportHtml(report);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /default-src 'none'/);
});
