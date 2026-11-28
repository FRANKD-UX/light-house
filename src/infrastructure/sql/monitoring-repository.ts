import type { MonitoringRepository } from '../../application/monitoring/ports';
import type { TenantContext } from '../../application/ports/tenant-context';
import type {
  CredentialReference,
  InboxRecord,
  MonitoringSource,
  MonitoringObservation,
  ResourceMapping,
  SourceCredential,
  InboxState,
  TriageReason,
} from '../../domain/monitoring/model';
import { InventoryError } from '../../domain/inventory/model';
import type { SqlDriver } from './driver';
export class SqlMonitoringRepository implements MonitoringRepository {
  constructor(readonly db: SqlDriver) {}
  async observe(ctx: TenantContext, o: MonitoringObservation) {
    await this.db.write(
      'INSERT INTO monitoring_observations (tenant_id, installation_id, correlation_id, source_id, received_at, result) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE correlation_id = correlation_id',
      [
        ctx.tenantId,
        ctx.installationId,
        o.correlationId,
        o.sourceId,
        o.receivedAt,
        o.result,
      ],
    );
  }
  async observations(ctx: TenantContext) {
    return this.db.rows<MonitoringObservation>(
      'SELECT correlation_id AS correlationId, source_id AS sourceId, received_at AS receivedAt, result FROM monitoring_observations WHERE installation_id = ? AND tenant_id = ? ORDER BY received_at DESC, correlation_id DESC LIMIT 20',
      [ctx.installationId, ctx.tenantId],
    );
  }
  async duplicate(ctx: TenantContext, id: string) {
    await this.db.write(
      'UPDATE monitoring_inbox SET duplicate_count = duplicate_count + 1 WHERE installation_id = ? AND tenant_id = ? AND id = ?',
      [ctx.installationId, ctx.tenantId, id],
    );
  }
  async recoverable(ctx: TenantContext, now: string) {
    return this.db.rows<{ id: string }>(
      'SELECT id FROM monitoring_inbox WHERE installation_id = ? AND tenant_id = ? AND status IN (?, ?, ?, ?) AND (lease_until IS NULL OR lease_until <= ?) ORDER BY updated_at, id LIMIT 20',
      [
        ctx.installationId,
        ctx.tenantId,
        'received',
        'queued',
        'retry_required',
        'processing',
        now,
      ],
    );
  }
  async staleCredentials(ctx: TenantContext, now: string) {
    return this.db.rows<CredentialReference>(
      'SELECT c.* FROM monitoring_credentials c LEFT JOIN monitoring_sources s ON s.installation_id = c.installation_id AND s.tenant_id = c.tenant_id AND s.id = c.source_id WHERE c.installation_id = ? AND c.tenant_id = ? AND (s.status = ? OR (c.created_at <= ? AND (s.id IS NULL OR (c.id <> s.current_key_id AND (s.previous_key_id IS NULL OR c.id <> s.previous_key_id OR s.previous_until <= ?))))) ORDER BY c.id LIMIT 20',
      [
        ctx.installationId,
        ctx.tenantId,
        'disabled',
        new Date(Date.parse(now) - 3_600_000).toISOString(),
        now,
      ],
    );
  }
  async removeReference(ctx: TenantContext, id: string) {
    await this.db.write(
      'DELETE FROM monitoring_credentials WHERE installation_id = ? AND tenant_id = ? AND id = ?',
      [ctx.installationId, ctx.tenantId, id],
    );
  }
  async ready(installationId: string) {
    try {
      const rows = await this.db.rows<{
        ready: number;
        schema_version: number;
      }>(
        'SELECT m.ready, m.schema_version FROM monitoring_schema_state m JOIN installation_metadata i ON i.installation_id = m.installation_id WHERE m.installation_id = ? AND i.readiness = ? AND i.schema_version = 1 AND i.environment = ?',
        [installationId, 'ready', 'DEVELOPMENT'],
      );
      return (
        rows.length === 1 &&
        rows[0]!.ready === 1 &&
        rows[0]!.schema_version === 2
      );
    } catch {
      return false;
    }
  }
  async sources(ctx: TenantContext, after = '') {
    return this.db.rows<MonitoringSource>(
      'SELECT * FROM monitoring_sources WHERE installation_id = ? AND tenant_id = ? AND id > ? ORDER BY id LIMIT 51',
      [ctx.installationId, ctx.tenantId, after],
    );
  }
  async source(ctx: TenantContext, id: string) {
    const rows = await this.db.rows<MonitoringSource>(
      "SELECT s.* FROM monitoring_sources s JOIN isp_tenants t ON t.id = s.tenant_id AND t.installation_id = s.installation_id WHERE s.installation_id = ? AND s.tenant_id = ? AND s.id = ? AND t.status = 'active'",
      [ctx.installationId, ctx.tenantId, id],
    );
    return rows[0] ?? null;
  }
  async createSource(ctx: TenantContext, s: MonitoringSource) {
    await this.db.write(
      'INSERT INTO monitoring_sources (tenant_id, id, installation_id, name, source_type, status, version, current_key_id, previous_key_id, previous_until, rate_bucket, rate_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0)',
      [
        ctx.tenantId,
        s.id,
        ctx.installationId,
        s.name,
        s.source_type,
        s.status,
        s.version,
        s.current_key_id,
      ],
    );
  }
  async credential(r: CredentialReference) {
    await this.db.write(
      'INSERT INTO monitoring_credentials (tenant_id, id, installation_id, source_id, secret_ref, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        r.tenant_id,
        r.id,
        r.installation_id,
        r.source_id,
        r.secret_ref,
        r.created_at,
      ],
    );
  }
  async lookupCredential(
    installationId: string,
    keyId: string,
    now: string,
  ): Promise<SourceCredential | null> {
    const rows = await this.db.rows<CredentialReference>(
      'SELECT c.* FROM monitoring_credentials c JOIN monitoring_sources s ON s.tenant_id = c.tenant_id AND s.id = c.source_id AND s.installation_id = c.installation_id JOIN isp_tenants t ON t.id = s.tenant_id AND t.installation_id = s.installation_id WHERE c.installation_id = ? AND c.id = ? AND s.status = ? AND t.status = ? AND (s.current_key_id = c.id OR (s.previous_key_id = c.id AND s.previous_until > ?))',
      [installationId, keyId, 'active', 'active', now],
    );
    if (rows.length !== 1) return null;
    const r = rows[0]!;
    const ctx: TenantContext = {
      installationId,
      tenantId: r.tenant_id,
      actor: { kind: 'monitoring-source', sourceId: r.source_id },
    };
    const source = await this.source(ctx, r.source_id);
    return source ? { ...r, source } : null;
  }
  async rotate(
    ctx: TenantContext,
    id: string,
    expected: number,
    keyId: string,
    until: string,
    now: string,
  ) {
    return (
      (await this.db.write(
        'UPDATE monitoring_sources SET previous_key_id = current_key_id, previous_until = ?, current_key_id = ?, version = version + 1 WHERE installation_id = ? AND tenant_id = ? AND id = ? AND version = ? AND status = ? AND (previous_until IS NULL OR previous_until <= ?)',
        [
          until,
          keyId,
          ctx.installationId,
          ctx.tenantId,
          id,
          expected,
          'active',
          now,
        ],
      )) === 1
    );
  }
  async disable(ctx: TenantContext, id: string, expected: number) {
    return (
      (await this.db.write(
        'UPDATE monitoring_sources SET status = ?, version = version + 1 WHERE installation_id = ? AND tenant_id = ? AND id = ? AND version = ?',
        ['disabled', ctx.installationId, ctx.tenantId, id, expected],
      )) === 1
    );
  }
  async references(ctx: TenantContext, sourceId: string) {
    return this.db.rows<CredentialReference>(
      'SELECT * FROM monitoring_credentials WHERE installation_id = ? AND tenant_id = ? AND source_id = ? ORDER BY id LIMIT 101',
      [ctx.installationId, ctx.tenantId, sourceId],
    );
  }
  async admit(
    ctx: TenantContext,
    sourceId: string,
    keyId: string,
    now: string,
  ) {
    const bucket = now.slice(0, 16);
    return (
      (await this.db.write(
        'UPDATE monitoring_sources SET rate_count = CASE WHEN rate_bucket = ? THEN rate_count + 1 ELSE 1 END, rate_bucket = ? WHERE installation_id = ? AND tenant_id = ? AND id = ? AND status = ? AND (current_key_id = ? OR (previous_key_id = ? AND previous_until > ?)) AND (rate_bucket IS NULL OR rate_bucket <> ? OR rate_count < 60)',
        [
          bucket,
          bucket,
          ctx.installationId,
          ctx.tenantId,
          sourceId,
          'active',
          keyId,
          keyId,
          now,
          bucket,
        ],
      )) === 1
    );
  }
  async putInbox(ctx: TenantContext, r: InboxRecord) {
    await this.db.write(
      'INSERT INTO monitoring_inbox (tenant_id, id, installation_id, source_id, correlation_id, duplicate_count, dedupe_key, fingerprint, event_json, status, reason, received_at, updated_at, attempts, dispatches, version, lease_token, lease_until, uplink_id, site_id) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1, NULL, NULL, NULL, NULL) ON DUPLICATE KEY UPDATE id = id',
      [
        ctx.tenantId,
        r.id,
        ctx.installationId,
        r.source_id,
        r.correlation_id,
        r.dedupe_key,
        r.fingerprint,
        r.event_json,
        r.status,
        r.reason,
        r.received_at,
        r.updated_at,
      ],
    );
    const rows = await this.db.rows<InboxRecord>(
      'SELECT * FROM monitoring_inbox WHERE installation_id = ? AND tenant_id = ? AND source_id = ? AND dedupe_key = ?',
      [ctx.installationId, ctx.tenantId, r.source_id, r.dedupe_key],
    );
    if (rows.length !== 1) throw new InventoryError('UNAVAILABLE');
    return rows[0]!;
  }
  async inbox(ctx: TenantContext, id: string) {
    const rows = await this.db.rows<InboxRecord>(
      'SELECT * FROM monitoring_inbox WHERE installation_id = ? AND tenant_id = ? AND id = ?',
      [ctx.installationId, ctx.tenantId, id],
    );
    return rows[0] ?? null;
  }
  async listInbox(ctx: TenantContext, after: string) {
    return this.db.rows<InboxRecord>(
      'SELECT * FROM monitoring_inbox WHERE installation_id = ? AND tenant_id = ? AND id > ? ORDER BY id LIMIT 21',
      [ctx.installationId, ctx.tenantId, after],
    );
  }
  private async exhausted(ctx: TenantContext, id: string, now: string) {
    await this.db.write(
      'UPDATE monitoring_inbox SET status = ?, reason = ?, lease_token = NULL, lease_until = NULL, version = version + 1, updated_at = ? WHERE installation_id = ? AND tenant_id = ? AND id = ? AND (attempts >= 5 OR dispatches >= 5) AND status NOT IN (?, ?) AND (lease_until IS NULL OR lease_until <= ?)',
      [
        'manual_triage',
        'RETRY_EXHAUSTED',
        now,
        ctx.installationId,
        ctx.tenantId,
        id,
        'ready',
        'manual_triage',
        now,
      ],
    );
  }
  async reserveDispatch(ctx: TenantContext, id: string, now: string) {
    await this.exhausted(ctx, id, now);
    return (
      (await this.db.write(
        'UPDATE monitoring_inbox SET status = ?, reason = ?, dispatches = dispatches + 1, lease_until = ?, version = version + 1, updated_at = ? WHERE installation_id = ? AND tenant_id = ? AND id = ? AND dispatches < 5 AND attempts < 5 AND status IN (?, ?, ?, ?, ?) AND (lease_until IS NULL OR lease_until <= ?)',
        [
          'received',
          'DISPATCH_PENDING',
          new Date(Date.parse(now) + 60_000).toISOString(),
          now,
          ctx.installationId,
          ctx.tenantId,
          id,
          'received',
          'queued',
          'retry_required',
          'manual_triage',
          'processing',
          now,
        ],
      )) === 1
    );
  }
  async markQueued(ctx: TenantContext, id: string, now: string) {
    await this.db.write(
      'UPDATE monitoring_inbox SET status = ?, reason = NULL, version = version + 1, updated_at = ? WHERE installation_id = ? AND tenant_id = ? AND id = ? AND status = ?',
      ['queued', now, ctx.installationId, ctx.tenantId, id, 'received'],
    );
  }
  async claim(
    ctx: TenantContext,
    id: string,
    token: string,
    now: string,
    until: string,
  ) {
    await this.exhausted(ctx, id, now);
    return (
      (await this.db.write(
        'UPDATE monitoring_inbox SET status = ?, lease_token = ?, lease_until = ?, attempts = attempts + 1, version = version + 1, updated_at = ? WHERE installation_id = ? AND tenant_id = ? AND id = ? AND attempts < 5 AND (status IN (?, ?, ?) OR (status = ? AND lease_until <= ?))',
        [
          'processing',
          token,
          until,
          now,
          ctx.installationId,
          ctx.tenantId,
          id,
          'received',
          'queued',
          'retry_required',
          'processing',
          now,
        ],
      )) === 1
    );
  }
  async finish(
    ctx: TenantContext,
    id: string,
    token: string,
    state: InboxState,
    reason: TriageReason,
    uplinkId: string | null,
    siteId: string | null,
    now: string,
  ) {
    return (
      (await this.db.write(
        'UPDATE monitoring_inbox SET status = ?, reason = ?, uplink_id = ?, site_id = ?, lease_token = NULL, lease_until = NULL, updated_at = ?, version = version + 1 WHERE installation_id = ? AND tenant_id = ? AND id = ? AND lease_token = ? AND status = ?',
        [
          state,
          reason,
          uplinkId,
          siteId,
          now,
          ctx.installationId,
          ctx.tenantId,
          id,
          token,
          'processing',
        ],
      )) === 1
    );
  }
  async mappings(ctx: TenantContext, sourceId: string) {
    return this.db.rows<ResourceMapping>(
      'SELECT m.* FROM monitoring_resource_mappings m JOIN monitoring_sources s ON s.tenant_id = m.tenant_id AND s.id = m.source_id WHERE s.installation_id = ? AND m.tenant_id = ? AND m.source_id = ? ORDER BY m.id LIMIT 101',
      [ctx.installationId, ctx.tenantId, sourceId],
    );
  }
  async map(ctx: TenantContext, m: ResourceMapping) {
    const changed = await this.db.write(
      'INSERT INTO monitoring_resource_mappings (tenant_id, id, source_id, external_resource_id, uplink_id, version) SELECT ?, ?, ?, ?, u.id, ? FROM uplinks u JOIN sites s ON s.tenant_id = u.tenant_id AND s.id = u.site_id JOIN isp_tenants t ON t.id = u.tenant_id JOIN monitoring_sources m ON m.tenant_id = u.tenant_id AND m.id = ? AND m.installation_id = t.installation_id WHERE t.installation_id = ? AND u.tenant_id = ? AND u.id = ? AND u.status <> ? AND s.status = ? AND t.status = ? AND m.status = ? AND u.pending IS NULL AND s.pending IS NULL',
      [
        ctx.tenantId,
        m.id,
        m.source_id,
        m.external_resource_id,
        m.version,
        m.source_id,
        ctx.installationId,
        ctx.tenantId,
        m.uplink_id,
        'retired',
        'active',
        'active',
        'active',
      ],
    );
    if (changed !== 1) throw new InventoryError('INVALID');
  }

  async resolve(ctx: TenantContext, sourceId: string, resourceId: string) {
    const rows = await this.db.rows<{
      uplink_id: string;
      site_id: string | null;
      uplink_status: string | null;
      site_status: string | null;
      uplink_pending: string | null;
      site_pending: string | null;
    }>(
      'SELECT m.uplink_id, u.site_id, u.status AS uplink_status, s.status AS site_status, u.pending AS uplink_pending, s.pending AS site_pending FROM monitoring_resource_mappings m JOIN monitoring_sources ms ON ms.tenant_id = m.tenant_id AND ms.id = m.source_id LEFT JOIN uplinks u ON u.tenant_id = m.tenant_id AND u.id = m.uplink_id LEFT JOIN sites s ON s.tenant_id = u.tenant_id AND s.id = u.site_id WHERE ms.installation_id = ? AND m.tenant_id = ? AND m.source_id = ? AND m.external_resource_id = ?',
      [ctx.installationId, ctx.tenantId, sourceId, resourceId],
    );
    if (rows.length !== 1) return null;
    const r = rows[0]!;
    if (
      !r.site_id ||
      !r.uplink_status ||
      r.uplink_status === 'retired' ||
      r.site_status !== 'active' ||
      r.uplink_pending ||
      r.site_pending
    )
      return 'inactive' as const;
    return { uplinkId: r.uplink_id, siteId: r.site_id };
  }
}
