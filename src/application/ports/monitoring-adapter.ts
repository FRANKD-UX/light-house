import type { NormalisedMonitoringEvent } from '../../domain/events/monitoring-event';
import type { Result } from './errors';
import type { TenantContext } from './tenant-context';
export interface MonitoringAdapter {
  readonly sourceType: 'zabbix' | 'prometheus' | 'librenms';
  // Authentication precedes this call. Input remains unknown until runtime validation.
  validateAndNormalise(
    payload: unknown,
    context: TenantContext,
    correlationId: string,
  ): Result<NormalisedMonitoringEvent>;
}
