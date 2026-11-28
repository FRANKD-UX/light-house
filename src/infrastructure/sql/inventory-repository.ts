import {
  noInventoryDiagnostics,
  type InventoryDiagnostics,
} from '../../application/ports/inventory-diagnostics';
import type { InventoryRepository } from '../../application/inventory/ports';
import type { TenantContext } from '../../application/ports/tenant-context';
import {
  definitions,
  kinds,
  InventoryError,
  object,
  type Fields,
  type InventoryRecord,
  type Kind,
  type Scalar,
} from '../../domain/inventory/model';
import type { SqlDriver } from './driver';
type Row = Omit<InventoryRecord, 'fields'> & Fields;
const columns = (entity: Kind) => [
  'tenant_id',
  'id',
  'status',
  'version',
  'created_at',
  'updated_at',
  'fixture_key',
  'pending',
  ...Object.keys(definitions[entity].fields),
];
function decode(entity: Kind, row: Row): InventoryRecord {
  const fields: Fields = {};
  for (const key of Object.keys(definitions[entity].fields))
    fields[key] = row[key]!;
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    status: row.status,
    version: row.version,
    created_at: row.created_at,
    updated_at: row.updated_at,
    fixture_key: row.fixture_key,
    pending: row.pending,
    fields,
  };
}
function flatten(ctx: TenantContext, record: InventoryRecord): Fields {
  return {
    ...record.fields,
    tenant_id: ctx.tenantId,
    id: record.id,
    status: record.status,
    version: record.version,
    created_at: record.created_at,
    updated_at: record.updated_at,
    fixture_key: record.fixture_key,
    pending: record.pending,
  };
}
export class SqlInventoryRepository implements InventoryRepository {
  constructor(
    private readonly db: SqlDriver,
    private readonly diagnostic: InventoryDiagnostics = noInventoryDiagnostics,
  ) {}
  async claim(ctx: TenantContext, intent: string) {
    if (intent.length > 8192) throw new InventoryError('INVALID');
    return (
      (await this.db.write(
        'UPDATE isp_tenants SET pending_mutation = ? WHERE installation_id = ? AND id = ? AND status = ? AND pending_mutation IS NULL',
        [intent, ctx.installationId, ctx.tenantId, 'active'],
      )) === 1
    );
  }
  async pending(ctx: TenantContext) {
    const rows = await this.db.rows<{ pending_mutation: string | null }>(
      'SELECT pending_mutation FROM isp_tenants WHERE installation_id = ? AND id = ?',
      [ctx.installationId, ctx.tenantId],
    );
    return rows[0]?.pending_mutation ?? null;
  }
  async finish(ctx: TenantContext, intent: string) {
    await this.db.write(
      'UPDATE isp_tenants SET pending_mutation = NULL WHERE installation_id = ? AND id = ? AND pending_mutation = ?',
      [ctx.installationId, ctx.tenantId, intent],
    );
  }
  async recorded(ctx: TenantContext, commandId: string) {
    return (
      (
        await this.db.rows<{ id: string }>(
          'SELECT id FROM mutation_receipts WHERE tenant_id = ? AND id = ?',
          [ctx.tenantId, commandId],
        )
      ).length === 1
    );
  }
  async get(ctx: TenantContext, entity: Kind, id: string) {
    const rows = await this.db.rows<Row>(
      `SELECT * FROM ${entity} WHERE tenant_id = ? AND id = ?`,
      [ctx.tenantId, id],
    );
    return rows[0] ? decode(entity, rows[0]) : null;
  }
  async fixture(ctx: TenantContext, entity: Kind, key: string) {
    const rows = await this.db.rows<Row>(
      `SELECT * FROM ${entity} WHERE tenant_id = ? AND fixture_key = ?`,
      [ctx.tenantId, key],
    );
    return rows[0] ? decode(entity, rows[0]) : null;
  }
  async list(ctx: TenantContext, entity: Kind, after: string, limit: unknown) {
    const query = await this.diagnostic.run('inventory.query', () => {
      if (
        typeof limit !== 'number' ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 51
      )
        throw new InventoryError('INVALID');
      // Only this bounded integer becomes SQL text; tenant and cursor stay bound.
      return `SELECT * FROM ${entity} WHERE tenant_id = ? AND id > ? ORDER BY id LIMIT ${limit}`;
    });
    const rows = await this.diagnostic.run('inventory.sql', () =>
      this.db.rows<Row>(query, [ctx.tenantId, after]),
    );
    return this.diagnostic.run('inventory.mapping', () =>
      rows.map((row) => decode(entity, row)),
    );
  }

