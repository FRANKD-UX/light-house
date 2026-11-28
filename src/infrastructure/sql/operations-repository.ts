import type { TenantContext } from '../../application/ports/tenant-context';
import {
  OperationError,
  type OperationAggregate,
  type OperationAudit,
  type OperationFacts,
  type OperationKind,
  type OperationReceipt,
  type OperationRepository,
  type GateRecord,
  type NativeConfirmation,
} from '../../application/operations/contracts';
import type { Incident, IncidentEvidence } from '../../domain/incidents/model';
import {
  InventoryError,
  integer,
  object,
  text,
  utc,
  uuid,
  type Scalar,
} from '../../domain/inventory/model';
import { SqlIncidentRepository } from './incident-repository';
import type { SqlDriver } from './driver';
const templates: Partial<Record<OperationKind, GateRecord['template']>> = {
  start_work: 'operational',
  request_handoff: 'operational',
  request_return: 'remediation',
  return_to_noc: 'remediation',
  accept_return: 'remediation',
  accept_handoff: 'operational',
  request_validation: 'remediation',
  validate_restoration: 'restoration',
  resolve: 'closure',
  close: 'closure',
};
const handoffs = new Set([
  'request_handoff',
  'accept_handoff',
  'reject_handoff',
  'request_return',
  'return_to_noc',
  'accept_return',
  'reject_return',
]);
const fields: Record<GateRecord['template'], readonly string[]> = {
  operational: [
    'diagnosticFindings',
    'escalationJustification',
    'supportingEvidence',
    'receivingCapability',
    'accountableEngineer',
    'outstandingActions',
  ],
  remediation: ['workCompleted', 'supportingEvidence', 'outstandingActions'],
  restoration: [
    'restorationEvidence',
    'impactReassessed',
    'outstandingActions',
    'validatorRecorded',
  ],
  closure: [
    'closureEvidence',
    'outstandingActions',
    'nativePermissionConfirmed',
  ],
};
const bools = new Set([
  'receivingCapability',
  'accountableEngineer',
  'impactReassessed',
  'validatorRecorded',
  'nativePermissionConfirmed',
]);
const scope = (ctx: TenantContext): Scalar[] => [
  ctx.installationId,
  ctx.tenantId,
];
const parent =
  'EXISTS (SELECT 1 FROM isp_tenants t WHERE t.installation_id = ? AND t.id = ? AND t.status = ? AND t.pending_mutation IS NULL)';
const parentParams = (ctx: TenantContext): Scalar[] => [
  ...scope(ctx),
  'active',
];
const factsGuard =
  '(SELECT COUNT(*) FROM incident_evidence e JOIN incidents i ON i.installation_id = e.installation_id AND i.tenant_id = e.tenant_id AND i.source_id = e.source_id AND i.problem_event_id = e.problem_event_id WHERE i.installation_id = ? AND i.tenant_id = ? AND i.id = ?) = ?';
