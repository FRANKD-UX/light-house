import type { NormalisedMonitoringEvent } from '../events/monitoring-event';
import type { InventoryRecord } from '../inventory/model';

export type IncidentFailure = 'INVALID' | 'DENIED' | 'NOT_READY' | 'CONFLICT';
export class IncidentError extends Error {
  constructor(readonly code: IncidentFailure) {
    super(code);
  }
}
export type Priority = 'P1' | 'P2' | 'P3';
export type ImpactConfidence = 'known' | 'unknown';
export interface Availability {
  readonly uplinkId: string;
  readonly state: 'up' | 'down' | 'unknown';
  readonly observedAt: string;
}
export interface IncidentInventory {
  readonly sites: readonly InventoryRecord[];
  readonly carriers: readonly InventoryRecord[];
  readonly uplinks: readonly InventoryRecord[];
  readonly customers: readonly InventoryRecord[];
  readonly services: readonly InventoryRecord[];
  readonly dependencies: readonly InventoryRecord[];
  readonly tiers: readonly InventoryRecord[];
  readonly availability: readonly Availability[];
}
export interface ImpactSnapshot {
  readonly confidence: ImpactConfidence;
  readonly reason: 'COMPLETE' | 'INCOMPLETE_INVENTORY' | 'UNKNOWN_FAILOVER';
  readonly siteId: string;
  readonly uplinkId: string;
  readonly carrierId: string;
  readonly affectedServiceIds: readonly string[];
  readonly affectedCustomerIds: readonly string[];
  readonly potentiallyAffectedCustomerIds: readonly string[];
  readonly potentiallyAffectedServiceIds: readonly string[];
  readonly protectedServiceIds: readonly string[];
  readonly uncertainServiceIds: readonly string[];
  readonly tierIds: readonly string[];
}
export interface PriorityTarget {
  readonly durationSeconds: number;
  readonly warningSeconds: number;
}
export interface IncidentPolicy {
  readonly id: string;
  readonly tenantId: string;
  readonly tierId: string;
  readonly version: number;
  readonly status: 'published';
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly clock: 'elapsed-utc';
  readonly severityMap: Readonly<Record<string, Priority>>;
  readonly unknownImpact: 'manual-review' | Priority;
  readonly targets: Readonly<Record<Priority, PriorityTarget>>;
}
export interface SlaSnapshot {
  readonly policyId: string;
  readonly policyVersion: number;
  readonly tierId: string;
  readonly consideredTierIds: readonly string[];
  readonly priority: Priority;
  readonly severity: string;
  readonly confidence: ImpactConfidence;
  readonly reason: 'STRICTEST_AFFECTED_TIER' | 'CONFIGURED_UNKNOWN_IMPACT';
  readonly clock: 'elapsed-utc';
  readonly startedAt: string;
  readonly durationSeconds: number;
  readonly warningSeconds: number;
  readonly warningAt: string;
  readonly deadlineAt: string;
}
export type SlaDecision =
  | { readonly kind: 'selected'; readonly snapshot: SlaSnapshot }
  | {
      readonly kind: 'manual_triage';
      readonly reason: 'UNKNOWN_IMPACT' | 'POLICY_GAP' | 'UNMAPPED_SEVERITY';
    };
export interface Incident {
  readonly id: string;
  readonly installationId: string;
  readonly tenantId: string;
  readonly sourceId: string;
  readonly problemEventId: string;
  readonly correlationId: string;
  readonly createdAt: string;
  readonly occurredAt: string;
  readonly impact: ImpactSnapshot;
  readonly sla: SlaDecision;
  readonly state: 'new' | 'manual_triage';
  readonly version: number;
}
export interface IncidentEvidence {
  readonly inboxId: string;
  readonly sourceId: string;
  readonly correlationId: string;
  readonly receivedAt: string;
  readonly uplinkId: string;
  readonly siteId: string;
  readonly event: NormalisedMonitoringEvent;
}
