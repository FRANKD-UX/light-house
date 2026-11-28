import type { TenantContext } from '../../application/ports/tenant-context';
import {
  JsmError,
  type JsmRequest,
  type JsmConfiguration,
  type JsmIncident,
  type JsmIntent,
  type JsmRepository,
} from '../../application/jsm/contracts';
import {
  bound,
  configuration,
  identifier,
} from '../../application/jsm/validation';
import {
  InventoryError,
  integer,
  object,
  text,
  utc,
  uuid,
} from '../../domain/inventory/model';
import type { SqlDriver } from './driver';

const parent =
  'EXISTS (SELECT 1 FROM isp_tenants t WHERE t.id = ? AND t.installation_id = ? AND t.status = ? AND t.pending_mutation IS NULL)';
interface IntentRow {
  installation_id: string;
  tenant_id: string;
  id: string;
  incident_id: string;
  marker: string;
  configuration_json: string;
  request_json: string;
  state: JsmIntent['state'];
  version: number;
  attempts: number;
  reconciliations: number;
  due_at: string | null;
  lease_until: string | null;
  issue_id: string | null;
  issue_key: string | null;
  reason: JsmIntent['reason'];
  audit_json: string;
}
const scope = (ctx: TenantContext) => [ctx.installationId, ctx.tenantId];
const parentScope = (ctx: TenantContext) => [
  ctx.tenantId,
  ctx.installationId,
  'active',
];

function safeRequest(
  config: JsmConfiguration,
  marker: string,
  input: unknown,
): JsmRequest {
  const v = object(input),
    values = object(v.requestFieldValues);
  const keys = [
    'summary',
    'description',
    'priority',
    ...Object.values(config.fields),
  ];
  if (
    v.serviceDeskId !== config.serviceDeskId ||
    v.requestTypeId !== config.requestTypeId ||
    Object.keys(values).length !== keys.length ||
    Object.keys(values).some((key) => !keys.includes(key)) ||
    values[config.fields.marker] !== marker
  )
    throw new JsmError('INVALID');
  const priority = identifier(object(values.priority).id);
  if (!Object.values(config.priorityIds).includes(priority))
    throw new JsmError('INVALID');
  const warning = utc(values[config.fields.warning]),
    deadline = utc(values[config.fields.deadline]);
  if (warning >= deadline) throw new JsmError('INVALID');
  return {
    serviceDeskId: config.serviceDeskId,
    requestTypeId: config.requestTypeId,
    requestFieldValues: {
      summary: text(values.summary, 200),
      description: text(values.description, 4000),
      priority: { id: priority },
      [config.fields.marker]: marker,
      [config.fields.warning]: warning,
      [config.fields.deadline]: deadline,
      [config.fields.policy]: uuid(values[config.fields.policy]),
    },
  };
}

