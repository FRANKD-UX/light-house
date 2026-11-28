import type { MonitoringAdapter } from '../../application/ports/monitoring-adapter';
import type { TenantContext } from '../../application/ports/tenant-context';
import { object, text, utc } from '../../domain/inventory/model';
import type { Result } from '../../application/ports/errors';
import type { IntakeEvent } from '../../domain/monitoring/model';
export class ZabbixAdapter implements MonitoringAdapter {
  readonly sourceType = 'zabbix' as const;
  validateAndNormalise(
    payload: unknown,
    _context: TenantContext,
    correlationId: string,
  ): Result<IntakeEvent> {
    try {
      const p = object(payload);
      const keys = [
        'schemaVersion',
        'externalEventId',
        'problemEventId',
        'externalResourceId',
        'kind',
        'occurredAt',
        'severity',
        'title',
      ];
      if (
        Object.keys(p).some((key) => !keys.includes(key)) ||
        p.schemaVersion !== 1
      )
        throw new Error('INVALID');
      const externalEventId = text(p.externalEventId, 32);
      const problemEventId = text(p.problemEventId, 32);
      if (
        !/^[1-9][0-9]*$/.test(externalEventId) ||
        !/^[1-9][0-9]*$/.test(problemEventId)
      )
        throw new Error('INVALID');
      if (
        typeof p.kind !== 'string' ||
        !['problem', 'recovery', 'update'].includes(p.kind)
      )
        throw new Error('INVALID');
      if (p.kind === 'problem' && externalEventId !== problemEventId)
        throw new Error('INVALID');
      const resourceId = text(p.externalResourceId, 128);
      if (!/^[A-Za-z0-9._:-]+$/.test(resourceId)) throw new Error('INVALID');
      const severity = text(p.severity, 1);
      if (!/^[0-5]$/.test(severity)) throw new Error('INVALID');
      const title = text(p.title, 200);
      if (
        [...title].some(
          (character) =>
            character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        )
      )
        throw new Error('INVALID');
      return {
        ok: true,
        value: {
          externalEventId,
          problemEventId,
          resourceId,
          kind: p.kind as IntakeEvent['kind'],
          occurredAt: utc(p.occurredAt),
          severity,
          title,
        },
      };
    } catch {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid monitoring event.',
          retryable: false,
          correlationId,
        },
      };
    }
  }
}
