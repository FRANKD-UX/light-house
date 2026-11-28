import { execFile } from 'node:child_process';
import { promisify, stripVTControlCharacters } from 'node:util';
import path from 'node:path';
import { uuid, workspace } from './policy.js';
import type { HostedEvent, Match, Operation } from './model.js';
const stages = [
  'resolver.entry',
  'installation.context',
  'schema.readiness',
  'schema.sql',
  'tenant.membership',
  'tenant.authorisation',
  'inventory.parameters',
  'inventory.query',
  'inventory.sql',
  'inventory.mapping',
  'response.contract',
  'response.serialization',
  'resolver.completion',
];
const codes = [
  'SQL_EXECUTION_ERROR',
  'INVALID_SQL_QUERY',
  'SQL_POLICY_VIOLATION',
  'QUERY_TIMED_OUT',
  'ER_PARSE_ERROR',
  'ER_WRONG_ARGUMENTS',
  'ER_NO_SUCH_TABLE',
  'ER_BAD_FIELD_ERROR',
  'ER_ACCESS_DENIED_ERROR',
];
const categories = [
  'INVENTORY_ERROR',
  'SQL_ERROR',
  'TYPE_ERROR',
  'SYNTAX_ERROR',
  'UNKNOWN_ERROR',
];
const optional = (value: unknown, allow: string[]): string | null =>
  typeof value === 'string' && allow.includes(value) ? value : null;
function logTimestamp(
  line: string,
  window?: { since: string; until: string },
): { timestamp: string; timestampBasis: HostedEvent['timestampBasis'] } | null {
  const full = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/.exec(line)?.[0];
  if (full && Number.isFinite(Date.parse(full)))
    return { timestamp: full, timestampBasis: 'cli-full-utc' };
  const time = /\b\d{2}:\d{2}:\d{2}\.\d{3}Z\b/.exec(line)?.[0];
  if (!time || !window) return null;
  const start = Date.parse(window.since);
  const end = Date.parse(window.until);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end < start ||
    end - start > 48 * 60 * 60 * 1000
  )
    return null;
  const candidates: string[] = [];
  for (
    let day = Math.floor(start / 86_400_000);
    day <= Math.floor(end / 86_400_000);
    day++
  ) {
    const timestamp =
      new Date(day * 86_400_000).toISOString().slice(0, 10) + 'T' + time;
    const value = Date.parse(timestamp);
    if (value >= start && value <= end) candidates.push(timestamp);
  }
  return candidates.length === 1
    ? { timestamp: candidates[0]!, timestampBasis: 'unique-bounded-utc-date' }
    : null;
}
export function parseLogs(
  raw: string,
  window?: { since: string; until: string },
): HostedEvent[] {
  const events: HostedEvent[] = [];
  for (const line of stripVTControlCharacters(raw).split('\n')) {
    const start = line.indexOf('{');
    if (start < 0) continue;
    const stamp = logTimestamp(line.slice(0, start), window);
    if (!stamp) continue;
    try {
      const value: unknown = JSON.parse(line.slice(start));
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      const get = (key: string): unknown => Reflect.get(value, key);
      const event = get('event');
      const id = get('correlationId');
      const outcome = get('outcome');
      if (
        (event !== 'inventory.diagnostic' && event !== 'backend.status') ||
        typeof id !== 'string' ||
        !uuid.test(id) ||
        (outcome !== 'started' &&
          outcome !== 'success' &&
          outcome !== 'failure')
      )
        continue;
      if (
        event === 'inventory.diagnostic' &&
        get('operation') !== 'inventory.list'
      )
        continue;
      const duration = get('durationMs');
      events.push({
        ...stamp,
        event,
        correlationId: id,
        outcome,
        stage: optional(get('stage'), stages),
        durationMs:
          typeof duration === 'number' &&
          Number.isSafeInteger(duration) &&
          duration >= 0
            ? duration
            : null,
        exceptionCategory: optional(get('exceptionCategory'), categories),
        errorCode: optional(get('errorCode'), codes),
        providerCode: optional(get('providerCode'), codes),
      });
    } catch {
      /* Non-JSON CLI/platform output is discarded, never persisted. */
    }
  }
  return events;
}
export function correlate(
  operations: Operation[],
  events: HostedEvent[],
): Match[] {
  const ids = [...new Set(events.map((event) => event.correlationId))];
  const windowCandidates = (operation: Operation): string[] =>
    ids.filter((id) => {
      const group = events.filter((event) => event.correlationId === id);
      const entry = group.find(
        (event) =>
          event.stage === 'resolver.entry' && event.outcome === 'started',
      );
      const completion = group.find(
        (event) =>
          event.stage === 'resolver.completion' && event.outcome !== 'started',
      );
      // Exact UTC operation interval only: no unverified clock-skew allowance.
      return (
        !!entry &&
        !!completion &&
        Date.parse(entry.timestamp) >= Date.parse(operation.startedAt) &&
        Date.parse(completion.timestamp) <= Date.parse(operation.completedAt)
      );
    });
  return operations.map((operation, operationIndex) => {
    let id = operation.correlationId;
    let basis: Match['basis'] = id
      ? 'displayed-uuid'
      : operation.operation === 'inventory'
        ? 'unmatched'
        : 'not-instrumented';
    if (!id && operation.operation === 'inventory') {
      const candidates = windowCandidates(operation);
      if (candidates.length === 1) {
        const candidate = candidates[0]!;
        const consumers = operations.filter(
          (op) =>
            op.operation === 'inventory' &&
            windowCandidates(op).includes(candidate),
        );
        if (consumers.length === 1) {
          id = candidate;
          basis = 'unique-time-candidate';
        } else basis = 'ambiguous';
      } else if (candidates.length > 1) basis = 'ambiguous';
    }
    const matching = id
      ? events.filter((event) => event.correlationId === id)
      : [];
    if (id && !matching.length) basis = 'unmatched';
    const required = [
      'resolver.entry',
      'inventory.sql',
      'inventory.mapping',
      'response.contract',
      'response.serialization',
      'resolver.completion',
    ];
    return {
      operationIndex,
      basis,
      correlationId: matching.length ? id : null,
      lifecycleComplete:
        required.every((stage) =>
          matching.some(
            (event) => event.stage === stage && event.outcome === 'success',
          ),
        ) && !matching.some((event) => event.outcome === 'failure'),
      events: matching,
    };
  });
}
export async function hostedLogs(since: string): Promise<HostedEvent[]> {
  if (!Number.isFinite(Date.parse(since)))
    throw new Error('INVALID_LOG_WINDOW');
  const { stdout } = await promisify(execFile)(
    'forge',
    [
      'logs',
      '--environment',
      'development',
      '--since',
      since,
      '--limit',
      '1000',
      '--grouped',
      '--non-interactive',
    ],
    {
      cwd: path.dirname(workspace),
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
      env: {
        ...process.env,
        ATL_FORGE_ATTRIBUTION_SKILL_NAME: 'forge-debugger',
      },
    },
  );
  return parseLogs(stdout, { since, until: new Date().toISOString() });
}
