import {
  object,
  text,
  uuid,
  utc,
  integer,
} from '../../../src/domain/inventory/model';
import {
  inboxStates,
  type PublicReceipt,
  type PublicSource,
  type MonitoringObservation,
  type TriageReason,
} from '../../../src/domain/monitoring/model';
export interface MonitoringOverview {
  sources: PublicSource[];
  receipts: PublicReceipt[];
  observations: MonitoringObservation[];
  next: string | null;
  sourceNext: string | null;
}
const nullableId = (v: unknown) => (v === null ? null : uuid(v));
const nullableTime = (v: unknown) => (v === null ? null : utc(v));
function one<T extends string>(v: unknown, choices: readonly T[]): T {
  const found = choices.find((c) => c === v);
  if (!found) throw new Error('INVALID_RESPONSE');
  return found;
}
const reasons = [
  'DISPATCH_PENDING',
  'UNKNOWN_MAPPING',
  'INACTIVE_RESOURCE',
  'SOURCE_DISABLED',
  'PROCESSING_FAILED',
  'RETRY_EXHAUSTED',
] as const;
export function monitoringOverview(input: unknown): MonitoringOverview {
  const v = object(input);
  if (
    !Array.isArray(v.sources) ||
    v.sources.length > 50 ||
    !Array.isArray(v.receipts) ||
    v.receipts.length > 20 ||
    !Array.isArray(v.observations) ||
    v.observations.length > 20
  )
    throw new Error('INVALID_RESPONSE');
  const sources = v.sources.map((value: unknown): PublicSource => {
    const s = object(value);
    return {
      id: uuid(s.id),
      name: text(s.name, 80),
      sourceType: one(s.sourceType, ['zabbix']),
      status: one(s.status, ['active', 'disabled']),
      version: integer(s.version),
      keyId: nullableId(s.keyId),
      previousValidUntil: nullableTime(s.previousValidUntil),
    };
  });
  const receipts = v.receipts.map((value: unknown): PublicReceipt => {
    const r = object(value);
    return {
      id: uuid(r.id),
      sourceId: uuid(r.sourceId),
      correlationId: uuid(r.correlationId),
      duplicates: integer(r.duplicates, Number.MAX_SAFE_INTEGER, 0),
      externalEventId: text(r.externalEventId, 32),
      problemEventId: text(r.problemEventId, 32),
      kind: one(r.kind, ['problem', 'recovery', 'update']),
      resourceId: text(r.resourceId, 128),
      occurredAt: utc(r.occurredAt),
      receivedAt: utc(r.receivedAt),
      status: one(r.status, inboxStates),
      reason:
        r.reason === null ? null : (one(r.reason, reasons) as TriageReason),
      attempts: integer(r.attempts, 5, 0),
      version: integer(r.version),
      uplinkId: nullableId(r.uplinkId),
      siteId: nullableId(r.siteId),
    };
  });
  const observations = v.observations.map(
    (value: unknown): MonitoringObservation => {
      const o = object(value);
      return {
        correlationId: uuid(o.correlationId),
        sourceId: uuid(o.sourceId),
        receivedAt: utc(o.receivedAt),
        result: one(o.result, [
          'accepted',
          'invalid',
          'unauthorised',
          'conflict',
          'too_large',
          'method',
          'rate_limited',
          'unavailable',
        ]),
      };
    },
  );
  return {
    sources,
    receipts,
    observations,
    next: nullableId(v.next),
    sourceNext: nullableId(v.sourceNext),
  };
}
export function monitoringMutation(action: string, input: unknown): string {
  const v = object(input);
  if (action === 'configure')
    return `Source ${uuid(v.sourceId)}; key ID ${uuid(v.keyId)}; version ${integer(v.version)}. Secret is not returned.`;
  if (action === 'migrate' && v.queued === true)
    return 'Monitoring migration queued. Reload monitoring after completion.';
  if (action === 'revoke' && v.disabled === true)
    return 'Source disabled. Old credentials cannot authenticate.';
  if (action === 'map' && v.saved === true)
    return 'Mapping saved. Retry the quarantined receipt to re-evaluate it.';
  if (action === 'retry' && v.dispatched === true)
    return 'Receipt dispatch accepted. Reload to verify processing.';
  if (action === 'recover')
    return `Recovery examined ${integer(v.examined, 20, 0)} receipts; ${integer(v.dispatched, 20, 0)} dispatches accepted.`;
  if (action === 'cleanup')
    return `Removed ${integer(v.cleaned, 20, 0)} inactive secret references. Repeat if 20 were returned.`;
  throw new Error('INVALID_RESPONSE');
}
