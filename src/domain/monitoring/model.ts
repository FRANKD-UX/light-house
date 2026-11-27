import type { NormalisedMonitoringEvent } from '../events/monitoring-event';
export const inboxStates = [
  'received',
  'queued',
  'processing',
  'ready',
  'manual_triage',
  'retry_required',
] as const;
export type InboxState = (typeof inboxStates)[number];
export type TriageReason =
  | 'DISPATCH_PENDING'
  | 'UNKNOWN_MAPPING'
  | 'INACTIVE_RESOURCE'
  | 'SOURCE_DISABLED'
  | 'PROCESSING_FAILED'
  | 'RETRY_EXHAUSTED'
  | null;
export interface MonitoringSource {
  id: string;
  tenant_id: string;
  installation_id: string;
  name: string;
  source_type: 'zabbix';
  status: 'active' | 'disabled';
  version: number;
  current_key_id: string | null;
  previous_key_id: string | null;
  previous_until: string | null;
}
export interface CredentialReference {
  created_at: string;
  id: string;
  tenant_id: string;
  installation_id: string;
  source_id: string;
  secret_ref: string;
}
export interface SourceCredential extends CredentialReference {
  source: MonitoringSource;
}
export interface SecretBinding {
  secret: string;
  installationId: string;
  tenantId: string;
  sourceId: string;
  keyId: string;
}
export interface InboxRecord {
  id: string;
  tenant_id: string;
  installation_id: string;
  source_id: string;
  correlation_id: string;
  duplicate_count: number;
  dedupe_key: string;
  fingerprint: string;
  event_json: string;
  status: InboxState;
  reason: TriageReason;
  received_at: string;
  updated_at: string;
  attempts: number;
  dispatches: number;
  version: number;
  lease_token: string | null;
  lease_until: string | null;
  uplink_id: string | null;
  site_id: string | null;
}
export interface ResourceMapping {
  id: string;
  source_id: string;
  external_resource_id: string;
  uplink_id: string;
  version: number;
}
export interface IntakeEvent extends NormalisedMonitoringEvent {
  readonly title: string;
}
export type IngressOutput =
  | 'accepted'
  | 'invalid'
  | 'unauthorised'
  | 'conflict'
  | 'too_large'
  | 'method'
  | 'rate_limited'
  | 'unavailable';
export interface PublicSource {
  id: string;
  name: string;
  sourceType: 'zabbix';
  status: 'active' | 'disabled';
  version: number;
  keyId: string | null;
  previousValidUntil: string | null;
}
export interface MonitoringObservation {
  correlationId: string;
  sourceId: string;
  receivedAt: string;
  result: IngressOutput;
}
export interface PublicReceipt {
  correlationId: string;
  duplicates: number;
  id: string;
  sourceId: string;
  externalEventId: string;
  problemEventId: string;
  kind: IntakeEvent['kind'];
  resourceId: string;
  occurredAt: string;
  receivedAt: string;
  status: InboxState;
  reason: TriageReason;
  attempts: number;
  version: number;
  uplinkId: string | null;
  siteId: string | null;
}
