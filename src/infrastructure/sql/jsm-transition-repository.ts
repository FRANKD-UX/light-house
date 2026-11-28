import type { TenantContext } from '../../application/ports/tenant-context';
import {
  TransitionError,
  type TransitionIntent,
  type TransitionPlan,
  type TransitionObservation,
  type TransitionRepository,
} from '../../application/jsm-transitions/contracts';
import { identifier } from '../../application/jsm/validation';
import {
  InventoryError,
  integer,
  object,
  text,
  utc,
  uuid,
  type Scalar,
} from '../../domain/inventory/model';
import type { SqlDriver } from './driver';
const states = [
  'prepared',
  'sending',
  'reconciling',
  'ambiguous',
  'observed',
  'manual_review',
];
const reasons = [
  'PERMISSION',
  'CONFIGURATION',
  'RATE_LIMITED',
  'AMBIGUOUS',
  'POSTCONDITION_UNAVAILABLE',
];
const responses = ['not-sent', 'accepted', 'unknown', 'rejected'];
const auditKinds = [
  'prepared',
  'claim_send',
  'claim_reconcile',
  'ambiguous',
  'observed',
  'manual_review',
];
const readyQuery =
  'SELECT x.ready FROM jsm_transition_schema_state x JOIN operations_schema_state o ON o.installation_id = x.installation_id JOIN jsm_schema_state j ON j.installation_id = x.installation_id JOIN incident_schema_state s ON s.installation_id = x.installation_id JOIN monitoring_schema_state m ON m.installation_id = x.installation_id JOIN installation_metadata i ON i.installation_id = x.installation_id WHERE x.installation_id = ? AND x.schema_version = 6 AND x.ready = 1 AND o.schema_version = 5 AND o.ready = 1 AND j.schema_version = 4 AND j.ready = 1 AND s.schema_version = 3 AND s.ready = 1 AND m.schema_version = 2 AND m.ready = 1 AND i.schema_version = 1 AND i.readiness = ? AND i.environment = ?';
const parent =
  'EXISTS (SELECT 1 FROM isp_tenants t WHERE t.installation_id = ? AND t.id = ? AND t.status = ? AND t.pending_mutation IS NULL)';
const actor =
  'EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id = ? AND m.account_id = ? AND m.status = ? AND m.role IN (?, ?) AND (m.expires_at IS NULL OR m.expires_at > ?))';
