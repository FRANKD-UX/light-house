import { object, uuid } from '../../../src/domain/inventory/model';
import { incidentOverview } from './incident-contract';
import type { JsmContextResult } from '../../../src/application/jsm-context/contracts';
export function issueContextResult(input: unknown): JsmContextResult {
  const v = object(input);
  if (v.kind === 'unavailable') {
    const reason = [
      'INVALID_CONTEXT',
      'NOT_VISIBLE',
      'NOT_AVAILABLE',
      'NOT_READY',
      'UNAVAILABLE',
    ].find((x) => x === v.reason);
    if (!reason) throw new Error('INVALID_RESPONSE');
    return {
      kind: 'unavailable',
      reason: reason as Extract<
        JsmContextResult,
        { kind: 'unavailable' }
      >['reason'],
    };
  }
  if (v.kind !== 'available') throw new Error('INVALID_RESPONSE');
  const i = object(v.incident),
    op = object(v.operations);
  if (
    typeof op.readiness !== 'string' ||
    !['ready', 'not-ready', 'unavailable'].includes(op.readiness) ||
    (op.readiness !== 'ready' && op.summary !== null)
  )
    throw new Error('INVALID_RESPONSE');
  const decoded = incidentOverview(
    {
      incidents: [i],
      policies: [],
      next: null,
      operationsReady: op.readiness === 'ready',
      operations: op.summary === null ? [] : [op.summary],
    },
    uuid(i.tenantId),
  );
  return {
    kind: 'available',
    incident: decoded.incidents[0]!,
    operations: {
      readiness: op.readiness as 'ready' | 'not-ready' | 'unavailable',
      summary: decoded.operations[0] ?? null,
    },
  };
}