  async create(ctx: TenantContext, entity: Kind, record: InventoryRecord) {
    const cols = columns(entity);
    const values = flatten(ctx, record);
    // Explicit fields avoid serialising the fields container itself.
    const params = cols.map((key) => values[key] as Scalar);
    const affected = await this.db.write(
      `INSERT INTO ${entity} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      params,
    );
    if (affected !== 1) throw new InventoryError('UNAVAILABLE');
  }
  async update(
    ctx: TenantContext,
    entity: Kind,
    record: InventoryRecord,
    expected: number,
  ) {
    const cols = [
      'status',
      'version',
      'updated_at',
      'pending',
      ...Object.keys(definitions[entity].fields),
    ];
    const values: Fields = {
      ...record.fields,
      status: record.status,
      version: record.version,
      updated_at: record.updated_at,
      pending: record.pending,
    };
    return (
      (await this.db.write(
        `UPDATE ${entity} SET ${cols.map((key) => `${key} = ?`).join(', ')} WHERE tenant_id = ? AND id = ? AND version = ? AND pending IS NULL`,
        [...cols.map((key) => values[key]!), ctx.tenantId, record.id, expected],
      )) === 1
    );
  }
  async materialise(ctx: TenantContext, entity: Kind, record: InventoryRecord) {
    if (!record.pending) return;
    const pending = object(JSON.parse(record.pending));
    // The bounded envelope is generated by the application; never supplied by a browser.
    if (pending.policy) {
      if (entity !== 'sla_tiers') throw new InventoryError('INVALID');
      const policy = pending.policy as InventoryRecord;
      const existing = await this.get(ctx, 'sla_policy_versions', policy.id);
      if (existing?.status === 'draft')
        await this.db.write(
          'UPDATE sla_policy_versions SET status = ?, version = ?, updated_at = ?, approved_by = ? WHERE tenant_id = ? AND id = ? AND status = ? AND version = ?',
          [
            'published',
            policy.version,
            policy.updated_at,
            policy.fields.approved_by!,
            ctx.tenantId,
            policy.id,
            'draft',
            policy.version - 1,
          ],
        );
      if (!existing)
        await this.insertIdempotent(ctx, 'sla_policy_versions', policy);
      const published = await this.get(ctx, 'sla_policy_versions', policy.id);
      if (
        !published ||
        published.status !== 'published' ||
        Object.keys(policy.fields).some(
          (key) => published.fields[key] !== policy.fields[key],
        )
      )
        throw new InventoryError('CONFLICT');
    }
    await this.db.write(
      'INSERT INTO mutation_receipts (tenant_id, id, entity, resource_id, aggregate_version, action, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
      [
        ctx.tenantId,
        String(pending.commandId),
        entity,
        record.id,
        record.version,
        String(pending.action),
        String(pending.at),
      ],
    );
    if (!(await this.recorded(ctx, String(pending.commandId))))
      throw new InventoryError('CONFLICT');
    await this.db.write(
      `UPDATE ${entity} SET pending = NULL WHERE tenant_id = ? AND id = ? AND version = ? AND pending = ?`,
      [ctx.tenantId, record.id, record.version, record.pending],
    );
  }
  private async insertIdempotent(
    ctx: TenantContext,
    entity: Kind,
    record: InventoryRecord,
  ) {
    const cols = columns(entity);
    const values = flatten(ctx, record);
    await this.db.write(
      `INSERT INTO ${entity} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) ON DUPLICATE KEY UPDATE id = id`,
      cols.map((key) => values[key]!),
    );
    const stored = await this.get(ctx, entity, record.id);
    if (
      !stored ||
      JSON.stringify(stored.fields) !== JSON.stringify(record.fields)
    )
      throw new InventoryError('CONFLICT');
  }
  async referenced(ctx: TenantContext, entity: Kind, id: string) {
    for (const child of kinds)
      for (const [field, parent] of Object.entries(
        definitions[child].references,
      )) {
        if (
          parent === entity &&
          (
            await this.db.rows<{ id: string }>(
              `SELECT id FROM ${child} WHERE tenant_id = ? AND ${field} = ? AND status NOT IN (?, ?, ?, ?, ?) LIMIT 1`,
              [
                ctx.tenantId,
                id,
                'retired',
                'revoked',
                'expired',
                'disabled',
                'superseded',
              ],
            )
          ).length
        )
          return true;
      }
    return false;
  }
  async hasLiveInventory(ctx: TenantContext) {
    for (const entity of kinds)
      if (
        (
          await this.db.rows<{ id: string }>(
            `SELECT id FROM ${entity} WHERE tenant_id = ? AND status NOT IN (?, ?, ?, ?, ?) LIMIT 1`,
            [
              ctx.tenantId,
              'retired',
              'disabled',
              'revoked',
              'expired',
              'superseded',
            ],
          )
        ).length
      )
        return true;
    return false;
  }
  async policies(ctx: TenantContext, tierId: string) {
    return (
      await this.db.rows<Row>(
        'SELECT * FROM sla_policy_versions WHERE tenant_id = ? AND tier_id = ? AND status IN (?, ?) ORDER BY effective_from LIMIT 101',
        [ctx.tenantId, tierId, 'draft', 'published'],
      )
    ).map((row) => decode('sla_policy_versions', row));
  }
}