function json(value: unknown, max = 60000): string {
  const result = JSON.stringify(value);
  if (!result || Buffer.byteLength(result, 'utf8') > max)
    throw new OperationError('INVALID');
  return result;
}
function bound(
  ctx: TenantContext,
  value: { installationId: string; tenantId: string },
): void {
  if (
    value.installationId !== ctx.installationId ||
    value.tenantId !== ctx.tenantId
  )
    throw new OperationError('DENIED');
}
function duplicate(error: unknown): boolean {
  return error instanceof InventoryError && error.code === 'CONFLICT';
}
interface Stored {
  version: number;
  facts_version: number;
  aggregate_json: string;
  pending_command: string | null;
  pending_json: string | null;
}
export interface OperationsConfiguration {
  readonly nocTeamId: string;
  readonly version: number;
}
function aggregate(
  ctx: TenantContext,
  input: unknown,
  id?: string,
): OperationAggregate {
  const v = object(input),
    op = object(v.incident);
  bound(ctx, {
    installationId: text(v.installationId, 255),
    tenantId: uuid(v.tenantId),
  });
  if (op.tenantId !== ctx.tenantId || (id !== undefined && op.id !== id))
    throw new OperationError('DENIED');
  uuid(v.nocTeamId);
  uuid(op.id);
  uuid(op.ownerTeamId);
  if (op.ownerAssigneeId !== null) uuid(op.ownerAssigneeId);
  integer(op.version);
  integer(v.factsVersion);
  if (
    ![
      'new',
      'acknowledged',
      'triage',
      'in_progress',
      'restoration_validation',
      'resolved',
      'closed',
    ].includes(op.state as string)
  )
    throw new OperationError('INVALID');
  const sla = object(op.sla);
  uuid(sla.policyId);
  uuid(sla.tierId);
  utc(sla.startedAt);
  utc(sla.warningAt);
  utc(sla.deadlineAt);
  if (op.pendingHandoff !== null) {
    const handoff = object(op.pendingHandoff);
    uuid(handoff.targetTeamId);
    utc(handoff.requestedAt);
  }
  if (op.pendingReturn !== null) {
    const returned = object(op.pendingReturn);
    uuid(returned.fromTeamId);
    utc(returned.requestedAt);
  }
  for (const stamp of [
    op.recoveryObservedAt,
    op.restorationValidatedAt,
    op.resolvedAt,
  ])
    if (stamp !== null) utc(stamp);
  if (v.validation !== null) {
    const validation = object(v.validation);
    uuid(validation.gateId);
    integer(validation.factsVersion);
    utc(validation.validatedAt);
    utc(validation.validUntil);
  }
  if (v.lease !== null) {
    const lease = object(v.lease);
    uuid(lease.token);
    utc(lease.until);
  }
  if (v.pending !== null) {
    const pending = object(v.pending),
      receipt = object(pending.receipt),
      audit = object(pending.audit),
      result = object(receipt.result);
    uuid(receipt.commandId);
    uuid(audit.correlationId);
    text(audit.accountId, 255);
    uuid(audit.teamId);
    uuid(audit.assigneeId);
    if (audit.fromAssigneeId !== null) uuid(audit.fromAssigneeId);
    if (audit.toAssigneeId !== null) uuid(audit.toAssigneeId);
    utc(audit.at);
    uuid(audit.fromOwner);
    uuid(audit.toOwner);
    if (audit.targetTeamId !== null) uuid(audit.targetTeamId);
    if (audit.targetAssigneeId !== undefined && audit.targetAssigneeId !== null)
      uuid(audit.targetAssigneeId);
    if (
      audit.action === 'assign'
        ? audit.targetAssigneeId !== op.ownerAssigneeId ||
          audit.targetAssigneeId === null
        : audit.targetAssigneeId !== undefined &&
          audit.targetAssigneeId !== null
    )
      throw new OperationError('INVALID');
    if (audit.nativeIntentId !== null) uuid(audit.nativeIntentId);
    integer(audit.factsVersion);
    if (audit.factsVersion !== v.factsVersion)
      throw new OperationError('INVALID');
    if (
      !/^[0-9a-f]{64}$/.test(text(receipt.fingerprint, 64)) ||
      audit.commandId !== receipt.commandId ||
      result.incidentId !== op.id ||
      result.version !== op.version ||
      result.state !== op.state ||
      result.ownerTeamId !== op.ownerTeamId ||
      result.ownerAssigneeId !== op.ownerAssigneeId ||
      audit.toAssigneeId !== op.ownerAssigneeId ||
      result.correlationId !== audit.correlationId ||
      result.pendingMaterialisation !== false ||
      audit.slaPolicyId !== sla.policyId ||
      audit.slaStartedAt !== sla.startedAt ||
      audit.slaDeadlineAt !== sla.deadlineAt
    )
      throw new OperationError('INVALID');
    if (audit.reason !== null) text(audit.reason, 300);
    if (audit.gateId !== null) uuid(audit.gateId);
    json(pending, 8192);
  }
  return v as unknown as OperationAggregate;
}
export class SqlOperationsRepository implements OperationRepository {
  private readonly incidentRepository: SqlIncidentRepository;
  constructor(
    readonly db: SqlDriver,
    private readonly now: () => string,
  ) {
    this.incidentRepository = new SqlIncidentRepository(db);
  }
  async ready(installationId: string): Promise<boolean> {
    try {
      const rows = await this.db.rows<{ ready: number }>(
        'SELECT o.ready FROM operations_schema_state o JOIN jsm_schema_state j ON j.installation_id = o.installation_id JOIN incident_schema_state s ON s.installation_id = o.installation_id JOIN monitoring_schema_state m ON m.installation_id = o.installation_id JOIN installation_metadata i ON i.installation_id = o.installation_id WHERE o.installation_id = ? AND o.schema_version = 5 AND o.ready = 1 AND j.schema_version = 4 AND j.ready = 1 AND s.schema_version = 3 AND s.ready = 1 AND m.schema_version = 2 AND m.ready = 1 AND i.schema_version = 1 AND i.readiness = ? AND i.environment = ?',
        [text(installationId, 255), 'ready', 'DEVELOPMENT'],
      );
      return rows.length === 1 && rows[0]?.ready === 1;
    } catch {
      return false;
    }
  }
  private async access(ctx: TenantContext): Promise<void> {
    if (!(await this.ready(ctx.installationId)))
      throw new OperationError('NOT_READY');
    await this.incidentRepository.bound(ctx);
  }
  async enriched(ctx: TenantContext, id: string): Promise<Incident | null> {
    await this.access(ctx);
    uuid(id);
    const rows = await this.db.rows<{ snapshot_json: string }>(
      'SELECT snapshot_json FROM incidents WHERE installation_id = ? AND tenant_id = ? AND id = ?',
      [...scope(ctx), id],
    );
    if (!rows[0]) return null;
    const value = object(JSON.parse(rows[0].snapshot_json));
    bound(ctx, {
      installationId: text(value.installationId, 255),
      tenantId: uuid(value.tenantId),
    });
    if (value.id !== id) throw new OperationError('DENIED');
    return value as unknown as Incident;
  }
  async load(
    ctx: TenantContext,
    id: string,
  ): Promise<OperationAggregate | null> {
    await this.access(ctx);
    uuid(id);
    const rows = await this.db.rows<Stored>(
      'SELECT version, facts_version, aggregate_json, pending_command, pending_json FROM operations_state WHERE installation_id = ? AND tenant_id = ? AND incident_id = ?',
      [...scope(ctx), id],
    );
    if (!rows[0]) return null;
    const row = rows[0],
      value = aggregate(ctx, JSON.parse(row.aggregate_json), id);
    if (
      value.incident.version !== row.version ||
      value.factsVersion !== row.facts_version ||
      (value.pending?.receipt.commandId ?? null) !== row.pending_command ||
      (value.pending ? json(value.pending, 8192) : null) !== row.pending_json
    )
      throw new OperationError('REPAIR_REQUIRED');
    return value;
  }
  async facts(ctx: TenantContext, id: string): Promise<OperationFacts> {
    const enriched = await this.enriched(ctx, id);
    if (!enriched) throw new OperationError('NOT_READY');
    const rows = await this.db.rows<{ evidence_json: string }>(
      'SELECT e.evidence_json FROM incident_evidence e JOIN incidents i ON i.installation_id = e.installation_id AND i.tenant_id = e.tenant_id AND i.source_id = e.source_id AND i.problem_event_id = e.problem_event_id WHERE i.installation_id = ? AND i.tenant_id = ? AND i.id = ? ORDER BY e.id LIMIT 1001',
      [...scope(ctx), id],
    );
    if (!rows.length || rows.length > 1000)
      throw new OperationError('NOT_READY');
    const entries = rows.map(
      (row) =>
        object(JSON.parse(row.evidence_json)) as unknown as IncidentEvidence,
    );
    for (const entry of entries) {
      if (
        entry.sourceId !== enriched.sourceId ||
        entry.event.problemEventId !== enriched.problemEventId
      )
        throw new OperationError('DENIED');
      uuid(entry.siteId);
      uuid(entry.uplinkId);
      utc(entry.event.occurredAt);
      text(entry.event.resourceId, 128);
    }
    const original = entries.filter(
      (e) =>
        e.event.kind === 'problem' &&
        e.event.externalEventId === enriched.problemEventId &&
        e.event.occurredAt === enriched.occurredAt &&
        e.siteId === enriched.impact.siteId &&
        e.uplinkId === enriched.impact.uplinkId,
    );
    if (original.length !== 1) throw new OperationError('NOT_READY');
    const recovered = entries
      .filter(
        (e) =>
          e.event.kind === 'recovery' &&
          e.siteId === enriched.impact.siteId &&
          e.uplinkId === enriched.impact.uplinkId &&
          e.event.resourceId === original[0]!.event.resourceId &&
          e.event.occurredAt >= enriched.occurredAt,
      )
      .map((e) => e.event.occurredAt)
      .sort();
    return { revision: rows.length, recoveryObservedAt: recovered[0] ?? null };
  }
  private guards(
    ctx: TenantContext,
    value: OperationAggregate,
  ): { query: string; params: Scalar[] } {
    const audit = value.pending?.audit;
    const teams = [
      ...new Set([
        value.incident.ownerTeamId,
        value.nocTeamId,
        ...(audit ? [audit.teamId] : []),
        ...(value.incident.pendingHandoff
          ? [value.incident.pendingHandoff.targetTeamId]
          : []),
        ...(value.incident.pendingReturn
          ? [value.incident.pendingReturn.fromTeamId]
          : []),
      ]),
    ];
    const query = [
      parent,
      factsGuard,
      'EXISTS (SELECT 1 FROM operations_configuration c WHERE c.installation_id = ? AND c.tenant_id = ? AND c.noc_team_id = ?)',
      'EXISTS (SELECT 1 FROM sla_tiers tier WHERE tier.tenant_id = ? AND tier.id = ? AND tier.status = ? AND tier.pending IS NULL)',
      ...teams.map(
        () =>
          'EXISTS (SELECT 1 FROM teams team WHERE team.tenant_id = ? AND team.id = ? AND team.status = ? AND team.pending IS NULL)',
      ),
    ].join(' AND ');
    const params: Scalar[] = [
      ...parentParams(ctx),
      ...scope(ctx),
      value.incident.id,
      value.factsVersion,
      ...scope(ctx),
      value.nocTeamId,
      ctx.tenantId,
      value.incident.sla.tierId,
      'active',
      ...teams.flatMap((teamId) => [ctx.tenantId, uuid(teamId), 'active']),
    ];
    if (value.incident.ownerAssigneeId !== null) {
      const ownerGuard =
        'EXISTS (SELECT 1 FROM assignees a JOIN team_memberships tm ON tm.tenant_id = a.tenant_id AND tm.assignee_id = a.id WHERE a.tenant_id = ? AND a.id = ? AND a.status = ? AND a.pending IS NULL AND tm.team_id = ? AND tm.status = ? AND tm.role IN (?, ?) AND tm.pending IS NULL AND (tm.effective_until IS NULL OR tm.effective_until > ?))';
      const ownerParams: Scalar[] = [
        ctx.tenantId,
        uuid(value.incident.ownerAssigneeId),
        'active',
        value.incident.ownerTeamId,
        'active',
        'engineer',
        'lead',
        utc(this.now()),
      ];
      const targetGrant =
        audit?.action === 'assign'
          ? ' AND EXISTS (SELECT 1 FROM assignees target JOIN tenant_memberships grant_row ON grant_row.tenant_id = target.tenant_id AND grant_row.account_id = target.atlassian_account_id WHERE target.tenant_id = ? AND target.id = ? AND target.atlassian_account_id IS NOT NULL AND grant_row.status = ? AND grant_row.role IN (?, ?) AND (grant_row.expires_at IS NULL OR grant_row.expires_at > ?))'
          : '';
      if (audit?.action === 'assign')
        ownerParams.push(
          ctx.tenantId,
          uuid(value.incident.ownerAssigneeId),
          'active',
          'operator',
          'admin',
          utc(this.now()),
        );
      if (audit) {
        const actor = this.actorGuard(
          ctx,
          [audit.teamId],
          audit.assigneeId,
          audit.action === 'assign',
        );
        return {
          query:
            query + ' AND ' + ownerGuard + targetGrant + ' AND ' + actor.query,
          params: [...params, ...ownerParams, ...actor.params],
        };
      }
      return {
        query: query + ' AND ' + ownerGuard + targetGrant,
        params: [...params, ...ownerParams],
      };
    }
    if (audit) {
      const actor = this.actorGuard(
        ctx,
        [audit.teamId],
        audit.assigneeId,
        audit.action === 'assign',
      );
      return {
        query: query + ' AND ' + actor.query,
        params: [...params, ...actor.params],
      };
    }
    return { query, params };
  }
  private actorGuard(
    ctx: TenantContext,
    teams: readonly string[],
    assigneeId?: string,
    assignment = false,
  ): { query: string; params: Scalar[] } {
    if (ctx.actor.kind !== 'atlassian-user' || !teams.length)
      throw new OperationError('DENIED');
    const at = utc(this.now());
    return {
      query: `EXISTS (SELECT 1 FROM tenant_memberships m JOIN assignees a ON a.tenant_id = m.tenant_id AND a.atlassian_account_id = m.account_id JOIN team_memberships tm ON tm.tenant_id = a.tenant_id AND tm.assignee_id = a.id JOIN teams team ON team.tenant_id = tm.tenant_id AND team.id = tm.team_id WHERE m.tenant_id = ? AND m.account_id = ? AND m.role IN (?, ?) AND m.status = ? AND (m.expires_at IS NULL OR m.expires_at > ?) AND a.status = ? AND a.pending IS NULL ${assigneeId ? 'AND a.id = ?' : ''} AND tm.team_id IN (${teams.map(() => '?').join(', ')}) ${assignment ? 'AND (m.role = ? OR tm.role = ?)' : ''} AND tm.status = ? AND tm.role IN (?, ?) AND tm.pending IS NULL AND (tm.effective_until IS NULL OR tm.effective_until > ?) AND team.status = ? AND team.pending IS NULL)`,
      params: [
        ctx.tenantId,
        text(ctx.actor.accountId, 128),
        'operator',
        'admin',
        'active',
        at,
        'active',
        ...(assigneeId ? [uuid(assigneeId)] : []),
        ...teams.map(uuid),
        ...(assignment ? ['admin', 'lead'] : []),
        'active',
        'engineer',
        'lead',
        at,
        'active',
      ],
    };
  }
  private async checked(
    ctx: TenantContext,
    value: OperationAggregate,
  ): Promise<OperationAggregate> {
    await this.access(ctx);
    aggregate(ctx, value);
    if (!value.pending || value.lease) throw new OperationError('INVALID');
    if (
      value.pending.audit.action === 'resolve' ||
      value.pending.audit.action === 'close'
    )
      throw new OperationError('NOT_READY');
    const original = await this.enriched(ctx, value.incident.id);
    if (
      !original ||
      original.sla.kind !== 'selected' ||
      json(original.sla.snapshot) !== json(value.incident.sla)
    )
      throw new OperationError('CONFLICT');
    if (
      value.pending.audit.accountId !==
      (ctx.actor.kind === 'atlassian-user' ? ctx.actor.accountId : null)
    )
      throw new OperationError('DENIED');
    return value;
  }
  async initialise(
    ctx: TenantContext,
    input: OperationAggregate,
  ): Promise<OperationAggregate> {
    const value = await this.checked(ctx, input);
    if (
      value.incident.version !== 1 ||
      value.pending!.audit.action !== 'initialise' ||
      value.incident.state !== 'new' ||
      value.incident.ownerAssigneeId !== null ||
      value.incident.ownerTeamId !== value.nocTeamId
    )
      throw new OperationError('INVALID');
    const guard = this.guards(ctx, value);
    try {
      await this.db.write(
        `INSERT INTO operations_state (installation_id, tenant_id, incident_id, version, facts_version, aggregate_json, pending_command, pending_json, updated_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guard.query}`,
        [
          ...scope(ctx),
          value.incident.id,
          1,
          value.factsVersion,
          json(value),
          value.pending!.receipt.commandId,
          json(value.pending, 8192),
          value.pending!.audit.at,
          ...guard.params,
        ],
      );
    } catch (error) {
      if (!duplicate(error)) throw error;
    }
    const saved = await this.load(ctx, value.incident.id);
    if (!saved) throw new OperationError('CONFLICT');
    return saved;
  }
  async save(
    ctx: TenantContext,
    expected: number,
    input: OperationAggregate,
  ): Promise<boolean> {
    const value = await this.checked(ctx, input);
    integer(expected);
    if (value.incident.version !== expected + 1)
      throw new OperationError('CONFLICT');
    const prior = await this.load(ctx, value.incident.id);
    if (
      !prior ||
      prior.incident.version !== expected ||
      prior.pending ||
      prior.lease
    )
      return false;
    if (
      prior.nocTeamId !== value.nocTeamId ||
      json(prior.incident.sla) !== json(value.incident.sla) ||
      value.pending!.audit.fromState !== prior.incident.state ||
      value.pending!.audit.fromOwner !== prior.incident.ownerTeamId ||
      value.pending!.audit.fromAssigneeId !== prior.incident.ownerAssigneeId
    )
      throw new OperationError('CONFLICT');
    if (value.pending!.audit.action === 'assign') {
      if (
        value.incident.ownerTeamId !== prior.incident.ownerTeamId ||
        value.incident.state !== prior.incident.state ||
        value.incident.ownerAssigneeId === null ||
        value.incident.ownerAssigneeId === prior.incident.ownerAssigneeId ||
        value.pending!.audit.targetAssigneeId !==
          value.incident.ownerAssigneeId ||
        value.pending!.audit.teamId !== prior.incident.ownerTeamId ||
        value.incident.pendingHandoff ||
        value.incident.pendingReturn ||
        value.incident.restorationValidatedAt !== null ||
        value.validation !== null
      )
        throw new OperationError('CONFLICT');
      text(value.pending!.audit.reason, 300);
    }
    const guard = this.guards(ctx, value);
    return (
      (await this.db.write(
        `UPDATE operations_state SET version = ?, facts_version = ?, aggregate_json = ?, pending_command = ?, pending_json = ?, updated_at = ? WHERE installation_id = ? AND tenant_id = ? AND incident_id = ? AND version = ? AND pending_command IS NULL AND pending_json IS NULL AND updated_at <= ? AND ${guard.query}`,
        [
          value.incident.version,
          value.factsVersion,
          json(value),
          value.pending!.receipt.commandId,
          json(value.pending, 8192),
          value.pending!.audit.at,
          ...scope(ctx),
          value.incident.id,
          expected,
          value.pending!.audit.at,
          ...guard.params,
        ],
      )) === 1
    );
  }
  async receipt(
    ctx: TenantContext,
    incidentId: string,
    commandId: string,
  ): Promise<OperationReceipt | null> {
    await this.access(ctx);
    uuid(incidentId);
    uuid(commandId);
    const rows = await this.db.rows<{
      fingerprint: string;
      result_json: string;
    }>(
      'SELECT r.fingerprint, r.result_json FROM operations_receipts r JOIN operations_state s ON s.installation_id = r.installation_id AND s.tenant_id = r.tenant_id AND s.incident_id = r.incident_id WHERE r.installation_id = ? AND r.tenant_id = ? AND r.incident_id = ? AND r.command_id = ? AND s.pending_command IS NULL AND s.pending_json IS NULL',
      [...scope(ctx), incidentId, commandId],
    );
    return rows[0]
      ? {
          commandId,
          fingerprint: rows[0].fingerprint,
          result: JSON.parse(rows[0].result_json) as OperationReceipt['result'],
        }
      : null;
  }
  async materialise(
    ctx: TenantContext,
    incidentId: string,
    commandId: string,
  ): Promise<boolean> {
    const value = await this.load(ctx, incidentId);
    uuid(commandId);
    if (!value?.pending)
      return Boolean(await this.receipt(ctx, incidentId, commandId));
    if (value.pending.receipt.commandId !== commandId) return false;
    const envelope = json(value.pending, 8192),
      where =
        's.installation_id = ? AND s.tenant_id = ? AND s.incident_id = ? AND s.version = ? AND s.pending_command = ? AND s.pending_json = ?';
    const params: Scalar[] = [
      ...scope(ctx),
      incidentId,
      value.incident.version,
      commandId,
      envelope,
    ];
    const pending = value.pending;
    await this.db.write(
      `INSERT INTO operations_receipts (installation_id, tenant_id, incident_id, command_id, fingerprint, result_json) SELECT ?, ?, ?, ?, ?, ? FROM operations_state s WHERE ${where} ON DUPLICATE KEY UPDATE command_id = command_id`,
      [
        ...scope(ctx),
        incidentId,
        commandId,
        pending.receipt.fingerprint,
        json(pending.receipt.result, 2048),
        ...params,
      ],
    );
    await this.db.write(
      `INSERT INTO operations_audit (installation_id, tenant_id, incident_id, command_id, operation_version, audit_json) SELECT ?, ?, ?, ?, ?, ? FROM operations_state s WHERE ${where} ON DUPLICATE KEY UPDATE command_id = command_id`,
      [
        ...scope(ctx),
        incidentId,
        commandId,
        value.incident.version,
        json(pending.audit, 4096),
        ...params,
      ],
    );
    if (handoffs.has(pending.audit.action))
      await this.db.write(
        `INSERT INTO operations_handoff_history (installation_id, tenant_id, incident_id, command_id, operation_version, history_json) SELECT ?, ?, ?, ?, ?, ? FROM operations_state s WHERE ${where} ON DUPLICATE KEY UPDATE command_id = command_id`,
        [
          ...scope(ctx),
          incidentId,
          commandId,
          value.incident.version,
          json(
            {
              audit: pending.audit,
              pendingHandoff: value.incident.pendingHandoff,
              pendingReturn: value.incident.pendingReturn,
            },
            8192,
          ),
          ...params,
        ],
      );
    const receipt = await this.db.rows<{
      fingerprint: string;
      result_json: string;
    }>(
      'SELECT fingerprint, result_json FROM operations_receipts WHERE installation_id = ? AND tenant_id = ? AND incident_id = ? AND command_id = ?',
      [...scope(ctx), incidentId, commandId],
    );
    const audit = await this.db.rows<{ audit_json: string }>(
      'SELECT audit_json FROM operations_audit WHERE installation_id = ? AND tenant_id = ? AND incident_id = ? AND command_id = ?',
      [...scope(ctx), incidentId, commandId],
    );
    if (
      receipt[0]?.fingerprint !== pending.receipt.fingerprint ||
      receipt[0].result_json !== json(pending.receipt.result, 2048) ||
      audit[0]?.audit_json !== json(pending.audit, 4096)
    )
      throw new OperationError('CONFLICT');
    if (handoffs.has(pending.audit.action)) {
      const history = await this.db.rows<{ history_json: string }>(
        'SELECT history_json FROM operations_handoff_history WHERE installation_id = ? AND tenant_id = ? AND incident_id = ? AND command_id = ?',
        [...scope(ctx), incidentId, commandId],
      );
      if (
        history[0]?.history_json !==
        json(
          {
            audit: pending.audit,
            pendingHandoff: value.incident.pendingHandoff,
            pendingReturn: value.incident.pendingReturn,
          },
          8192,
        )
      )
        throw new OperationError('CONFLICT');
    }
    const cleared = { ...value, pending: null };
    return (
      (await this.db.write(
        `UPDATE operations_state SET aggregate_json = ?, pending_command = NULL, pending_json = NULL WHERE installation_id = ? AND tenant_id = ? AND incident_id = ? AND version = ? AND pending_command = ? AND pending_json = ?`,
        [json(cleared), ...params],
      )) === 1
    );
  }
  async gate(
    ctx: TenantContext,
    value: OperationAggregate,
    kind: OperationKind,
  ): Promise<GateRecord | null> {
    await this.access(ctx);
    aggregate(ctx, value);
    const template = templates[kind];
    if (!template) return null;
    const rows = await this.db.rows<{ gate_json: string }>(
      'SELECT gate_json FROM operations_gates WHERE installation_id = ? AND tenant_id = ? AND incident_id = ? AND template = ? AND incident_version = ? AND facts_version = ? ORDER BY valid_until DESC, id DESC LIMIT 1',
      [
        ...scope(ctx),
        value.incident.id,
        template,
        value.incident.version,
        (await this.facts(ctx, value.incident.id)).revision,
      ],
    );
    if (!rows[0]) return null;
    const stored = JSON.parse(rows[0].gate_json) as GateRecord;
    bound(ctx, stored);
    return stored;
  }
  async saveGate(ctx: TenantContext, record: GateRecord): Promise<boolean> {
    await this.access(ctx);
    bound(ctx, record);
    if (ctx.actor.kind !== 'atlassian-user') throw new OperationError('DENIED');
    uuid(record.id);
    uuid(record.incidentId);
    integer(record.incidentVersion);
    integer(record.factsVersion);
    if (
      !Object.hasOwn(fields, record.template) ||
      record.templateVersion !== 1 ||
      utc(record.evaluatedAt) > utc(this.now()) ||
      utc(record.validUntil) <= record.evaluatedAt
    )
      throw new OperationError('INVALID');
    const raw = object(record.fields),
      projected: Record<string, unknown> = {};
    if (Object.keys(raw).some((key) => !fields[record.template].includes(key)))
      throw new OperationError('INVALID');
    for (const key of fields[record.template]) {
      if (bools.has(key)) {
        if (typeof raw[key] !== 'boolean') throw new OperationError('INVALID');
        projected[key] = raw[key];
      } else projected[key] = text(raw[key], 1000);
    }
    const gate: GateRecord = {
      installationId: ctx.installationId,
      tenantId: ctx.tenantId,
      incidentId: record.incidentId,
      id: record.id,
      template: record.template,
      templateVersion: 1,
      incidentVersion: record.incidentVersion,
      factsVersion: record.factsVersion,
      evaluatedAt: record.evaluatedAt,
      validUntil: record.validUntil,
      fields: projected,
    };
    const current = await this.load(ctx, gate.incidentId);
    if (
      !current ||
      current.incident.version !== gate.incidentVersion ||
      current.pending ||
      current.lease
    )
      return false;
    const guard = this.guards(ctx, {
      ...current,
      factsVersion: gate.factsVersion,
    });
    const actor = this.actorGuard(ctx, [
      ...new Set([
        current.incident.ownerTeamId,
        current.nocTeamId,
        ...(current.incident.pendingHandoff
          ? [current.incident.pendingHandoff.targetTeamId]
          : []),
      ]),
    ]);
    try {
      return (
        (await this.db.write(
          `INSERT INTO operations_gates (installation_id, tenant_id, incident_id, id, template, template_version, incident_version, facts_version, actor_id, valid_until, gate_json) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM operations_state s WHERE s.installation_id = ? AND s.tenant_id = ? AND s.incident_id = ? AND s.version = ? AND s.pending_command IS NULL AND s.pending_json IS NULL AND s.updated_at <= ? AND ${guard.query} AND ${actor.query}`,
          [
            ...scope(ctx),
            gate.incidentId,
            gate.id,
            gate.template,
            1,
            gate.incidentVersion,
            gate.factsVersion,
            text(ctx.actor.accountId, 255),
            gate.validUntil,
            json(gate, 8192),
            ...scope(ctx),
            gate.incidentId,
            gate.incidentVersion,
            gate.evaluatedAt,
            ...guard.params,
            ...actor.params,
          ],
        )) === 1
      );
    } catch (error) {
      if (duplicate(error)) return false;
      throw error;
    }
  }
  async nativeConfirmation(
    ctx: TenantContext,
    incidentId: string,
    operation: 'resolve' | 'close',
  ): Promise<NativeConfirmation | null> {
    await this.access(ctx);
    uuid(incidentId);
    if (operation !== 'resolve' && operation !== 'close')
      throw new OperationError('INVALID');
    // No verified native transition-intent adapter exists yet. Never infer confirmation from a checklist or client field.
    return null;
  }
  async configuration(
    ctx: TenantContext,
  ): Promise<OperationsConfiguration | null> {
    await this.access(ctx);
    const rows = await this.db.rows<{ noc_team_id: string; version: number }>(
      'SELECT c.noc_team_id, c.version FROM operations_configuration c JOIN teams t ON t.tenant_id = c.tenant_id AND t.id = c.noc_team_id WHERE c.installation_id = ? AND c.tenant_id = ? AND t.status = ? AND t.pending IS NULL',
      [...scope(ctx), 'active'],
    );
    return rows[0]
      ? {
          nocTeamId: uuid(rows[0].noc_team_id),
          version: integer(rows[0].version),
        }
      : null;
  }
  async configure(
    ctx: TenantContext,
    config: OperationsConfiguration,
    expected: number,
  ): Promise<boolean> {
    await this.access(ctx);
    uuid(config.nocTeamId);
    integer(expected, 2147483646, 0);
    if (config.version !== expected + 1 || ctx.actor.kind !== 'atlassian-user')
      throw new OperationError('INVALID');
    const guard = `${parent} AND EXISTS (SELECT 1 FROM teams t WHERE t.tenant_id = ? AND t.id = ? AND t.status = ? AND t.pending IS NULL) AND EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id = ? AND m.account_id = ? AND m.role = ? AND m.status = ? AND (m.expires_at IS NULL OR m.expires_at > ?))`,
      params = [
        ...parentParams(ctx),
        ctx.tenantId,
        config.nocTeamId,
        'active',
        ctx.tenantId,
        text(ctx.actor.accountId, 128),
        'admin',
        'active',
        utc(this.now()),
      ];
    if (!expected) {
      try {
        return (
          (await this.db.write(
            `INSERT INTO operations_configuration (installation_id, tenant_id, noc_team_id, version) SELECT ?, ?, ?, ? WHERE ${guard}`,
            [...scope(ctx), config.nocTeamId, config.version, ...params],
          )) === 1
        );
      } catch (error) {
        if (duplicate(error)) return false;
        throw error;
      }
    }
    return (
      (await this.db.write(
        `UPDATE operations_configuration SET noc_team_id = ?, version = ? WHERE installation_id = ? AND tenant_id = ? AND version = ? AND ${guard}`,
        [config.nocTeamId, config.version, ...scope(ctx), expected, ...params],
      )) === 1
    );
  }
  async commandTeam(
    ctx: TenantContext,
    incidentId: string,
    commandId: string,
  ): Promise<string | null> {
    const current = await this.load(ctx, uuid(incidentId));
    uuid(commandId);
    if (current?.pending?.receipt.commandId === commandId)
      return uuid(current.pending.audit.teamId);
    const rows = await this.db.rows<{ audit_json: string }>(
      'SELECT audit_json FROM operations_audit WHERE installation_id = ? AND tenant_id = ? AND incident_id = ? AND command_id = ?',
      [...scope(ctx), incidentId, commandId],
    );
    if (!rows[0]) return null;
    const audit = object(JSON.parse(rows[0].audit_json));
    if (audit.commandId !== commandId) throw new OperationError('DENIED');
    return uuid(audit.teamId);
  }
  async list(ctx: TenantContext, after = ''): Promise<OperationAggregate[]> {
    await this.access(ctx);
    if (after) uuid(after);
    const rows = await this.db.rows<{ aggregate_json: string }>(
      'SELECT aggregate_json FROM operations_state WHERE installation_id = ? AND tenant_id = ? AND incident_id > ? ORDER BY incident_id LIMIT 21',
      [...scope(ctx), after],
    );
    return rows.map((row) => aggregate(ctx, JSON.parse(row.aggregate_json)));
  }
  async history(
    ctx: TenantContext,
    incidentId: string,
  ): Promise<Omit<OperationAudit, 'accountId'>[]> {
    await this.access(ctx);
    uuid(incidentId);
    const rows = await this.db.rows<{ audit_json: string }>(
      'SELECT audit_json FROM operations_audit WHERE installation_id = ? AND tenant_id = ? AND incident_id = ? ORDER BY operation_version LIMIT 101',
      [...scope(ctx), incidentId],
    );
    if (rows.length > 100) throw new OperationError('NOT_READY');
    return rows.map((row) => {
      const { accountId: privateActor, ...safe } = JSON.parse(
        row.audit_json,
      ) as OperationAudit;
      void privateActor;
      return { ...safe, targetAssigneeId: safe.targetAssigneeId ?? null };
    });
  }
}
