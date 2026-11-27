import { integer, object, text, utc, uuid } from '../inventory/model';
import {
  IncidentError,
  type ImpactSnapshot,
  type IncidentPolicy,
  type Priority,
  type SlaDecision,
  type SlaSnapshot,
} from './model';
const priorities: readonly Priority[] = ['P1', 'P2', 'P3'];
function validPriority(input: unknown): input is Priority {
  return priorities.includes(input as Priority);
}
export function validatePolicies(
  tenantId: string,
  input: unknown,
): asserts input is readonly IncidentPolicy[] {
  uuid(tenantId);
  if (!Array.isArray(input) || input.length > 1000)
    throw new IncidentError('INVALID');
  const policies = input as readonly IncidentPolicy[];
  const identities = new Set<string>();
  for (const policy of policies) {
    if (
      !policy ||
      typeof policy !== 'object' ||
      Array.isArray(policy) ||
      !policy.targets ||
      typeof policy.targets !== 'object' ||
      Array.isArray(policy.targets)
    )
      throw new IncidentError('INVALID');
    uuid(policy.id);
    uuid(policy.tierId);
    integer(policy.version);
    if (policy.tenantId !== tenantId) throw new IncidentError('DENIED');
    if (identities.has(policy.id)) throw new IncidentError('INVALID');
    identities.add(policy.id);
    utc(policy.effectiveFrom);
    if (
      policy.effectiveUntil !== null &&
      utc(policy.effectiveUntil) <= policy.effectiveFrom
    )
      throw new IncidentError('INVALID');
    if (
      policy.status !== 'published' ||
      policy.clock !== 'elapsed-utc' ||
      (policy.unknownImpact !== 'manual-review' &&
        !validPriority(policy.unknownImpact))
    )
      throw new IncidentError('INVALID');
    if (
      !policy.severityMap ||
      typeof policy.severityMap !== 'object' ||
      Array.isArray(policy.severityMap) ||
      Object.keys(policy.severityMap).length > 64
    )
      throw new IncidentError('INVALID');
    for (const [severity, priority] of Object.entries(policy.severityMap)) {
      text(severity, 32);
      if (!validPriority(priority)) throw new IncidentError('INVALID');
    }
    for (const priority of priorities) {
      const target = policy.targets[priority];
      if (!target || typeof target !== 'object' || Array.isArray(target))
        throw new IncidentError('INVALID');
      integer(target.durationSeconds);
      integer(target.warningSeconds, target.durationSeconds - 1, 0);
    }
  }
  for (let i = 0; i < policies.length; i++) {
    const a = policies[i]!;
    for (const b of policies.slice(i + 1)) {
      if (a.tierId !== b.tierId) continue;
      if (
        a.version === b.version ||
        (a.effectiveFrom < (b.effectiveUntil ?? '9999-12-31T23:59:59.999Z') &&
          b.effectiveFrom < (a.effectiveUntil ?? '9999-12-31T23:59:59.999Z'))
      )
        throw new IncidentError('CONFLICT');
    }
  }
}
/** Policy selection is deterministic at source occurrence, never at delivery time. */
export function selectSla(
  tenantId: string,
  startedAt: string,
  severity: string,
  impact: Pick<ImpactSnapshot, 'confidence' | 'tierIds'>,
  policies: readonly IncidentPolicy[],
): SlaDecision {
  utc(startedAt);
  text(severity, 32);
  validatePolicies(tenantId, policies);
  if (impact.confidence !== 'known' && impact.confidence !== 'unknown')
    throw new IncidentError('INVALID');
  const tiers = [...new Set(impact.tierIds.map(uuid))].sort();
  if (!tiers.length) return { kind: 'manual_triage', reason: 'UNKNOWN_IMPACT' };
  const candidates: SlaSnapshot[] = [];
  for (const tierId of tiers) {
    const policy = policies.find(
      (p) =>
        p.tierId === tierId &&
        p.effectiveFrom <= startedAt &&
        (p.effectiveUntil === null || startedAt < p.effectiveUntil),
    );
    if (!policy) return { kind: 'manual_triage', reason: 'POLICY_GAP' };
    const priority =
      impact.confidence === 'unknown'
        ? policy.unknownImpact
        : Object.hasOwn(policy.severityMap, severity)
          ? policy.severityMap[severity]
          : undefined;
    if (priority === 'manual-review')
      return { kind: 'manual_triage', reason: 'UNKNOWN_IMPACT' };
    if (!priority)
      return { kind: 'manual_triage', reason: 'UNMAPPED_SEVERITY' };
    const target = policy.targets[priority];
    const deadline = Date.parse(startedAt) + target.durationSeconds * 1000;
    const warning = Date.parse(startedAt) + target.warningSeconds * 1000;
    if (!Number.isFinite(deadline) || deadline > 253402300799999)
      throw new IncidentError('INVALID');
    candidates.push({
      policyId: policy.id,
      policyVersion: policy.version,
      tierId,
      consideredTierIds: Object.freeze(tiers),
      priority,
      severity,
      confidence: impact.confidence,
      reason:
        impact.confidence === 'unknown'
          ? 'CONFIGURED_UNKNOWN_IMPACT'
          : 'STRICTEST_AFFECTED_TIER',
      clock: 'elapsed-utc',
      startedAt,
      durationSeconds: target.durationSeconds,
      warningSeconds: target.warningSeconds,
      warningAt: new Date(warning).toISOString(),
      deadlineAt: new Date(deadline).toISOString(),
    });
  }
  candidates.sort(
    (a, b) =>
      a.deadlineAt.localeCompare(b.deadlineAt) ||
      a.priority.localeCompare(b.priority) ||
      a.tierId.localeCompare(b.tierId) ||
      a.policyId.localeCompare(b.policyId),
  );
  return Object.freeze({
    kind: 'selected',
    snapshot: Object.freeze(candidates[0]!),
  });
}
export function slaStatus(
  snapshot: SlaSnapshot,
  now: string,
  resolvedAt: string | null = null,
): 'on-track' | 'warning' | 'breached' {
  utc(now);
  utc(snapshot.startedAt);
  utc(snapshot.warningAt);
  utc(snapshot.deadlineAt);
  const at = resolvedAt === null ? now : utc(resolvedAt);
  if (at < snapshot.startedAt || (resolvedAt !== null && resolvedAt > now))
    throw new IncidentError('INVALID');
  return at >= snapshot.deadlineAt
    ? 'breached'
    : at >= snapshot.warningAt
      ? 'warning'
      : 'on-track';
}

