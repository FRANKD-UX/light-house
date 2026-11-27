import {
  noInventoryDiagnostics,
  type InventoryDiagnostics,
} from '../../application/ports/inventory-diagnostics';
import type {
  AccessRepository,
  Membership,
  Session,
} from '../../application/inventory/ports';
import type { TenantContext } from '../../application/ports/tenant-context';
import { InventoryError, role, type Role } from '../../domain/inventory/model';
import type { SqlDriver } from './driver';
export class SqlAccessRepository implements AccessRepository {
  constructor(
    private readonly db: SqlDriver,
    private readonly id: () => string,
    private readonly now: () => string,
    private readonly diagnostic: InventoryDiagnostics = noInventoryDiagnostics,
  ) {}
  async schemaStatus(session: Session) {
    try {
      const rows = await this.diagnostic.run('schema.sql', () =>
        this.db.rows<{
          readiness: string;
          schema_version: number;
        }>(
          'SELECT readiness, schema_version FROM installation_metadata WHERE installation_id = ? AND environment = ?',
          [session.installationId, session.environment],
        ),
      );
      return rows[0] &&
        ['ready', 'provisioning', 'failed'].includes(rows[0].readiness) &&
        (rows[0].readiness !== 'ready' || rows[0].schema_version === 1)
        ? rows[0].readiness
        : 'unavailable';
    } catch {
      return 'unavailable';
    }
  }
  async configureTenant(
    ctx: TenantContext,
    name: string,
    status: string,
    expected: number,
    intent: string,
  ) {
    return (
      (await this.db.write(
        'UPDATE isp_tenants SET name = ?, status = ?, version = version + 1, updated_at = ?, pending_mutation = NULL WHERE installation_id = ? AND id = ? AND version = ? AND status = ? AND pending_mutation = ?',
        [
          name,
          status,
          this.now(),
          ctx.installationId,
          ctx.tenantId,
          expected,
          'active',
          intent,
        ],
      )) === 1
    );
  }
  async ready(session: Session) {
    return (await this.schemaStatus(session)) === 'ready';
  }
  async memberships(session: Session): Promise<Membership[]> {
    const rows = await this.db.rows<{
      tenant_id: string;
      version: number;
      name: string;
      role: Role;
    }>(
      `SELECT t.id AS tenant_id, t.name, t.version, m.role FROM tenant_memberships m JOIN isp_tenants t ON t.id = m.tenant_id WHERE t.installation_id = ? AND m.account_id = ? AND t.status = ? AND m.status = ? AND (m.expires_at IS NULL OR m.expires_at > ?) ORDER BY t.id LIMIT 51`,
      [
        session.installationId,
        session.accountId,
        'active',
        'active',
        this.now(),
      ],
    );
    if (rows.length > 50) throw new InventoryError('INVALID');
    return rows.map((row) => ({
      tenantId: row.tenant_id,
      version: row.version,
      name: row.name,
      role: role(row.role),
    }));
  }
  async membership(session: Session, tenantId: string) {
    const rows = await this.db.rows<{ role: Role }>(
      `SELECT m.role FROM tenant_memberships m JOIN isp_tenants t ON t.id = m.tenant_id AND t.id = ? WHERE t.installation_id = ? AND m.tenant_id = ? AND m.account_id = ? AND t.status = ? AND m.status = ? AND (m.expires_at IS NULL OR m.expires_at > ?)`,
      [
        tenantId,
        session.installationId,
        tenantId,
        session.accountId,
        'active',
        'active',
        this.now(),
      ],
    );
    return rows[0] ? role(rows[0].role) : null;
  }
  async bootstrap(session: Session, name: string, slug: string) {
    const now = this.now();
    await this.db.write(
      'INSERT INTO isp_tenants (id, installation_id, name, slug, unknown_impact_policy, status, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
      [
        this.id(),
        session.installationId,
        name,
        slug,
        'manual-review',
        'draft',
        1,
        now,
        now,
      ],
    );
    const tenants = await this.db.rows<{
      id: string;
      status: string;
      pending_mutation: string | null;
    }>(
      'SELECT id, status, pending_mutation FROM isp_tenants WHERE installation_id = ? AND slug = ?',
      [session.installationId, slug],
    );
    const tenant = tenants[0];
    if (
      !tenant ||
      (tenant.pending_mutation && tenant.status !== 'active') ||
      !['draft', 'active', 'suspended'].includes(tenant.status)
    )
      throw new InventoryError('CONFLICT');
    // Global Jira administrator is the explicit installation bootstrap/recovery authority.
    await this.db.write(
      'INSERT INTO tenant_memberships (tenant_id, id, account_id, role, granted_by, expires_at, status, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE role = ?, status = ?, expires_at = NULL, version = version + 1, updated_at = ?',
      [
        tenant.id,
        this.id(),
        session.accountId,
        'admin',
        session.accountId,
        'active',
        1,
        now,
        now,
        'admin',
        'active',
        now,
      ],
    );
    await this.db.write(
      'UPDATE isp_tenants SET status = ?, version = version + 1, updated_at = ? WHERE installation_id = ? AND id = ? AND status IN (?, ?)',
      ['active', now, session.installationId, tenant.id, 'draft', 'suspended'],
    );
    return tenant.id;
  }
  async grant(
    ctx: TenantContext,
    accountId: string,
    memberRole: Role,
    expires: string | null,
    expected: number | null,
    status: 'active' | 'revoked',
  ) {
    if (ctx.actor.kind !== 'atlassian-user') throw new InventoryError('DENIED');
    const now = this.now();
    if (expected === null) {
      await this.db.write(
        'INSERT INTO tenant_memberships (tenant_id, id, account_id, role, granted_by, expires_at, status, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          ctx.tenantId,
          this.id(),
          accountId,
          memberRole,
          ctx.actor.accountId,
          expires,
          status,
          1,
          now,
          now,
        ],
      );
      return true;
    }
    return (
      (await this.db.write(
        'UPDATE tenant_memberships SET role = ?, granted_by = ?, expires_at = ?, status = ?, version = version + 1, updated_at = ? WHERE tenant_id = ? AND account_id = ? AND version = ?',
        [
          memberRole,
          ctx.actor.accountId,
          expires,
          status,
          now,
          ctx.tenantId,
          accountId,
          expected,
        ],
      )) === 1
    );
  }
}
