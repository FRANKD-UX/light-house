import { object, text, uuid, utc, integer } from '../../domain/inventory/model';
import { identifier } from '../jsm/validation';
import type { SlaDecision } from '../../domain/incidents/model';
import type {
  IssueVisibilityVerifier,
  JsmContextRepository,
  JsmContextResult,
  JsmContextSession,
  PublicIncident,
  LinkedOperationalSummary,
} from './contracts';
function literal<T extends string>(input: unknown, values: readonly T[]): T {
  const value = values.find((v) => v === input);
  if (!value) throw new Error('INVALID_CONTEXT_RESULT');
  return value;
}
function ids(input: unknown): string[] {
  if (!Array.isArray(input) || input.length > 1000)
    throw new Error('INVALID_CONTEXT_RESULT');
  const values = input.map(uuid);
  if (new Set(values).size !== values.length)
    throw new Error('INVALID_CONTEXT_RESULT');
  return values;
}
function incident(
  input: unknown,
  installationId: string,
  tenantId: string,
  incidentId: string,
): PublicIncident {
  const raw = object(input),
    impact = object(raw.impact),
    sla = object(raw.sla);
  if (
    raw.installationId !== installationId ||
    raw.tenantId !== tenantId ||
    raw.id !== incidentId
  )
    throw new Error('INVALID_CONTEXT_RESULT');
  let decision: SlaDecision;
  if (sla.kind === 'manual_triage')
    decision = {
      kind: 'manual_triage',
      reason: literal(sla.reason, [
        'UNKNOWN_IMPACT',
        'POLICY_GAP',
        'UNMAPPED_SEVERITY',
      ]),
    };
  else if (sla.kind === 'selected') {
    const value = object(sla.snapshot);
    const startedAt = utc(value.startedAt),
      durationSeconds = integer(value.durationSeconds),
      warningSeconds = integer(value.warningSeconds, durationSeconds - 1, 0),
      warningAt = utc(value.warningAt),
      deadlineAt = utc(value.deadlineAt);
    if (
      Date.parse(warningAt) !== Date.parse(startedAt) + warningSeconds * 1000 ||
      Date.parse(deadlineAt) !==
        Date.parse(startedAt) + durationSeconds * 1000 ||
      startedAt !== raw.occurredAt
    )
      throw new Error('INVALID_CONTEXT_RESULT');
    decision = {
      kind: 'selected',
      snapshot: {
        policyId: uuid(value.policyId),
        policyVersion: integer(value.policyVersion),
        tierId: uuid(value.tierId),
        consideredTierIds: ids(value.consideredTierIds),
        priority: literal(value.priority, ['P1', 'P2', 'P3']),
        severity: text(value.severity, 32),
        confidence: literal(value.confidence, ['known', 'unknown']),
        reason: literal(value.reason, [
          'STRICTEST_AFFECTED_TIER',
          'CONFIGURED_UNKNOWN_IMPACT',
        ]),
        clock: literal(value.clock, ['elapsed-utc']),
        startedAt,
        durationSeconds,
        warningSeconds,
        warningAt,
        deadlineAt,
      },
    };
  } else throw new Error('INVALID_CONTEXT_RESULT');
  return {
    id: uuid(raw.id),
    tenantId: uuid(raw.tenantId),
    sourceId: uuid(raw.sourceId),
    problemEventId: text(raw.problemEventId, 64),
    correlationId: uuid(raw.correlationId),
    createdAt: utc(raw.createdAt),
    occurredAt: utc(raw.occurredAt),
    state: literal(raw.state, ['new', 'manual_triage']),
    version: integer(raw.version),
    sla: decision,
    impact: {
      confidence: literal(impact.confidence, ['known', 'unknown']),
      reason: literal(impact.reason, [
        'COMPLETE',
        'INCOMPLETE_INVENTORY',
        'UNKNOWN_FAILOVER',
      ]),
      siteId: uuid(impact.siteId),
      uplinkId: uuid(impact.uplinkId),
      carrierId: uuid(impact.carrierId),
      affectedServiceIds: ids(impact.affectedServiceIds),
      affectedCustomerIds: ids(impact.affectedCustomerIds),
      potentiallyAffectedCustomerIds: ids(
        impact.potentiallyAffectedCustomerIds,
      ),
      potentiallyAffectedServiceIds: ids(impact.potentiallyAffectedServiceIds),
      protectedServiceIds: ids(impact.protectedServiceIds),
      uncertainServiceIds: ids(impact.uncertainServiceIds),
      tierIds: ids(impact.tierIds),
    },
  };
}
function operation(
  input: unknown,
  installationId: string,
  tenantId: string,
  incidentId: string,
): LinkedOperationalSummary {
  const raw = object(input),
    current = object(raw.incident);
  if (
    raw.installationId !== installationId ||
    raw.tenantId !== tenantId ||
    current.tenantId !== tenantId ||
    current.id !== incidentId
  )
    throw new Error('INVALID_CONTEXT_RESULT');
  const pendingHandoff =
      current.pendingHandoff === null ? null : object(current.pendingHandoff),
    pendingReturn =
      current.pendingReturn === null ? null : object(current.pendingReturn);
  if (pendingHandoff) {
    uuid(pendingHandoff.targetTeamId);
    utc(pendingHandoff.requestedAt);
  }
  if (pendingReturn) {
    uuid(pendingReturn.fromTeamId);
    utc(pendingReturn.requestedAt);
  }
  // Expose only flags, never saved commands, audit actors, checklist fields or lease tokens.
  return {
    incidentId,
    state: literal(current.state, [
      'new',
      'acknowledged',
      'triage',
      'in_progress',
      'restoration_validation',
      'resolved',
      'closed',
    ]),
    version: integer(current.version),
    ownerTeamId: uuid(current.ownerTeamId),
    ownerAssigneeId:
      current.ownerAssigneeId === null ? null : uuid(current.ownerAssigneeId),
    nocTeamId: uuid(raw.nocTeamId),
    pendingMaterialisation: raw.pending !== null || raw.lease !== null,
    pendingHandoff: pendingHandoff !== null,
    pendingReturn: pendingReturn !== null,
    resolvedAt: current.resolvedAt === null ? null : utc(current.resolvedAt),
  };
}
/** Read-only use case. The future Forge boundary supplies runtime/account/issue context; no tenant is accepted. */
export class JsmContextService {
  constructor(
    private readonly repository: JsmContextRepository,
    private readonly visibility: IssueVisibilityVerifier,
  ) {}
  async lookup(
    session: JsmContextSession,
    issueId: unknown,
  ): Promise<JsmContextResult> {
    let issue: string;
    try {
      text(session.installationId, 255);
      text(session.accountId, 128);
      identifier(session.projectId);
      issue = identifier(issueId);
    } catch {
      return { kind: 'unavailable', reason: 'INVALID_CONTEXT' };
    }
    try {
      const permission = object(await this.visibility.verify(session, issue));
      if (
        permission.mode !== 'asUser' ||
        permission.accountId !== session.accountId ||
        permission.issueId !== issue ||
        permission.projectId !== session.projectId ||
        permission.browseAllowed !== true ||
        permission.issueSecurityAllowed !== true
      )
        return { kind: 'unavailable', reason: 'NOT_VISIBLE' };
    } catch {
      return { kind: 'unavailable', reason: 'NOT_VISIBLE' };
    }
    try {
      const found = await this.repository.lookup(session, issue);
      if (found.kind === 'unavailable')
        return {
          kind: 'unavailable',
          reason: literal(found.reason, ['NOT_AVAILABLE', 'NOT_READY']),
        };
      if (
        found.kind !== 'linked' ||
        found.installationId !== session.installationId ||
        found.issueId !== issue
      )
        throw new Error('INVALID_CONTEXT_RESULT');
      const tenantId = uuid(found.tenantId),
        incidentId = uuid(found.incidentId),
        readiness = literal(found.operations.readiness, [
          'ready',
          'not-ready',
          'unavailable',
        ]);
      if (readiness !== 'ready' && found.operations.snapshot !== null)
        throw new Error('INVALID_CONTEXT_RESULT');
      return {
        kind: 'available',
        incident: incident(
          found.incident,
          session.installationId,
          tenantId,
          incidentId,
        ),
        operations: {
          readiness,
          summary:
            found.operations.snapshot === null
              ? null
              : operation(
                  found.operations.snapshot,
                  session.installationId,
                  tenantId,
                  incidentId,
                ),
        },
      };
    } catch {
      return { kind: 'unavailable', reason: 'UNAVAILABLE' };
    }
  }
}