export class SqlJsmRepository implements JsmRepository {
  constructor(
    private readonly db: SqlDriver,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}
  private async ready(ctx: TenantContext): Promise<void> {
    text(ctx.installationId, 255);
    uuid(ctx.tenantId);
    const rows = await this.db
      .rows<{ ready: number }>(
        `SELECT j.ready FROM jsm_schema_state j JOIN incident_schema_state s ON s.installation_id = j.installation_id JOIN monitoring_schema_state m ON m.installation_id = j.installation_id JOIN installation_metadata i ON i.installation_id = j.installation_id WHERE j.installation_id = ? AND j.schema_version = 4 AND j.ready = 1 AND s.schema_version = 3 AND s.ready = 1 AND m.schema_version = 2 AND m.ready = 1 AND i.schema_version = 1 AND i.readiness = ? AND i.environment = ? AND ${parent}`,
        [ctx.installationId, 'ready', 'DEVELOPMENT', ...parentScope(ctx)],
      )
      .catch(() => {
        throw new JsmError('NOT_READY');
      });
    if (rows.length !== 1 || rows[0]?.ready !== 1)
      throw new JsmError('NOT_READY');
  }
  async incident(ctx: TenantContext, id: string): Promise<JsmIncident | null> {
    await this.ready(ctx);
    const rows = await this.db.rows<{ snapshot_json: string }>(
      'SELECT snapshot_json FROM incidents WHERE installation_id = ? AND tenant_id = ? AND id = ?',
      [...scope(ctx), uuid(id)],
    );
    if (!rows[0]) return null;
    try {
      const v = object(JSON.parse(rows[0].snapshot_json));
      bound(ctx, {
        installationId: text(v.installationId, 255),
        tenantId: uuid(v.tenantId),
      });
      if (uuid(v.id) !== id) throw new JsmError('DENIED');
      const decision = object(v.sla);
      if (decision.kind !== 'selected') return null;
      const sla = object(decision.snapshot);
      const priority = sla.priority;
      if (priority !== 'P1' && priority !== 'P2' && priority !== 'P3')
        throw new JsmError('INVALID');
      const warningAt = utc(sla.warningAt),
        deadlineAt = utc(sla.deadlineAt);
      if (warningAt >= deadlineAt) throw new JsmError('INVALID');
      const impact = object(v.impact);
      const ids = (input: unknown): string[] => {
        if (!Array.isArray(input) || input.length > 1000)
          throw new JsmError('INVALID');
        const values = input.map(uuid);
        if (new Set(values).size !== values.length)
          throw new JsmError('INVALID');
        return values;
      };
      const customers = ids(impact.affectedCustomerIds),
        potentialCustomers = ids(impact.potentiallyAffectedCustomerIds),
        services = ids(impact.affectedServiceIds),
        potentialServices = ids(impact.potentiallyAffectedServiceIds);
      if (
        !['known', 'unknown'].includes(impact.confidence as string) ||
        !['COMPLETE', 'INCOMPLETE_INVENTORY', 'UNKNOWN_FAILOVER'].includes(
          impact.reason as string,
        ) ||
        customers.some((value) => !potentialCustomers.includes(value)) ||
        services.some((value) => !potentialServices.includes(value))
      )
        throw new JsmError('INVALID');
      const context = `Site ${uuid(impact.siteId)}; uplink ${uuid(impact.uplinkId)}; carrier ${uuid(impact.carrierId)}. Impact ${impact.confidence} (${impact.reason}); confirmed customers ${customers.length}, potential customers ${potentialCustomers.length}; confirmed services ${services.length}, potential services ${potentialServices.length}.`;
      return {
        installationId: ctx.installationId,
        tenantId: ctx.tenantId,
        id,
        summary: `Light House synthetic incident ${id}`,
        description: `Synthetic monitoring incident. ${context} Original occurrence: ${utc(v.occurredAt)}. Policy revision: ${integer(sla.policyVersion)}. Operational restoration requires explicit validation.`,
        priority,
        warningAt,
        deadlineAt,
        policyVersionId: uuid(sla.policyId),
      };
    } catch (error) {
      if (error instanceof JsmError) throw error;
      throw new JsmError('INVALID');
    }
  }
  async configuration(ctx: TenantContext): Promise<JsmConfiguration | null> {
    await this.ready(ctx);
    const rows = await this.db.rows<{ configuration_json: string }>(
      'SELECT configuration_json FROM jsm_configuration WHERE installation_id = ? AND tenant_id = ?',
      scope(ctx),
    );
    return rows[0]
      ? configuration(ctx, JSON.parse(rows[0].configuration_json))
      : null;
  }
  async saveConfiguration(
    ctx: TenantContext,
    config: JsmConfiguration,
    expected: number,
  ): Promise<boolean> {
    await this.ready(ctx);
    const value = configuration(ctx, config);
    integer(expected, 2147483646, 0);
    if (value.version !== expected + 1) throw new JsmError('CONFLICT');
    const json = JSON.stringify(value);
    if (expected === 0) {
      try {
        return (
          (await this.db.write(
            `INSERT INTO jsm_configuration (installation_id, tenant_id, version, configuration_json) SELECT ?, ?, ?, ? WHERE ${parent}`,
            [...scope(ctx), value.version, json, ...parentScope(ctx)],
          )) === 1
        );
      } catch (error) {
        if (error instanceof InventoryError && error.code === 'CONFLICT')
          return false;
        throw new JsmError('UNAVAILABLE');
      }
    }
    return (
      (await this.db.write(
        `UPDATE jsm_configuration SET version = ?, configuration_json = ? WHERE installation_id = ? AND tenant_id = ? AND version = ? AND ${parent}`,
        [value.version, json, ...scope(ctx), expected, ...parentScope(ctx)],
      )) === 1
    );
  }
  private project(ctx: TenantContext, row: IntentRow): JsmIntent {
    bound(ctx, {
      installationId: row.installation_id,
      tenantId: row.tenant_id,
    });
    const config = configuration(ctx, JSON.parse(row.configuration_json));
    const request = object(JSON.parse(row.request_json));
    if (
      row.marker !== `light-house-${uuid(row.id)}` ||
      ![
        'prepared',
        'sending',
        'reconciling',
        'retry_wait',
        'ambiguous',
        'linked',
        'manual_review',
      ].includes(row.state) ||
      (row.reason !== null &&
        !['CONFIGURATION', 'RATE_LIMITED', 'AMBIGUOUS'].includes(row.reason))
    )
      throw new JsmError('INVALID');
    return {
      installationId: ctx.installationId,
      tenantId: ctx.tenantId,
      id: uuid(row.id),
      incidentId: uuid(row.incident_id),
      marker: text(row.marker, 48),
      configuration: config,
      request: safeRequest(config, row.marker, request),
      state: row.state,
      version: integer(row.version),
      attempts: integer(row.attempts, 3, 0),
      reconciliations: integer(row.reconciliations, 3, 0),
      dueAt: row.due_at === null ? null : utc(row.due_at),
      leaseUntil: row.lease_until === null ? null : utc(row.lease_until),
      issue:
        row.issue_id === null
          ? null
          : { id: identifier(row.issue_id), key: text(row.issue_key, 64) },
      reason: row.reason,
    };
  }
  async ensure(ctx: TenantContext, intent: JsmIntent): Promise<JsmIntent> {
    await this.ready(ctx);
    bound(ctx, intent);
    configuration(ctx, intent.configuration);
    uuid(intent.id);
    uuid(intent.incidentId);
    if (
      intent.marker !== `light-house-${intent.id}` ||
      intent.state !== 'prepared' ||
      intent.version !== 1 ||
      intent.attempts !== 0 ||
      intent.reconciliations !== 0 ||
      intent.issue ||
      intent.dueAt ||
      intent.leaseUntil ||
      intent.reason
    )
      throw new JsmError('INVALID');
    const request = JSON.stringify(
      safeRequest(intent.configuration, intent.marker, intent.request),
    );
    if (request.length > 8192) throw new JsmError('INVALID');
    try {
      await this.db.write(
        `INSERT INTO jsm_intents (installation_id, tenant_id, id, incident_id, marker, configuration_json, request_json, state, version, attempts, reconciliations, due_at, lease_token, lease_until, issue_id, issue_key, reason, audit_json) SELECT ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, ? FROM incidents WHERE installation_id = ? AND tenant_id = ? AND id = ? AND ${parent} `,
        [
          ...scope(ctx),
          intent.id,
          intent.incidentId,
          intent.marker,
          JSON.stringify(intent.configuration),
          request,
          'prepared',
          '[]',
          ...scope(ctx),
          intent.incidentId,
          ...parentScope(ctx),
        ],
      );
    } catch (error) {
      if (!(error instanceof InventoryError && error.code === 'CONFLICT'))
        throw new JsmError('UNAVAILABLE');
    }
    const rows = await this.db.rows<IntentRow>(
      'SELECT * FROM jsm_intents WHERE installation_id = ? AND tenant_id = ? AND incident_id = ?',
      [...scope(ctx), intent.incidentId],
    );
    if (!rows[0]) throw new JsmError('CONFLICT');
    return this.project(ctx, rows[0]);
  }
  async claim(
    ctx: TenantContext,
    id: string,
    expected: number,
    token: string,
    now: string,
    until: string,
    mode: 'create' | 'reconcile',
  ): Promise<JsmIntent | null> {
    await this.ready(ctx);
    uuid(id);
    uuid(token);
    integer(expected);
    utc(now);
    utc(until);
    if (until <= now || Date.parse(until) - Date.parse(now) > 60_000)
      throw new JsmError('INVALID');
    const create = mode === 'create';
    if (!create && mode !== 'reconcile') throw new JsmError('INVALID');
    const guard = create
      ? "state IN ('prepared', 'retry_wait') AND attempts < 3"
      : "(state IN ('sending', 'reconciling', 'ambiguous') OR (state = 'retry_wait' AND attempts >= 3)) AND reconciliations < 3";
    const count = await this.db.write(
      `UPDATE jsm_intents SET state = ?, version = version + 1, attempts = attempts + ?, reconciliations = reconciliations + ?, lease_token = ?, lease_until = ?, due_at = NULL WHERE installation_id = ? AND tenant_id = ? AND id = ? AND version = ? AND (lease_until IS NULL OR lease_until <= ?) AND (due_at IS NULL OR due_at <= ?) AND ${guard} AND ${parent}`,
      [
        create ? 'sending' : 'reconciling',
        create ? 1 : 0,
        create ? 0 : 1,
        token,
        until,
        ...scope(ctx),
        id,
        expected,
        now,
        now,
        ...parentScope(ctx),
      ],
    );
    if (count !== 1) return null;
    const rows = await this.db.rows<IntentRow>(
      'SELECT * FROM jsm_intents WHERE installation_id = ? AND tenant_id = ? AND id = ? AND lease_token = ?',
      [...scope(ctx), id, token],
    );
    return rows[0] ? this.project(ctx, rows[0]) : null;
  }
  async settle(
    ctx: TenantContext,
    id: string,
    token: string,
    result: Parameters<JsmRepository['settle']>[3],
  ): Promise<boolean> {
    await this.ready(ctx);
    uuid(id);
    uuid(token);
    const now = utc(this.now());
    if (result.state === 'linked') {
      if (!result.issue || result.reason || result.dueAt)
        throw new JsmError('INVALID');
      identifier(result.issue.id);
      if (!/^[A-Z][A-Z0-9_]{0,31}-[1-9][0-9]{0,19}$/.test(result.issue.key))
        throw new JsmError('INVALID');
    } else if (
      result.issue ||
      !result.reason ||
      !['retry_wait', 'ambiguous', 'manual_review'].includes(result.state)
    )
      throw new JsmError('INVALID');
    if (result.dueAt !== null) utc(result.dueAt);
    const rows = await this.db.rows<IntentRow>(
      'SELECT * FROM jsm_intents WHERE installation_id = ? AND tenant_id = ? AND id = ? AND lease_token = ? AND lease_until > ? AND state IN (?, ?)',
      [...scope(ctx), id, token, now, 'sending', 'reconciling'],
    );
    if (!rows[0]) return false;
    let prior: unknown;
    try {
      prior = JSON.parse(rows[0].audit_json);
    } catch {
      throw new JsmError('UNAVAILABLE');
    }
    if (!Array.isArray(prior) || prior.length > 16)
      throw new JsmError('UNAVAILABLE');
    const audit = JSON.stringify([
      ...prior.slice(-15),
      { at: now, state: result.state, version: rows[0].version + 1 },
    ]);
    if (audit.length > 4096) throw new JsmError('UNAVAILABLE');
    return (
      (await this.db.write(
        `UPDATE jsm_intents SET state = ?, version = version + 1, issue_id = ?, issue_key = ?, due_at = ?, reason = ?, audit_json = ?, lease_token = NULL, lease_until = NULL WHERE installation_id = ? AND tenant_id = ? AND id = ? AND version = ? AND lease_token = ? AND lease_until > ? AND state IN (?, ?) AND ${parent}`,
        [
          result.state,
          result.issue?.id ?? null,
          result.issue?.key ?? null,
          result.dueAt,
          result.reason,
          audit,
          ...scope(ctx),
          id,
          rows[0].version,
          token,
          now,
          'sending',
          'reconciling',
          ...parentScope(ctx),
        ],
      )) === 1
    );
  }
}
