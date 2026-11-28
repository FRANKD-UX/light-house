import type {
  IncidentInventoryPort,
  IncidentRepository,
} from '../../application/incidents/ports';
import type { TenantContext } from '../../application/ports/tenant-context';
import {
  IncidentError,
  type Incident,
  type IncidentEvidence,
  type IncidentInventory,
  type IncidentPolicy,
} from '../../domain/incidents/model';
import { validatePolicies } from '../../domain/incidents/sla';
import {
  definitions,
  object,
  text,
  uuid,
  type InventoryRecord,
  type Kind,
  type Scalar,
} from '../../domain/inventory/model';
import type { SqlDriver } from './driver';

function json(value: unknown, max = 60_000): string {
  const result = JSON.stringify(value);
  if (!result || Buffer.byteLength(result, 'utf8') > max)
    throw new IncidentError('INVALID');
  return result;
}
function snapshot(ctx: TenantContext, raw: string): Incident {
  const v = object(JSON.parse(raw));
  if (v.installationId !== ctx.installationId || v.tenantId !== ctx.tenantId)
    throw new IncidentError('DENIED');
  uuid(v.id);
  uuid(v.sourceId);
  uuid(v.correlationId);
  if (!['new', 'manual_triage'].includes(v.state as string))
    throw new IncidentError('INVALID');
  return v as unknown as Incident;
}
export class SqlIncidentRepository implements IncidentRepository {
  constructor(readonly db: SqlDriver) {}
  async ready(installationId: string): Promise<boolean> {
    try {
      const rows = await this.db.rows<{
        ready: number;
        schema_version: number;
      }>(
        'SELECT s.ready, s.schema_version FROM incident_schema_state s JOIN monitoring_schema_state m ON m.installation_id = s.installation_id JOIN installation_metadata i ON i.installation_id = s.installation_id WHERE s.installation_id = ? AND m.ready = 1 AND m.schema_version = 2 AND i.readiness = ? AND i.schema_version = 1 AND i.environment = ?',
        [installationId, 'ready', 'DEVELOPMENT'],
      );
      return rows[0]?.ready === 1 && rows[0].schema_version === 3;
    } catch {
      return false;
    }
  }
  async bound(ctx: TenantContext): Promise<void> {
    text(ctx.installationId, 255);
    uuid(ctx.tenantId);
    const rows = await this.db.rows<{ pending_mutation: string | null }>(
      'SELECT pending_mutation FROM isp_tenants WHERE installation_id = ? AND id = ? AND status = ?',
      [ctx.installationId, ctx.tenantId, 'active'],
    );
    if (rows.length !== 1) throw new IncidentError('DENIED');
    if (rows[0]!.pending_mutation !== null)
      throw new IncidentError('NOT_READY');
  }
  async inbox(
    ctx: TenantContext,
    id: string,
  ): Promise<IncidentEvidence | null> {
    await this.bound(ctx);
    const rows = await this.db.rows<{
      id: string;
      source_id: string;
      correlation_id: string;
      received_at: string;
      uplink_id: string;
      site_id: string;
      event_json: string;
    }>(
      'SELECT b.id, b.source_id, b.correlation_id, b.received_at, b.uplink_id, b.site_id, b.event_json FROM monitoring_inbox b JOIN monitoring_sources s ON s.tenant_id = b.tenant_id AND s.id = b.source_id AND s.installation_id = b.installation_id WHERE b.installation_id = ? AND b.tenant_id = ? AND b.id = ? AND b.status = ? AND s.status = ?',
      [ctx.installationId, ctx.tenantId, uuid(id), 'ready', 'active'],
    );
    const row = rows[0];
    if (!row || !row.uplink_id || !row.site_id) return null;
    const event = object(JSON.parse(row.event_json));
    if (
      event.kind !== 'problem' &&
      event.kind !== 'recovery' &&
      event.kind !== 'update'
    )
      throw new IncidentError('INVALID');
    return {
      inboxId: row.id,
      sourceId: row.source_id,
      correlationId: row.correlation_id,
      receivedAt: row.received_at,
      uplinkId: row.uplink_id,
      siteId: row.site_id,
      event: {
        externalEventId: text(event.externalEventId, 64),
        problemEventId: text(event.problemEventId, 64),
        resourceId: text(event.resourceId, 128),
        kind: event.kind,
        occurredAt: text(event.occurredAt, 24),
        severity: text(event.severity, 32),
      },
    };
  }
  async recordEvidence(
    ctx: TenantContext,
    evidence: IncidentEvidence,
  ): Promise<void> {
    await this.bound(ctx);
    const trusted = await this.inbox(ctx, evidence.inboxId);
    if (!trusted || json(trusted) !== json(evidence))
      throw new IncidentError('DENIED');
    await this.db.write(
      'INSERT INTO incident_evidence (installation_id, tenant_id, id, source_id, problem_event_id, external_event_id, kind, evidence_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
      [
        ctx.installationId,
        ctx.tenantId,
        evidence.inboxId,
        evidence.sourceId,
        evidence.event.problemEventId,
        evidence.event.externalEventId,
        evidence.event.kind,
        json(evidence, 4096),
      ],
    );
    const saved = await this.db.rows<{ evidence_json: string }>(
      'SELECT evidence_json FROM incident_evidence WHERE installation_id = ? AND tenant_id = ? AND source_id = ? AND external_event_id = ? AND kind = ?',
      [
        ctx.installationId,
        ctx.tenantId,
        evidence.sourceId,
        evidence.event.externalEventId,
        evidence.event.kind,
      ],
    );
    if (!saved[0] || saved[0].evidence_json !== json(evidence, 4096))
      throw new IncidentError('CONFLICT');
  }
  async find(
    ctx: TenantContext,
    sourceId: string,
    problemEventId: string,
  ): Promise<Incident | null> {
    await this.bound(ctx);
    const rows = await this.db.rows<{ snapshot_json: string }>(
      'SELECT snapshot_json FROM incidents WHERE installation_id = ? AND tenant_id = ? AND source_id = ? AND problem_event_id = ?',
      [
        ctx.installationId,
        ctx.tenantId,
        uuid(sourceId),
        text(problemEventId, 64),
      ],
    );
    return rows[0] ? snapshot(ctx, rows[0].snapshot_json) : null;
  }
  async createIfAbsent(
    ctx: TenantContext,
    incident: Incident,
  ): Promise<Incident> {
    await this.bound(ctx);
    snapshot(ctx, json(incident));
    try {
      await this.db.write(
        'INSERT INTO incidents (installation_id, tenant_id, id, source_id, problem_event_id, occurred_at, created_at, state, version, snapshot_json) SELECT ?, ?, ?, s.id, ?, ?, ?, ?, ?, ? FROM monitoring_sources s JOIN isp_tenants t ON t.id = s.tenant_id AND t.installation_id = s.installation_id WHERE s.installation_id = ? AND s.tenant_id = ? AND s.id = ? AND s.status = ? AND t.status = ? AND t.pending_mutation IS NULL',
        [
          ctx.installationId,
          ctx.tenantId,
          incident.id,
          incident.problemEventId,
          incident.occurredAt,
          incident.createdAt,
          incident.state,
          incident.version,
          json(incident),
          ctx.installationId,
          ctx.tenantId,
          incident.sourceId,
          'active',
          'active',
        ],
      );
    } catch (error) {
      if (!(
        error instanceof Error &&
        'code' in error &&
        error.code === 'CONFLICT'
      ))
        throw error;
    }
    const saved = await this.find(
      ctx,
      incident.sourceId,
      incident.problemEventId,
    );
    if (!saved) throw new IncidentError('NOT_READY');
    return saved;
  }
  async evidence(
    ctx: TenantContext,
    sourceId: string,
    problemEventId: string,
  ): Promise<IncidentEvidence[]> {
    await this.bound(ctx);
    const rows = await this.db.rows<{ evidence_json: string }>(
      'SELECT evidence_json FROM incident_evidence WHERE installation_id = ? AND tenant_id = ? AND source_id = ? AND problem_event_id = ? ORDER BY id LIMIT 1001',
      [
        ctx.installationId,
        ctx.tenantId,
        uuid(sourceId),
        text(problemEventId, 64),
      ],
    );
    if (rows.length > 1000) throw new IncidentError('NOT_READY');
    return rows.map((r) => JSON.parse(r.evidence_json) as IncidentEvidence);
  }
  async list(ctx: TenantContext, after = ''): Promise<Incident[]> {
    await this.bound(ctx);
    if (after) uuid(after);
    const rows = await this.db.rows<{ snapshot_json: string }>(
      'SELECT snapshot_json FROM incidents WHERE installation_id = ? AND tenant_id = ? AND id > ? ORDER BY id LIMIT 21',
      [ctx.installationId, ctx.tenantId, after],
    );
    return rows.map((r) => snapshot(ctx, r.snapshot_json));
  }
  async readyInbox(ctx: TenantContext, after = ''): Promise<{ id: string }[]> {
    await this.bound(ctx);
    if (after) uuid(after);
    return this.db.rows<{ id: string }>(
      'SELECT b.id FROM monitoring_inbox b JOIN monitoring_sources s ON s.id = b.source_id AND s.tenant_id = b.tenant_id AND s.installation_id = b.installation_id JOIN isp_tenants t ON t.id = b.tenant_id AND t.installation_id = b.installation_id WHERE b.installation_id = ? AND b.tenant_id = ? AND b.status = ? AND b.id > ? AND s.status = ? AND t.status = ? AND t.pending_mutation IS NULL ORDER BY b.id LIMIT 21',
      [ctx.installationId, ctx.tenantId, 'ready', after, 'active', 'active'],
    );
  }
  async policies(ctx: TenantContext): Promise<IncidentPolicy[]> {
    await this.bound(ctx);
    const rows = await this.db.rows<{ policies_json: string }>(
      'SELECT policies_json FROM incident_policies WHERE installation_id = ? AND tenant_id = ? ORDER BY tier_id LIMIT 101',
      [ctx.installationId, ctx.tenantId],
    );
    if (rows.length > 100) throw new IncidentError('NOT_READY');
    const values: IncidentPolicy[] = rows.flatMap(
      (r) => JSON.parse(r.policies_json) as IncidentPolicy[],
    );
    validatePolicies(ctx.tenantId, values);
    return values;
  }
  /** Single-row timeline CAS: no separate publication pointer/partial-write gap. */
  async publishPolicy(
    ctx: TenantContext,
    policy: IncidentPolicy,
    expected: number,
  ): Promise<boolean> {
    await this.bound(ctx);
    validatePolicies(ctx.tenantId, [policy]);
    if (!Number.isSafeInteger(expected) || expected < 0)
      throw new IncidentError('INVALID');
    const tier = await this.db.rows<{ id: string }>(
      'SELECT id FROM sla_tiers WHERE tenant_id = ? AND id = ? AND status = ? AND pending IS NULL',
      [ctx.tenantId, policy.tierId, 'active'],
    );
    if (tier.length !== 1) throw new IncidentError('DENIED');
    const rows = await this.db.rows<{ version: number; policies_json: string }>(
      'SELECT version, policies_json FROM incident_policies WHERE installation_id = ? AND tenant_id = ? AND tier_id = ?',
      [ctx.installationId, ctx.tenantId, policy.tierId],
    );
    const prior = rows[0];
    if ((prior?.version ?? 0) !== expected) return false;
    if (policy.version !== expected + 1) throw new IncidentError('CONFLICT');
    const policies = [
      ...(prior ? (JSON.parse(prior.policies_json) as IncidentPolicy[]) : []),
      policy,
    ];
    validatePolicies(ctx.tenantId, policies);
    if (!prior) {
      try {
        return (
          (await this.db.write(
            'INSERT INTO incident_policies (installation_id, tenant_id, tier_id, version, policies_json) SELECT ?, ?, tier.id, 1, ? FROM sla_tiers tier JOIN isp_tenants t ON t.id = tier.tenant_id WHERE t.installation_id = ? AND t.id = ? AND t.status = ? AND t.pending_mutation IS NULL AND tier.id = ? AND tier.status = ? AND tier.pending IS NULL',
            [
              ctx.installationId,
              ctx.tenantId,
              json(policies),
              ctx.installationId,
              ctx.tenantId,
              'active',
              policy.tierId,
              'active',
            ],
          )) === 1
        );
      } catch (error) {
        if (
          error instanceof Error &&
          'code' in error &&
          error.code === 'CONFLICT'
        )
          return false;
        throw error;
      }
    }
    return (
      (await this.db.write(
        'UPDATE incident_policies SET version = version + 1, policies_json = ? WHERE installation_id = ? AND tenant_id = ? AND tier_id = ? AND version = ? AND EXISTS (SELECT 1 FROM sla_tiers tier JOIN isp_tenants t ON t.id = tier.tenant_id WHERE t.installation_id = ? AND t.id = ? AND t.status = ? AND t.pending_mutation IS NULL AND tier.id = ? AND tier.status = ? AND tier.pending IS NULL)',
        [
          json(policies),
          ctx.installationId,
          ctx.tenantId,
          policy.tierId,
          expected,
          ctx.installationId,
          ctx.tenantId,
          'active',
          policy.tierId,
          'active',
        ],
      )) === 1
    );
  }
}
const inventoryKinds = {
  sites: 'sites',
  carriers: 'carriers',
  uplinks: 'uplinks',
  customers: 'customers',
  services: 'customer_services',
  dependencies: 'service_dependencies',
  tiers: 'sla_tiers',
} as const;
export class SqlIncidentInventory implements IncidentInventoryPort {
  constructor(private readonly repository: SqlIncidentRepository) {}
  async load(ctx: TenantContext, uplinkId: string): Promise<IncidentInventory> {
    uuid(uplinkId);
    await this.repository.bound(ctx);
    const params: Scalar[] = [];
    const selects = Object.entries(inventoryKinds).map(([label, kind]) => {
      // Every identifier comes from a closed application-owned registry, never client input.
      const fields = Object.keys(definitions[kind as Kind].fields)
        .flatMap((key) => [`'${key}'`, `r.${key}`])
        .join(', ');
      params.push(ctx.installationId, ctx.tenantId, 'active');
      return `SELECT '${label}' AS kind, JSON_OBJECT('id', r.id, 'tenant_id', r.tenant_id, 'status', r.status, 'version', r.version, 'created_at', r.created_at, 'updated_at', r.updated_at, 'fixture_key', r.fixture_key, 'pending', r.pending, 'fields', JSON_OBJECT(${fields})) AS record_json FROM ${kind} r JOIN isp_tenants t ON t.id = r.tenant_id WHERE t.installation_id = ? AND r.tenant_id = ? AND t.status = ? AND t.pending_mutation IS NULL`;
    });
    const rows = await this.repository.db.rows<{
      kind: keyof typeof inventoryKinds;
      record_json: unknown;
    }>(selects.join(' UNION ALL ') + ' LIMIT 1001', params);
    if (rows.length > 1000) throw new IncidentError('NOT_READY');
    const result: Record<keyof typeof inventoryKinds, InventoryRecord[]> = {
      sites: [],
      carriers: [],
      uplinks: [],
      customers: [],
      services: [],
      dependencies: [],
      tiers: [],
    };
    for (const row of rows) {
      if (!Object.hasOwn(result, row.kind)) throw new IncidentError('INVALID');
      const value = object(
        typeof row.record_json === 'string'
          ? JSON.parse(row.record_json)
          : row.record_json,
      );
      if (value.tenant_id !== ctx.tenantId) throw new IncidentError('DENIED');
      result[row.kind].push(value as unknown as InventoryRecord);
    }
    return { ...result, availability: [] };
  }
  policies(ctx: TenantContext) {
    return this.repository.policies(ctx);
  }
}
