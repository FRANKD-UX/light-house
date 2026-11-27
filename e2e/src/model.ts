import type { InventoryType } from './policy.js';
export interface DisplayedRecord {
  id: string;
  fields: Record<string, string>;
  lifecycle: string;
  version: number;
}
export interface Operation {
  operation:
    'navigation' | 'health' | 'overview' | 'tenant-selection' | 'inventory';
  inventoryType: InventoryType | null;
  page: number | null;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  outcome: 'success' | 'failure' | 'blocked';
  visibleResult: string;
  displayedRowCount: number | null;
  records: DisplayedRecord[];
  recordsFresh: boolean;
  backendCode: string | null;
  correlationId: string | null;
  error: string | null;
}
export interface HostedEvent {
  timestamp: string;
  timestampBasis: 'cli-full-utc' | 'unique-bounded-utc-date';
  event: 'inventory.diagnostic' | 'backend.status';
  correlationId: string;
  outcome: 'started' | 'success' | 'failure';
  stage: string | null;
  durationMs: number | null;
  exceptionCategory: string | null;
  errorCode: string | null;
  providerCode: string | null;
}
export interface Match {
  operationIndex: number;
  basis:
    | 'displayed-uuid'
    | 'unique-time-candidate'
    | 'ambiguous'
    | 'unmatched'
    | 'not-instrumented';
  correlationId: string | null;
  lifecycleComplete: boolean;
  events: HostedEvent[];
}
export interface Report {
  schemaVersion: 1;
  target: 'Light House DEVELOPMENT';
  expectedDeployedVersion: '3.3.0';
  versionVerification: string;
  startedAt: string;
  completedAt: string;
  outcome: 'passed' | 'failed' | 'blocked';
  operations: Operation[];
  pageErrorCount: number;
  logs: {
    status: 'collected' | 'unavailable' | 'not-requested';
    reason: string | null;
    matches: Match[];
  };
  limitations: string[];
}
