import {
  integer,
  object,
  utc,
  uuid,
  text,
} from '../../../src/domain/inventory/model';
import type { SlaSnapshot } from '../../../src/domain/incidents/model';
import type { OperationalState } from '../../../src/domain/incidents/workflow';
const states = [
  'new',
  'acknowledged',
  'triage',
  'in_progress',
  'restoration_validation',
  'resolved',
  'closed',
] as const;
const one = <T extends string>(input: unknown, choices: readonly T[]): T => {
  const value = choices.find((v) => v === input);
  if (!value) throw new Error('INVALID_RESPONSE');
  return value;
};
const bool = (input: unknown): boolean => {
  if (typeof input !== 'boolean') throw new Error('INVALID_RESPONSE');
  return input;
};
const nullableId = (input: unknown) => (input === null ? null : uuid(input));
const nullableTime = (input: unknown) => (input === null ? null : utc(input));
function sla(input: unknown): SlaSnapshot {
  const s = object(input);
  if (!Array.isArray(s.consideredTierIds) || s.consideredTierIds.length > 1000)
    throw new Error('INVALID_RESPONSE');
  const consideredTierIds = s.consideredTierIds.map(uuid);
  if (new Set(consideredTierIds).size !== consideredTierIds.length)
    throw new Error('INVALID_RESPONSE');
  const startedAt = utc(s.startedAt),
    warningAt = utc(s.warningAt),
    deadlineAt = utc(s.deadlineAt),
    durationSeconds = integer(s.durationSeconds),
    warningSeconds = integer(s.warningSeconds, durationSeconds - 1, 0);
  if (
    Date.parse(warningAt) !== Date.parse(startedAt) + warningSeconds * 1000 ||
    Date.parse(deadlineAt) !== Date.parse(startedAt) + durationSeconds * 1000
  )
    throw new Error('INVALID_RESPONSE');
  return {
    policyId: uuid(s.policyId),
    policyVersion: integer(s.policyVersion),
    tierId: uuid(s.tierId),
    consideredTierIds,
    priority: one(s.priority, ['P1', 'P2', 'P3']),
    severity: text(s.severity, 32),
    confidence: one(s.confidence, ['known', 'unknown']),
    reason: one(s.reason, [
      'STRICTEST_AFFECTED_TIER',
      'CONFIGURED_UNKNOWN_IMPACT',
    ]),
    clock: one(s.clock, ['elapsed-utc']),
    startedAt,
    warningAt,
    deadlineAt,
    durationSeconds,
    warningSeconds,
  };
}
export interface PublicOperation {
  id: string;
  state: OperationalState;
  version: number;
  ownerTeamId: string;
  ownerAssigneeId: string | null;
  nocTeamId: string;
  pendingHandoff: { targetTeamId: string; requestedAt: string } | null;
  pendingReturn: { fromTeamId: string; requestedAt: string } | null;
  recoveryObservedAt: string | null;
  restorationValidatedAt: string | null;
  resolvedAt: string | null;
  sla: SlaSnapshot;
  factsVersion: number;
  pendingMaterialisation: boolean;
  nativeClosureAvailable: false;
}
export interface OperationsOverview {
  operation: PublicOperation | null;
  configuration: { nocTeamId: string; version: number } | null;
}
export function operationsOverview(
  input: unknown,
  incidentId: string,
): OperationsOverview {
  const raw = object(input);
  let operation: PublicOperation | null = null;
  if (raw.operation !== null) {
    const v = object(raw.operation);
    if (v.id !== incidentId || v.nativeClosureAvailable !== false)
      throw new Error('INVALID_RESPONSE');
    const handoff = v.pendingHandoff === null ? null : object(v.pendingHandoff),
      pendingReturn = v.pendingReturn === null ? null : object(v.pendingReturn);
    operation = {
      id: uuid(v.id),
      state: one(v.state, states),
      version: integer(v.version),
      ownerTeamId: uuid(v.ownerTeamId),
      ownerAssigneeId: nullableId(v.ownerAssigneeId),
      nocTeamId: uuid(v.nocTeamId),
      pendingHandoff: handoff
        ? {
            targetTeamId: uuid(handoff.targetTeamId),
            requestedAt: utc(handoff.requestedAt),
          }
        : null,
      pendingReturn: pendingReturn
        ? {
            fromTeamId: uuid(pendingReturn.fromTeamId),
            requestedAt: utc(pendingReturn.requestedAt),
          }
        : null,
      recoveryObservedAt: nullableTime(v.recoveryObservedAt),
      restorationValidatedAt: nullableTime(v.restorationValidatedAt),
      resolvedAt: nullableTime(v.resolvedAt),
      sla: sla(v.sla),
      factsVersion: integer(v.factsVersion),
      pendingMaterialisation: bool(v.pendingMaterialisation),
      nativeClosureAvailable: false,
    };
    if (
      (operation.state === 'new') !== (operation.ownerAssigneeId === null) ||
      (handoff && pendingReturn) ||
      ((handoff || pendingReturn) && operation.state !== 'in_progress') ||
      operation.pendingHandoff?.targetTeamId === operation.ownerTeamId ||
      (operation.pendingReturn &&
        operation.pendingReturn.fromTeamId !== operation.ownerTeamId)
    )
      throw new Error('INVALID_RESPONSE');
  }
  const config = raw.configuration === null ? null : object(raw.configuration);
  return {
    operation,
    configuration: config
      ? { nocTeamId: uuid(config.nocTeamId), version: integer(config.version) }
      : null,
  };
}
export interface OperationExecution {
  incidentId: string;
  state: OperationalState;
  version: number;
  ownerTeamId: string;
  ownerAssigneeId: string | null;
  correlationId: string;
  pendingMaterialisation: boolean;
}
export function operationExecution(
  input: unknown,
  incidentId: string,
): OperationExecution {
  const r = object(input);
  if (r.incidentId !== incidentId) throw new Error('INVALID_RESPONSE');
  return {
    incidentId: uuid(r.incidentId),
    state: one(r.state, states),
    version: integer(r.version),
    ownerTeamId: uuid(r.ownerTeamId),
    ownerAssigneeId: nullableId(r.ownerAssigneeId),
    correlationId: uuid(r.correlationId),
    pendingMaterialisation: bool(r.pendingMaterialisation),
  };
}
export function checklistResult(input: unknown): {
  gateId: string;
  validUntil: string;
} {
  const r = object(input);
  return { gateId: uuid(r.gateId), validUntil: utc(r.validUntil) };
}
export function operationMutation(
  action: 'configure' | 'repair',
  input: unknown,
): string {
  const v = object(input);
  if (action === 'configure' && v.saved === true)
    return 'NOC configuration saved. Reload operational state before another action.';
  if (action === 'repair' && typeof v.completed === 'boolean')
    return v.completed
      ? 'Saved command projections completed. Reload to verify current state.'
      : 'Saved command projections remain pending. No new transition was attempted.';
  throw new Error('INVALID_RESPONSE');
}
