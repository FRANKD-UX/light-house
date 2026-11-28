import type { TenantContext } from '../ports/tenant-context';

export interface TransitionCommand {
  readonly incidentId: string;
  readonly operation: 'resolve' | 'close';
  readonly expectedVersion: number;
}
/** Server-owned snapshot. No Jira mapping, identity, gate or evidence may come from a client command. */
export interface TransitionPlan extends TransitionCommand {
  readonly installationId: string;
  readonly tenantId: string;
  readonly accountId: string;
  readonly factsVersion: number;
  readonly gateId: string;
  readonly mappingVersion: number;
  readonly issueId: string;
  readonly projectId: string;
  readonly transitionId: string;
  readonly fromStatusId: string;
  readonly targetStatusId: string;
  readonly resolutionId: string | null;
}
export interface EnforcementEvidence {
  readonly installationId: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly reviewId: string;
  readonly verifiedAt: string;
  readonly validUntil: string;
  readonly kind: 'native-bypass-enforcement';
}
export interface TransitionObservation {
  readonly issueId: string;
  readonly projectId: string;
  readonly statusId: string;
  /** Server time after the read; NOT Jira transition time or exact intent causality. */
  readonly observedAt: string;
  readonly causality: 'postcondition-only';
}
export type TransitionState =
  | 'prepared'
  | 'sending'
  | 'reconciling'
  | 'ambiguous'
  | 'observed'
  | 'manual_review';
export type TransitionReason =
  | 'PERMISSION'
  | 'CONFIGURATION'
  | 'RATE_LIMITED'
  | 'AMBIGUOUS'
  | 'POSTCONDITION_UNAVAILABLE';
export interface TransitionIntent {
  readonly id: string;
  readonly plan: TransitionPlan;
  readonly enforcementReviewId: string;
  readonly state: TransitionState;
  readonly version: number;
  readonly attempts: number;
  readonly reconciliations: number;
  readonly leaseUntil: string | null;
  readonly reason: TransitionReason | null;
  readonly postResponse: 'not-sent' | 'accepted' | 'unknown' | 'rejected';
  readonly observation: TransitionObservation | null;
}
export interface TransitionRepository {
  /** Unique installation/tenant/incident/operation/expectedVersion; immutable plan. */
  ensure(
    ctx: TenantContext,
    value: TransitionIntent,
  ): Promise<TransitionIntent>;
  /** Atomic CAS+lease BEFORE HTTP; send only prepared/attempts0, reconcile expired sending/ambiguous. */
  claim(
    ctx: TenantContext,
    id: string,
    expected: number,
    token: string,
    now: string,
    until: string,
    mode: 'send' | 'reconcile',
  ): Promise<TransitionIntent | null>;
  /** Live-token+version fencing; atomically store observation/state/bounded safe audit. */
  settle(
    ctx: TenantContext,
    id: string,
    token: string,
    result: {
      readonly state: 'ambiguous' | 'observed' | 'manual_review';
      readonly reason: TransitionReason | null;
      readonly postResponse: TransitionIntent['postResponse'];
      readonly observation: TransitionObservation | null;
    },
  ): Promise<boolean>;
}
export interface TransitionGateway {
  /** Resolver-bound asUser identity, Browse/Transition visibility, exact from/to+transition metadata and screen fields. */
  eligible(plan: TransitionPlan): Promise<boolean>;
  post(plan: TransitionPlan): Promise<
    | { readonly kind: 'accepted' | 'ambiguous' }
    | {
        readonly kind: 'rejected';
        readonly reason: 'PERMISSION' | 'CONFIGURATION' | 'RATE_LIMITED';
      }
  >;
  observe(plan: TransitionPlan): Promise<TransitionObservation | null>;
}
export interface TransitionDependencies {
  readonly repository: TransitionRepository;
  readonly gateway: TransitionGateway;
  /** Fresh actor/team/operation/gate/version/facts, linked issue, admin-reviewed map and native enforcement proof.
   * Must fail closed when unavailable, including after permission/review expiry. Never performs a transition. */
  preflight(
    ctx: TenantContext,
    command: TransitionCommand,
  ): Promise<{
    readonly plan: TransitionPlan;
    readonly enforcement: EnforcementEvidence | null;
  }>;
  now(): string;
  id(): string;
}
export interface TransitionResult {
  readonly intentId: string;
  readonly state: 'pending' | 'ambiguous' | 'observed' | 'manual_review';
  readonly observation: TransitionObservation | null;
  /** Always false: an observed status is not an exact causal NativeConfirmation. */
  readonly nativeConfirmationAvailable: false;
}
export class TransitionError extends Error {
  constructor(
    readonly code:
      'INVALID' | 'DENIED' | 'NOT_READY' | 'CONFLICT' | 'UNAVAILABLE',
  ) {
    super(code);
  }
}
