import type { TenantContext } from '../ports/tenant-context';
export type JsmPriority = 'P1' | 'P2' | 'P3';
export interface JsmConfiguration {
  readonly installationId: string;
  readonly tenantId: string;
  readonly version: number;
  readonly projectId: string;
  readonly serviceDeskId: string;
  readonly requestTypeId: string;
  readonly fields: {
    readonly marker: string;
    readonly deadline: string;
    readonly warning: string;
    readonly policy: string;
  };
  readonly priorityIds: Readonly<Record<JsmPriority, string>>;
}
export interface JsmIncident {
  readonly installationId: string;
  readonly tenantId: string;
  readonly id: string;
  readonly summary: string;
  readonly description: string;
  readonly priority: JsmPriority;
  readonly warningAt: string;
  readonly deadlineAt: string;
  readonly policyVersionId: string;
}
export interface JsmRequest {
  readonly serviceDeskId: string;
  readonly requestTypeId: string;
  readonly requestFieldValues: Readonly<
    Record<string, string | { id: string }>
  >;
}
export interface JsmIssue {
  readonly id: string;
  readonly key: string;
}
export type JsmFailure = 'CONFIGURATION' | 'RATE_LIMITED' | 'AMBIGUOUS';
export type JsmCreateOutcome =
  | { readonly kind: 'created'; readonly issue: JsmIssue }
  | { readonly kind: 'RATE_LIMITED'; readonly retryAfterSeconds: number }
  | { readonly kind: 'CONFIGURATION' | 'AMBIGUOUS' };
export interface JsmGateway {
  verifyConfiguration(config: JsmConfiguration): Promise<boolean>;
  create(
    config: JsmConfiguration,
    request: JsmRequest,
  ): Promise<JsmCreateOutcome>;
  find(
    config: JsmConfiguration,
    marker: string,
  ): Promise<{
    readonly complete: boolean;
    readonly issues: readonly JsmIssue[];
  }>;
}
export type JsmIntentState =
  | 'prepared'
  | 'sending'
  | 'reconciling'
  | 'retry_wait'
  | 'ambiguous'
  | 'linked'
  | 'manual_review';
export interface JsmIntent {
  readonly installationId: string;
  readonly tenantId: string;
  readonly id: string;
  readonly incidentId: string;
  readonly marker: string;
  readonly configuration: JsmConfiguration;
  readonly request: JsmRequest;
  readonly state: JsmIntentState;
  readonly version: number;
  readonly attempts: number;
  readonly reconciliations: number;
  readonly dueAt: string | null;
  readonly leaseUntil: string | null;
  readonly issue: JsmIssue | null;
  readonly reason: JsmFailure | null;
}
export interface JsmRepository {
  incident(ctx: TenantContext, id: string): Promise<JsmIncident | null>;
  configuration(ctx: TenantContext): Promise<JsmConfiguration | null>;
  saveConfiguration(
    ctx: TenantContext,
    config: JsmConfiguration,
    expected: number,
  ): Promise<boolean>;
  /** Atomic unique installation/tenant/incident insert-or-read; existing snapshots never overwritten. */
  ensure(ctx: TenantContext, intent: JsmIntent): Promise<JsmIntent>;
  /** CAS+lease: increments version and appropriate attempt counter BEFORE external work. */
  claim(
    ctx: TenantContext,
    id: string,
    expected: number,
    token: string,
    now: string,
    until: string,
    mode: 'create' | 'reconcile',
  ): Promise<JsmIntent | null>;
  /** Atomically saves mapping (unique installation/issue), state and audit; verifies live token. */
  settle(
    ctx: TenantContext,
    id: string,
    token: string,
    result: {
      state: 'retry_wait' | 'ambiguous' | 'linked' | 'manual_review';
      issue: JsmIssue | null;
      dueAt: string | null;
      reason: JsmFailure | null;
    },
  ): Promise<boolean>;
}
export interface JsmDependencies {
  readonly repository: JsmRepository;
  readonly gateway: JsmGateway;
  now(): string;
  id(): string;
  authoriseConfiguration(ctx: TenantContext): Promise<void>;
}
export class JsmError extends Error {
  constructor(
    readonly code:
      'INVALID' | 'DENIED' | 'NOT_READY' | 'CONFLICT' | 'UNAVAILABLE',
  ) {
    super(code);
  }
}
