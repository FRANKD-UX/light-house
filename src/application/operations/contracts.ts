import type { TenantContext } from '../ports/tenant-context';
import type { Incident } from '../../domain/incidents/model';
import type {
  OperationalIncident,
  WorkflowActor,
  WorkflowAction,
} from '../../domain/incidents/workflow';
export type OperationKind = WorkflowAction['kind'];
export interface OperationCommand {
  readonly commandId: string;
  readonly incidentId: string;
  readonly expected: number;
  readonly kind: OperationKind | 'initialise';
  readonly targetTeamId?: string;
  readonly targetAssigneeId?: string;
  readonly reason?: string;
}
export interface OperationFacts {
  readonly revision: number;
  readonly recoveryObservedAt: string | null;
}
export interface GateRecord {
  readonly installationId: string;
  readonly tenantId: string;
  readonly incidentId: string;
  readonly id: string;
  readonly template: 'operational' | 'remediation' | 'restoration' | 'closure';
  readonly templateVersion: 1;
  readonly incidentVersion: number;
  readonly factsVersion: number;
  readonly evaluatedAt: string;
  readonly validUntil: string;
  readonly fields: Readonly<Record<string, unknown>>;
}
export interface ValidationReceipt {
  readonly gateId: string;
  readonly factsVersion: number;
  readonly validatedAt: string;
  readonly validUntil: string;
}
export interface OperationAudit {
  readonly correlationId: string;
  readonly commandId: string;
  readonly at: string;
  readonly accountId: string;
  readonly assigneeId: string;
  readonly teamId: string;
  readonly action: OperationKind | 'initialise';
  readonly fromState: OperationalIncident['state'];
  readonly toState: OperationalIncident['state'];
  readonly fromOwner: string;
  readonly toOwner: string;
  readonly fromAssigneeId: string | null;
  readonly toAssigneeId: string | null;
  readonly reason: string | null;
  readonly gateId: string | null;
  readonly targetTeamId: string | null;
  readonly targetAssigneeId: string | null;
  readonly nativeIntentId: string | null;
  readonly factsVersion: number;
  readonly slaPolicyId: string;
  readonly slaStartedAt: string;
  readonly slaDeadlineAt: string;
}
export interface OperationReceipt {
  readonly commandId: string;
  readonly fingerprint: string;
  readonly result: OperationResult;
}
export interface OperationPending {
  readonly receipt: OperationReceipt;
  readonly audit: OperationAudit;
}
export interface OperationAggregate {
  readonly nocTeamId: string;
  readonly installationId: string;
  readonly tenantId: string;
  readonly incident: OperationalIncident;
  readonly factsVersion: number;
  readonly validation: ValidationReceipt | null;
  readonly pending: OperationPending | null;
  readonly lease: { readonly token: string; readonly until: string } | null;
}
export interface OperationResult {
  readonly incidentId: string;
  readonly version: number;
  readonly state: OperationalIncident['state'];
  readonly ownerTeamId: string;
  readonly ownerAssigneeId: string | null;
  readonly correlationId: string;
  readonly pendingMaterialisation: boolean;
}
export interface NativeConfirmation {
  readonly installationId: string;
  readonly tenantId: string;
  readonly incidentId: string;
  readonly operation: 'resolve' | 'close';
  readonly expectedVersion: number;
  readonly intentId: string;
  readonly confirmedAt: string;
  readonly issueId: string;
  readonly gateId: string;
}
export interface OperationRepository {
  enriched(ctx: TenantContext, id: string): Promise<Incident | null>;
  load(ctx: TenantContext, id: string): Promise<OperationAggregate | null>;
  /** Unique install/tenant/incident insert-or-read; no overwrite of winner. */
  initialise(
    ctx: TenantContext,
    aggregate: OperationAggregate,
  ): Promise<OperationAggregate>;
  facts(ctx: TenantContext, id: string): Promise<OperationFacts>;
  /** Return a receipt only after all required projections finished and matching pending envelope cleared. */
  receipt(
    ctx: TenantContext,
    incidentId: string,
    commandId: string,
  ): Promise<OperationReceipt | null>;
  /** One aggregate CAS carries state+owner+SLA+pending receipt/audit. No multi-table transaction assumed. */
  save(
    ctx: TenantContext,
    expected: number,
    aggregate: OperationAggregate,
  ): Promise<boolean>;
  /** Idempotently project pending receipt/audit/handoff history, then clear matching envelope by CAS. */
  materialise(
    ctx: TenantContext,
    incidentId: string,
    commandId: string,
  ): Promise<boolean>;
  saveGate(ctx: TenantContext, record: GateRecord): Promise<boolean>;
  /** Stored, server-owned checklist results. No gate fields come from the command payload. */
  gate(
    ctx: TenantContext,
    aggregate: OperationAggregate,
    kind: OperationKind,
  ): Promise<GateRecord | null>;
  /** Read confirmed durable native transition intent only; never makes a Jira call. */
  nativeConfirmation(
    ctx: TenantContext,
    incidentId: string,
    operation: 'resolve' | 'close',
  ): Promise<NativeConfirmation | null>;
}
export interface OperationDependencies {
  readonly repository: OperationRepository;
  /** Fresh membership/active team/NOC configuration; must also verify same-tenant targetTeamId and active targetAssigneeId in the current owner team. */
  authorise(
    ctx: TenantContext,
    command: OperationCommand,
  ): Promise<WorkflowActor>;
  now(): string;
  id(): string;
  digest(canonical: string): string;
}
export class OperationError extends Error {
  constructor(
    readonly code:
      'INVALID' | 'DENIED' | 'NOT_READY' | 'CONFLICT' | 'REPAIR_REQUIRED',
  ) {
    super(code);
  }
}
