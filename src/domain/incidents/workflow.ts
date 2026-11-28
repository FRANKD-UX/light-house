import { utc, uuid, type Role } from '../inventory/model';
import { IncidentError, type SlaSnapshot } from './model';
export type OperationalState =
  | 'new'
  | 'acknowledged'
  | 'triage'
  | 'in_progress'
  | 'restoration_validation'
  | 'resolved'
  | 'closed';
export interface OperationalIncident {
  readonly id: string;
  readonly tenantId: string;
  readonly state: OperationalState;
  readonly version: number;
  readonly ownerTeamId: string;
  readonly ownerAssigneeId: string | null;
  readonly sla: SlaSnapshot;
  readonly pendingHandoff: {
    readonly targetTeamId: string;
    readonly requestedAt: string;
  } | null;
  readonly pendingReturn: {
    readonly fromTeamId: string;
    readonly requestedAt: string;
  } | null;
  readonly recoveryObservedAt: string | null;
  readonly restorationValidatedAt: string | null;
  readonly resolvedAt: string | null;
}
export type WorkflowAction =
  | {
      kind:
        | 'acknowledge'
        | 'triage'
        | 'start_work'
        | 'request_validation'
        | 'validate_restoration'
        | 'resolve'
        | 'close';
    }
  | { kind: 'request_handoff'; targetTeamId: string }
  | {
      kind:
        | 'accept_handoff'
        | 'reject_handoff'
        | 'return_to_noc'
        | 'request_return'
        | 'accept_return'
        | 'reject_return';
    };
export interface WorkflowActor {
  readonly tenantId: string;
  readonly role: Role;
  readonly teamId: string;
  readonly assigneeId: string;
  readonly nocTeamId: string;
}
/** Pure server-authoritative transition policy; the adapter must CAS the returned version. */
export function transitionIncident(
  incident: OperationalIncident,
  actor: WorkflowActor,
  expected: number,
  action: WorkflowAction,
  now: string,
  gatePassed: boolean,
): OperationalIncident {
  utc(now);
  uuid(actor.tenantId);
  uuid(actor.teamId);
  uuid(actor.nocTeamId);
  uuid(actor.assigneeId);
  if (
    actor.tenantId !== incident.tenantId ||
    (actor.role !== 'operator' && actor.role !== 'admin')
  )
    throw new IncidentError('DENIED');
  if (expected !== incident.version) throw new IncidentError('CONFLICT');
  if (now < incident.sla.startedAt || incident.state === 'closed')
    throw new IncidentError('INVALID');
  if (action.kind === 'accept_return' || action.kind === 'reject_return') {
    if (!incident.pendingReturn || actor.teamId !== actor.nocTeamId)
      throw new IncidentError('DENIED');
    if (
      incident.state !== 'in_progress' ||
      incident.pendingHandoff ||
      incident.pendingReturn.fromTeamId !== incident.ownerTeamId ||
      !gatePassed
    )
      throw new IncidentError('CONFLICT');
    return Object.freeze({
      ...incident,
      ownerTeamId:
        action.kind === 'accept_return'
          ? actor.nocTeamId
          : incident.ownerTeamId,
      ownerAssigneeId:
        action.kind === 'accept_return'
          ? actor.assigneeId
          : incident.ownerAssigneeId,
      state:
        action.kind === 'accept_return'
          ? 'restoration_validation'
          : incident.state,
      pendingReturn: null,
      restorationValidatedAt: null,
      version: incident.version + 1,
    });
  }
  if (incident.pendingReturn) throw new IncidentError('CONFLICT');
  const targetActor = incident.pendingHandoff?.targetTeamId === actor.teamId;
  if (action.kind === 'accept_handoff' || action.kind === 'reject_handoff') {
    if (!incident.pendingHandoff || !targetActor)
      throw new IncidentError('DENIED');
    if (incident.state !== 'in_progress') throw new IncidentError('CONFLICT');
    return Object.freeze({
      ...incident,
      ownerTeamId:
        action.kind === 'accept_handoff' ? actor.teamId : incident.ownerTeamId,
      pendingHandoff: null,
      ownerAssigneeId:
        action.kind === 'accept_handoff'
          ? actor.assigneeId
          : incident.ownerAssigneeId,
      version: incident.version + 1,
    });
  }
  if (
    actor.teamId !== incident.ownerTeamId ||
    (incident.ownerAssigneeId !== null &&
      actor.assigneeId !== incident.ownerAssigneeId)
  )
    throw new IncidentError('DENIED');
  let next: OperationalIncident = {
    ...incident,
    version: incident.version + 1,
  };
  switch (action.kind) {
    case 'acknowledge':
      if (incident.state !== 'new') throw new IncidentError('CONFLICT');
      next = {
        ...next,
        state: 'acknowledged',
        ownerAssigneeId: actor.assigneeId,
      };
      break;
    case 'triage':
      if (incident.state !== 'acknowledged')
        throw new IncidentError('CONFLICT');
      next = { ...next, state: 'triage' };
      break;
    case 'start_work':
      if (incident.state !== 'triage' || !gatePassed)
        throw new IncidentError('CONFLICT');
      next = { ...next, state: 'in_progress' };
      break;
    case 'request_handoff':
      uuid(action.targetTeamId);
      if (
        incident.state !== 'in_progress' ||
        incident.pendingHandoff ||
        action.targetTeamId === incident.ownerTeamId ||
        !gatePassed
      )
        throw new IncidentError('CONFLICT');
      next = {
        ...next,
        pendingHandoff: Object.freeze({
          targetTeamId: action.targetTeamId,
          requestedAt: now,
        }),
      };
      break;
    case 'request_return':
    case 'return_to_noc':
      if (
        incident.state !== 'in_progress' ||
        incident.pendingHandoff ||
        actor.teamId === actor.nocTeamId ||
        !gatePassed
      )
        throw new IncidentError('CONFLICT');
      next = {
        ...next,
        pendingReturn: Object.freeze({
          fromTeamId: incident.ownerTeamId,
          requestedAt: now,
        }),
        restorationValidatedAt: null,
      };
      break;
    case 'request_validation':
      if (
        incident.state !== 'in_progress' ||
        incident.pendingHandoff ||
        actor.teamId !== actor.nocTeamId ||
        !gatePassed
      )
        throw new IncidentError('CONFLICT');
      next = {
        ...next,
        state: 'restoration_validation',
        restorationValidatedAt: null,
      };
      break;
    case 'validate_restoration':
      if (
        incident.state !== 'restoration_validation' ||
        actor.teamId !== actor.nocTeamId ||
        !gatePassed
      )
        throw new IncidentError('CONFLICT');
      next = { ...next, restorationValidatedAt: now };
      break;
    case 'resolve':
      if (
        incident.state !== 'restoration_validation' ||
        incident.pendingHandoff ||
        actor.teamId !== actor.nocTeamId ||
        !incident.restorationValidatedAt ||
        !gatePassed
      )
        throw new IncidentError('CONFLICT');
      next = { ...next, state: 'resolved', resolvedAt: now };
      break;
    case 'close':
      if (
        incident.state !== 'resolved' ||
        incident.pendingHandoff ||
        actor.teamId !== actor.nocTeamId ||
        !gatePassed
      )
        throw new IncidentError('CONFLICT');
      next = { ...next, state: 'closed' };
      break;
    default:
      throw new IncidentError('INVALID');
  }
  return Object.freeze(next);
}