const scope = (ctx: TenantContext): Scalar[] => [
  ctx.installationId,
  ctx.tenantId,
];
function actorId(ctx: TenantContext): string {
  if (ctx.actor.kind !== 'atlassian-user') throw new TransitionError('DENIED');
  return text(ctx.actor.accountId, 128);
}
interface Row {
  installation_id: string;
  tenant_id: string;
  id: string;
  account_id: string;
  incident_id: string;
  operation: string;
  expected_version: number;
  plan_json: string;
  enforcement_review_id: string;
  state: string;
  version: number;
  attempts: number;
  reconciliations: number;
  lease_token: string | null;
  lease_until: string | null;
  reason: string | null;
  post_response: string;
  observation_json: string | null;
  audit_json: string;
  created_at: string;
  updated_at: string;
}
function json(input: unknown, max: number): string {
  const result = JSON.stringify(input);
  if (!result || Buffer.byteLength(result, 'utf8') > max)
    throw new TransitionError('INVALID');
  return result;
}
function plan(ctx: TenantContext, input: unknown): TransitionPlan {
  const v = object(input);
  if (
    v.installationId !== ctx.installationId ||
    v.tenantId !== ctx.tenantId ||
    v.accountId !== actorId(ctx)
  )
    throw new TransitionError('DENIED');
  if (v.operation !== 'resolve' && v.operation !== 'close')
    throw new TransitionError('INVALID');
  const value: TransitionPlan = {
    installationId: text(v.installationId, 255),
    tenantId: uuid(v.tenantId),
    accountId: text(v.accountId, 128),
    incidentId: uuid(v.incidentId),
    operation: v.operation,
    expectedVersion: integer(v.expectedVersion),
    factsVersion: integer(v.factsVersion),
    gateId: uuid(v.gateId),
    mappingVersion: integer(v.mappingVersion),
    issueId: identifier(v.issueId),
    projectId: identifier(v.projectId),
    transitionId: identifier(v.transitionId),
    fromStatusId: identifier(v.fromStatusId),
    targetStatusId: identifier(v.targetStatusId),
    resolutionId: v.resolutionId === null ? null : identifier(v.resolutionId),
  };
  if (value.fromStatusId === value.targetStatusId)
    throw new TransitionError('INVALID');
  return value;
}
function observation(
  expected: TransitionPlan,
  input: unknown,
  now: string,
  earliest: string,
): TransitionObservation {
  const v = object(input);
  if (
    v.issueId !== expected.issueId ||
    v.projectId !== expected.projectId ||
    v.causality !== 'postcondition-only'
  )
    throw new TransitionError('DENIED');
  const at = utc(v.observedAt);
  if (at > now || at < earliest) throw new TransitionError('INVALID');
  return {
    issueId: expected.issueId,
    projectId: expected.projectId,
    statusId: identifier(v.statusId),
    observedAt: at,
    causality: 'postcondition-only',
  };
}
function audit(raw: string): {
  at: string;
  kind: string;
  version: number;
  attempts: number;
  reconciliations: number;
}[] {
  const values: unknown = JSON.parse(raw);
  if (!Array.isArray(values) || values.length > 16)
    throw new TransitionError('INVALID');
  return values.map((item) => {
    const v = object(item);
    if (
      !auditKinds.includes(v.kind as string) ||
      Object.keys(v).some(
        (key) =>
          !['at', 'kind', 'version', 'attempts', 'reconciliations'].includes(
            key,
          ),
      )
    )
      throw new TransitionError('INVALID');
    return {
      at: utc(v.at),
      kind: v.kind as string,
      version: integer(v.version),
      attempts: integer(v.attempts, 1, 0),
      reconciliations: integer(v.reconciliations, 3, 0),
    };
  });
}
/** Unregistered SQL adapter. Observation remains postcondition-only; this class never creates a NativeConfirmation. */
export class SqlJsmTransitionRepository implements TransitionRepository {
  constructor(
    readonly db: SqlDriver,
    private readonly now: () => string,
  ) {}
  private guards(
    ctx: TenantContext,
    at: string,
  ): { query: string; params: Scalar[] } {
    return {
      query: `${parent} AND ${actor} AND EXISTS (${readyQuery})`,
      params: [
        ...scope(ctx),
        'active',
        ctx.tenantId,
        actorId(ctx),
        'active',
        'operator',
        'admin',
        at,
        ctx.installationId,
        'ready',
        'DEVELOPMENT',
      ],
    };
  }
  private async access(ctx: TenantContext): Promise<void> {
    text(ctx.installationId, 255);
    uuid(ctx.tenantId);
    const account = actorId(ctx),
      at = utc(this.now());
    const ready = await this.db.rows<{ ready: number }>(readyQuery, [
      ctx.installationId,
      'ready',
      'DEVELOPMENT',
    ]);
    if (ready.length !== 1 || ready[0]?.ready !== 1)
      throw new TransitionError('NOT_READY');
    const rows = await this.db.rows<{ id: string }>(
      `SELECT t.id FROM isp_tenants t WHERE t.installation_id = ? AND t.id = ? AND t.status = ? AND t.pending_mutation IS NULL AND ${actor}`,
      [
        ...scope(ctx),
        'active',
        ctx.tenantId,
        account,
        'active',
        'operator',
        'admin',
        at,
      ],
    );
    if (rows.length !== 1) throw new TransitionError('DENIED');
  }
  private project(ctx: TenantContext, row: Row): TransitionIntent {
    const mapped = plan(ctx, JSON.parse(row.plan_json));
    if (
      row.installation_id !== ctx.installationId ||
      row.tenant_id !== ctx.tenantId ||
      row.account_id !== actorId(ctx) ||
      mapped.incidentId !== row.incident_id ||
      mapped.operation !== row.operation ||
      mapped.expectedVersion !== row.expected_version
    )
      throw new TransitionError('DENIED');
    if (
      !states.includes(row.state) ||
      !responses.includes(row.post_response) ||
      (row.reason !== null && !reasons.includes(row.reason))
    )
      throw new TransitionError('INVALID');
    const value: TransitionIntent = {
      id: uuid(row.id),
      plan: mapped,
      enforcementReviewId: uuid(row.enforcement_review_id),
      state: row.state as TransitionIntent['state'],
      version: integer(row.version),
      attempts: integer(row.attempts, 1, 0),
      reconciliations: integer(row.reconciliations, 3, 0),
      leaseUntil: row.lease_until === null ? null : utc(row.lease_until),
      reason: row.reason as TransitionIntent['reason'],
      postResponse: row.post_response as TransitionIntent['postResponse'],
      observation:
        row.observation_json === null
          ? null
          : observation(
              mapped,
              JSON.parse(row.observation_json),
              utc(this.now()),
              utc(row.created_at),
            ),
    };
    utc(row.updated_at);
    audit(row.audit_json);
    if ((row.lease_token === null) !== (value.leaseUntil === null))
      throw new TransitionError('INVALID');
    if (row.lease_token !== null) uuid(row.lease_token);
    if (
      value.state === 'sending' || value.state === 'reconciling'
        ? value.attempts !== 1 || value.leaseUntil === null
        : value.leaseUntil !== null
    )
      throw new TransitionError('INVALID');
    if (
      value.state === 'prepared' &&
      (value.attempts !== 0 ||
        value.reconciliations !== 0 ||
        value.postResponse !== 'not-sent' ||
        value.reason !== null ||
        value.observation !== null)
    )
      throw new TransitionError('INVALID');
    if (
      value.state === 'observed'
        ? value.observation?.statusId !== mapped.targetStatusId ||
          value.reason !== null
        : value.observation !== null
    )
      throw new TransitionError('INVALID');
    return value;
  }
  private async byId(ctx: TenantContext, id: string): Promise<Row | null> {
    const rows = await this.db.rows<Row>(
      'SELECT * FROM jsm_transition_intents WHERE installation_id = ? AND tenant_id = ? AND id = ? AND account_id = ?',
      [...scope(ctx), uuid(id), actorId(ctx)],
    );
    return rows[0] ?? null;
  }
  async ensure(
    ctx: TenantContext,
    input: TransitionIntent,
  ): Promise<TransitionIntent> {
    await this.access(ctx);
    const mapped = plan(ctx, input.plan);
    uuid(input.id);
    uuid(input.enforcementReviewId);
    if (
      input.state !== 'prepared' ||
      input.version !== 1 ||
      input.attempts !== 0 ||
      input.reconciliations !== 0 ||
      input.leaseUntil !== null ||
      input.reason !== null ||
      input.postResponse !== 'not-sent' ||
      input.observation !== null
    )
      throw new TransitionError('INVALID');
    const find = async () =>
      (
        await this.db.rows<Row>(
          'SELECT * FROM jsm_transition_intents WHERE installation_id = ? AND tenant_id = ? AND incident_id = ? AND operation = ? AND expected_version = ?',
          [
            ...scope(ctx),
            mapped.incidentId,
            mapped.operation,
            mapped.expectedVersion,
          ],
        )
      )[0] ?? null;
    let winner = await find();
    if (!winner) {
      const at = utc(this.now()),
        guard = this.guards(ctx, at);
      try {
        await this.db.write(
          `INSERT INTO jsm_transition_intents (installation_id, tenant_id, id, account_id, incident_id, operation, expected_version, plan_json, enforcement_review_id, state, version, attempts, reconciliations, lease_token, lease_until, reason, post_response, observation_json, audit_json, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, NULL, NULL, NULL, ?, NULL, ?, ?, ? FROM incidents i WHERE i.installation_id = ? AND i.tenant_id = ? AND i.id = ? AND ${guard.query}`,
          [
            ...scope(ctx),
            input.id,
            actorId(ctx),
            mapped.incidentId,
            mapped.operation,
            mapped.expectedVersion,
            json(mapped, 4096),
            input.enforcementReviewId,
            'prepared',
            'not-sent',
            json(
              [
                {
                  at,
                  kind: 'prepared',
                  version: 1,
                  attempts: 0,
                  reconciliations: 0,
                },
              ],
              4096,
            ),
            at,
            at,
            ...scope(ctx),
            mapped.incidentId,
            ...guard.params,
          ],
        );
      } catch (error) {
        if (!(error instanceof InventoryError && error.code === 'CONFLICT'))
          throw error;
      }
      winner = await find();
    }
    if (!winner) throw new TransitionError('CONFLICT');
    const result = this.project(ctx, winner);
    if (
      json(result.plan, 4096) !== json(mapped, 4096) ||
      result.enforcementReviewId !== input.enforcementReviewId
    )
      throw new TransitionError('CONFLICT');
    return result;
  }
  async claim(
    ctx: TenantContext,
    id: string,
    expected: number,
    token: string,
    now: string,
    until: string,
    mode: 'send' | 'reconcile',
  ): Promise<TransitionIntent | null> {
    await this.access(ctx);
    uuid(token);
    integer(expected);
    utc(now);
    utc(until);
    let at = utc(this.now());
    if (
      now > at ||
      until <= at ||
      until <= now ||
      Date.parse(until) - Date.parse(now) > 60000 ||
      (mode !== 'send' && mode !== 'reconcile')
    )
      throw new TransitionError('INVALID');
    const row = await this.byId(ctx, id);
    if (!row) return null;
    const value = this.project(ctx, row);
    at = utc(this.now());
    if (now > at || until <= at) throw new TransitionError('INVALID');
    if (value.version !== expected) return null;
    const send = mode === 'send';
    if (
      send
        ? value.state !== 'prepared' ||
          value.attempts !== 0 ||
          value.reconciliations !== 0
        : !['sending', 'reconciling', 'ambiguous'].includes(value.state) ||
          value.attempts !== 1 ||
          value.reconciliations >= 3
    )
      return null;
    const state = send ? 'sending' : 'reconciling',
      nextAudit = json(
        [
          ...audit(row.audit_json).slice(-15),
          {
            at,
            kind: send ? 'claim_send' : 'claim_reconcile',
            version: expected + 1,
            attempts: value.attempts + (send ? 1 : 0),
            reconciliations: value.reconciliations + (send ? 0 : 1),
          },
        ],
        4096,
      ),
      guard = this.guards(ctx, at);
    const changed = await this.db.write(
      `UPDATE jsm_transition_intents SET state = ?, version = version + 1, attempts = attempts + ?, reconciliations = reconciliations + ?, lease_token = ?, lease_until = ?, audit_json = ?, updated_at = ? WHERE installation_id = ? AND tenant_id = ? AND id = ? AND account_id = ? AND version = ? AND updated_at <= ? AND (lease_until IS NULL OR lease_until <= ?) AND ${send ? "state = 'prepared' AND attempts = 0 AND reconciliations = 0" : "state IN ('sending', 'reconciling', 'ambiguous') AND attempts = 1 AND reconciliations < 3"} AND ${guard.query}`,
      [
        state,
        send ? 1 : 0,
        send ? 0 : 1,
        token,
        until,
        nextAudit,
        at,
        ...scope(ctx),
        id,
        actorId(ctx),
        expected,
        now,
        at,
        ...guard.params,
      ],
    );
    if (changed !== 1) return null;
    const saved = await this.byId(ctx, id);
    return saved && saved.lease_token === token
      ? this.project(ctx, saved)
      : null;
  }
  async settle(
    ctx: TenantContext,
    id: string,
    token: string,
    result: Parameters<TransitionRepository['settle']>[3],
  ): Promise<boolean> {
    await this.access(ctx);
    uuid(token);
    const row = await this.byId(ctx, id);
    if (!row) return false;
    const value = this.project(ctx, row);
    const at = utc(this.now());
    if (
      row.lease_token !== token ||
      value.leaseUntil === null ||
      value.leaseUntil <= at ||
      !['sending', 'reconciling'].includes(value.state) ||
      row.updated_at > at
    )
      return false;
    if (
      !['ambiguous', 'observed', 'manual_review'].includes(result.state) ||
      !responses.includes(result.postResponse) ||
      (result.reason !== null && !reasons.includes(result.reason))
    )
      throw new TransitionError('INVALID');
    const observed =
      result.observation === null
        ? null
        : observation(value.plan, result.observation, at, row.created_at);
    if (
      result.state === 'observed'
        ? observed?.statusId !== value.plan.targetStatusId ||
          result.reason !== null
        : observed !== null || result.reason === null
    )
      throw new TransitionError('INVALID');
    const guard = this.guards(ctx, at),
      nextAudit = json(
        [
          ...audit(row.audit_json).slice(-15),
          {
            at,
            kind: result.state,
            version: value.version + 1,
            attempts: value.attempts,
            reconciliations: value.reconciliations,
          },
        ],
        4096,
      );
    return (
      (await this.db.write(
        `UPDATE jsm_transition_intents SET state = ?, version = version + 1, reason = ?, post_response = ?, observation_json = ?, audit_json = ?, lease_token = NULL, lease_until = NULL, updated_at = ? WHERE installation_id = ? AND tenant_id = ? AND id = ? AND account_id = ? AND version = ? AND lease_token = ? AND lease_until > ? AND updated_at <= ? AND state IN (?, ?) AND ${guard.query}`,
        [
          result.state,
          result.reason,
          result.postResponse,
          observed === null ? null : json(observed, 1024),
          nextAudit,
          at,
          ...scope(ctx),
          id,
          actorId(ctx),
          value.version,
          token,
          at,
          at,
          'sending',
          'reconciling',
          ...guard.params,
        ],
      )) === 1
    );
  }
}