/** Trust-boundary projection: extra client fields never enter persisted policy JSON. */
export function parseIncidentPolicy(
  tenantId: string,
  input: unknown,
): IncidentPolicy {
  const raw = object(input);
  const map = object(raw.severityMap),
    targets = object(raw.targets);
  const severityMap = Object.fromEntries(
    Object.entries(map).map(([severity, priority]) => {
      text(severity, 32);
      if (!validPriority(priority)) throw new IncidentError('INVALID');
      return [severity, priority];
    }),
  );
  if (
    !validPriority(raw.unknownImpact) &&
    raw.unknownImpact !== 'manual-review'
  )
    throw new IncidentError('INVALID');
  if (raw.status !== 'published' || raw.clock !== 'elapsed-utc')
    throw new IncidentError('INVALID');
  const parseTarget = (priority: Priority) => {
    const value = object(targets[priority]);
    const durationSeconds = integer(value.durationSeconds);
    return Object.freeze({
      durationSeconds,
      warningSeconds: integer(value.warningSeconds, durationSeconds - 1, 0),
    });
  };
  const policy: IncidentPolicy = Object.freeze({
    id: uuid(raw.id),
    tenantId: uuid(raw.tenantId),
    tierId: uuid(raw.tierId),
    version: integer(raw.version),
    status: 'published',
    effectiveFrom: utc(raw.effectiveFrom),
    effectiveUntil:
      raw.effectiveUntil === null ? null : utc(raw.effectiveUntil),
    clock: 'elapsed-utc',
    severityMap: Object.freeze(severityMap),
    unknownImpact: raw.unknownImpact,
    targets: Object.freeze({
      P1: parseTarget('P1'),
      P2: parseTarget('P2'),
      P3: parseTarget('P3'),
    }),
  });
  validatePolicies(tenantId, [policy]);
  return policy;
}
