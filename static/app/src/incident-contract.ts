import {
  object,
  text,
  uuid,
  utc,
  integer,
} from '../../../src/domain/inventory/model';
import type {
  Incident,
  IncidentPolicy,
  Priority,
  SlaDecision,
} from '../../../src/domain/incidents/model';
import { validatePolicies } from '../../../src/domain/incidents/sla';
export type PublicIncident = Omit<Incident, 'installationId'>;
export interface IncidentOverview {
  incidents: PublicIncident[];
  next: string | null;
  policies: IncidentPolicy[];
  jsmLinks: {
    incidentId: string;
    state: string;
    issueId: string | null;
    issueKey: string | null;
  }[];
}
const one = <T extends string>(input: unknown, values: readonly T[]): T => {
  const value = values.find((x) => x === input);
  if (!value) throw new Error('INVALID_RESPONSE');
  return value;
};
const priorities = ['P1', 'P2', 'P3'] as const;
const ids = (input: unknown): string[] => {
  if (!Array.isArray(input) || input.length > 1000)
    throw new Error('INVALID_RESPONSE');
  const values = input.map(uuid);
  if (new Set(values).size !== values.length)
    throw new Error('INVALID_RESPONSE');
  return values;
};
export function incidentPolicy(
  input: unknown,
  tenantId: string,
): IncidentPolicy {
  const p = object(input),
    map = object(p.severityMap),
    targets = object(p.targets);
  if (Object.keys(map).length > 64) throw new Error('INVALID_RESPONSE');
  const severityMap: Record<string, Priority> = Object.create(null) as Record<
    string,
    Priority
  >;
  for (const [key, value] of Object.entries(map))
    severityMap[text(key, 32)] = one(value, priorities);
  const target = (priority: Priority) => {
    const t = object(targets[priority]);
    const durationSeconds = integer(t.durationSeconds);
    return {
      durationSeconds,
      warningSeconds: integer(t.warningSeconds, durationSeconds - 1, 0),
    };
  };
  const policy: IncidentPolicy = {
    id: uuid(p.id),
    tenantId: uuid(p.tenantId),
    tierId: uuid(p.tierId),
    version: integer(p.version),
    status: one(p.status, ['published']),
    effectiveFrom: utc(p.effectiveFrom),
    effectiveUntil: p.effectiveUntil === null ? null : utc(p.effectiveUntil),
    clock: one(p.clock, ['elapsed-utc']),
    severityMap,
    unknownImpact: one(p.unknownImpact, ['manual-review', ...priorities]),
    targets: { P1: target('P1'), P2: target('P2'), P3: target('P3') },
  };
  validatePolicies(tenantId, [policy]);
  return policy;
}
export function publicIncident(
  input: unknown,
  tenantId: string,
): PublicIncident {
  const i = object(input),
    impact = object(i.impact),
    sla = object(i.sla);
  if (i.tenantId !== tenantId) throw new Error('INVALID_RESPONSE');
  let decision: SlaDecision;
  if (sla.kind === 'manual_triage')
    decision = {
      kind: 'manual_triage',
      reason: one(sla.reason, [
        'UNKNOWN_IMPACT',
        'POLICY_GAP',
        'UNMAPPED_SEVERITY',
      ]),
    };
  else if (sla.kind === 'selected') {
    const s = object(sla.snapshot);
    const startedAt = utc(s.startedAt),
      durationSeconds = integer(s.durationSeconds),
      warningSeconds = integer(s.warningSeconds, durationSeconds - 1, 0),
      warningAt = utc(s.warningAt),
      deadlineAt = utc(s.deadlineAt);
    if (
      Date.parse(warningAt) !== Date.parse(startedAt) + warningSeconds * 1000 ||
      Date.parse(deadlineAt) !== Date.parse(startedAt) + durationSeconds * 1000
    )
      throw new Error('INVALID_RESPONSE');
    decision = {
      kind: 'selected',
      snapshot: {
        policyId: uuid(s.policyId),
        policyVersion: integer(s.policyVersion),
        tierId: uuid(s.tierId),
        consideredTierIds: ids(s.consideredTierIds),
        priority: one(s.priority, priorities),
        severity: text(s.severity, 32),
        confidence: one(s.confidence, ['known', 'unknown']),
        reason: one(s.reason, [
          'STRICTEST_AFFECTED_TIER',
          'CONFIGURED_UNKNOWN_IMPACT',
        ]),
        clock: one(s.clock, ['elapsed-utc']),
        startedAt,
        durationSeconds,
        warningSeconds,
        warningAt,
        deadlineAt,
      },
    };
  } else throw new Error('INVALID_RESPONSE');
  return {
    id: uuid(i.id),
    tenantId: uuid(i.tenantId),
    sourceId: uuid(i.sourceId),
    problemEventId: text(i.problemEventId, 32),
    correlationId: uuid(i.correlationId),
    createdAt: utc(i.createdAt),
    occurredAt: utc(i.occurredAt),
    state: one(i.state, ['new', 'manual_triage']),
    version: integer(i.version),
    sla: decision,
    impact: {
      confidence: one(impact.confidence, ['known', 'unknown']),
      reason: one(impact.reason, [
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
export function incidentOverview(
  input: unknown,
  tenantId: string,
): IncidentOverview {
  const v = object(input);
  if (
    !Array.isArray(v.incidents) ||
    v.incidents.length > 20 ||
    !Array.isArray(v.policies) ||
    v.policies.length > 1000
  )
    throw new Error('INVALID_RESPONSE');
  const incidents = v.incidents.map((i: unknown) =>
    publicIncident(i, tenantId),
  );
  if (new Set(incidents.map((i) => i.id)).size !== incidents.length)
    throw new Error('INVALID_RESPONSE');
  const policies = v.policies.map((p: unknown) => incidentPolicy(p, tenantId));
  validatePolicies(tenantId, policies);
  const rawLinks = v.jsmLinks === undefined ? [] : v.jsmLinks;
  if (!Array.isArray(rawLinks) || rawLinks.length > 20)
    throw new Error('INVALID_RESPONSE');
  const jsmLinks = rawLinks.map((raw: unknown) => {
    const link = object(raw);
    const incidentId = uuid(link.incidentId);
    if (!incidents.some((i) => i.id === incidentId))
      throw new Error('INVALID_RESPONSE');
    const state = one(link.state, [
      'prepared',
      'sending',
      'reconciling',
      'pending',
      'retry_wait',
      'ambiguous',
      'manual_review',
      'linked',
    ]);
    let issueId: string | null = null,
      issueKey: string | null = null;
    if (link.issueId !== null || link.issueKey !== null) {
      if (
        typeof link.issueId !== 'string' ||
        !/^[1-9][0-9]{0,19}$/.test(link.issueId) ||
        typeof link.issueKey !== 'string' ||
        !/^[A-Z][A-Z0-9_]{0,29}-[1-9][0-9]{0,19}$/.test(link.issueKey)
      )
        throw new Error('INVALID_RESPONSE');
      issueId = link.issueId;
      issueKey = link.issueKey;
    }
    if ((state === 'linked') !== (issueId !== null))
      throw new Error('INVALID_RESPONSE');
    return { incidentId, state, issueId, issueKey };
  });
  if (new Set(jsmLinks.map((link) => link.incidentId)).size !== jsmLinks.length)
    throw new Error('INVALID_RESPONSE');
  return {
    incidents,
    policies,
    jsmLinks,
    next: v.next === null ? null : uuid(v.next),
  };
}
export function incidentMutation(
  action: string,
  input: unknown,
  tenantId: string,
): string {
  const v = object(input);
  if (action === 'migrate' && v.queued === true)
    return 'Incident schema setup queued. Load incidents after completion; queued is not readiness.';
  if (
    (action === 'publishPolicy' || action === 'configureJsm') &&
    v.saved === true
  )
    return action === 'publishPolicy'
      ? 'Operational policy saved. Existing SLA snapshots remain unchanged.'
      : 'JSM configuration saved. No request was created.';
  if (action === 'process') {
    if (v.kind === 'awaiting_problem')
      return 'Event evidence retained; awaiting the problem event. Monitoring recovery does not resolve an incident.';
    if (v.kind === 'incident')
      return `Incident ${publicIncident(v.incident, tenantId).id} persisted. Reload to inspect impact and SLA.`;
  }
  if (action === 'createJsm') {
    const state = one(v.state, [
      'pending',
      'retry_wait',
      'ambiguous',
      'manual_review',
      'linked',
    ]);
    uuid(v.intentId);
    if ((state === 'linked') !== (v.issue !== null))
      throw new Error('INVALID_RESPONSE');
    if (v.issue !== null) {
      const issue = object(v.issue);
      if (
        typeof issue.id !== 'string' ||
        !/^[1-9][0-9]{0,19}$/.test(issue.id) ||
        typeof issue.key !== 'string' ||
        !/^[A-Z][A-Z0-9_]{0,29}-[1-9][0-9]{0,19}$/.test(issue.key)
      )
        throw new Error('INVALID_RESPONSE');
      return `JSM ${state}: ${issue.key}. Intent ${uuid(v.intentId)}.`;
    }
    return `JSM ${state}. Intent ${uuid(v.intentId)}. Inspect persisted state before any retry.`;
  }
  throw new Error('INVALID_RESPONSE');
}

export interface IncidentRecovery {
  examined: number;
  next: string | null;
  results: {
    inboxId: string;
    status: string;
    incidentId: string | null;
    code: string | null;
  }[];
}
export function incidentRecovery(input: unknown): IncidentRecovery {
  const value = object(input);
  if (!Array.isArray(value.results) || value.results.length > 20)
    throw new Error('INVALID_RESPONSE');
  const results = value.results.map((raw: unknown) => {
    const row = object(raw),
      inboxId = uuid(row.inboxId);
    const status = one(row.status, [
      'incident_schema_not_ready',
      'receipt_not_ready',
      'awaiting_problem',
      'manual_triage',
      'jsm_schema_not_ready',
      'configuration_required',
      'pending',
      'retry_wait',
      'ambiguous',
      'manual_review',
      'linked',
      'failed',
    ]);
    if (status === 'failed')
      return {
        inboxId,
        status,
        incidentId: null,
        code: one(row.code, [
          'INVALID',
          'DENIED',
          'NOT_READY',
          'CONFLICT',
          'UNAVAILABLE',
        ]),
      };
    const incidentId = row.incidentId === null ? null : uuid(row.incidentId);
    if (
      ![
        'incident_schema_not_ready',
        'receipt_not_ready',
        'awaiting_problem',
      ].includes(status) &&
      incidentId === null
    )
      throw new Error('INVALID_RESPONSE');
    return { inboxId, status, incidentId, code: null };
  });
  if (new Set(results.map((row) => row.inboxId)).size !== results.length)
    throw new Error('INVALID_RESPONSE');
  const examined = integer(value.examined, 20, 0);
  if (examined !== results.length) throw new Error('INVALID_RESPONSE');
  const next = value.next === null ? null : uuid(value.next);
  if (next !== null && (results.length !== 20 || next !== results[19]!.inboxId))
    throw new Error('INVALID_RESPONSE');
  return { examined, next, results };
}
