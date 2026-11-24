export interface NormalisedMonitoringEvent {
  readonly externalEventId: string;
  readonly problemEventId: string;
  readonly resourceId: string;
  readonly kind: 'problem' | 'recovery' | 'update';
  readonly occurredAt: string; // Validated ISO 8601 UTC timestamp at the adapter boundary.
  readonly severity: string;
}
