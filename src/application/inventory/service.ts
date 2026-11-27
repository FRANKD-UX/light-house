import {
  noInventoryDiagnostics,
  type InventoryDiagnostics,
} from '../ports/inventory-diagnostics';
import {
  definitions,
  integer,
  InventoryError,
  kind,
  object,
  role,
  text,
  utc,
  uuid,
  validateFields,
  type InventoryRecord,
  type Kind,
} from '../../domain/inventory/model';
import type { TenantContext } from '../ports/tenant-context';
import type { InventoryDependencies, Session, TenantMutation } from './ports';
export class InventoryService {
  constructor(
    private readonly deps: InventoryDependencies,
    readonly session: Session,
    private readonly diagnostic: InventoryDiagnostics = noInventoryDiagnostics,
  ) {}
  async admin(): Promise<void> {
    if (!(await this.deps.isJiraAdmin())) throw new InventoryError('DENIED');
  }
  async context(
    tenant: unknown,
    permission: 'read' | 'write' | 'configure' = 'read',
  ): Promise<TenantContext> {
    const tenantId = uuid(tenant);
    await this.diagnostic.run('schema.readiness', async () => {
      if (!(await this.deps.access.ready(this.session)))
        throw new InventoryError('NOT_READY');
    });
    // The membership SELECT also enforces installation, active tenant/grant and expiry.
    const memberRole = await this.diagnostic.run('tenant.membership', () =>
      this.deps.access.membership(this.session, tenantId),
    );
    await this.diagnostic.run('tenant.authorisation', () => {
      if (
        !memberRole ||
        (permission === 'write' && memberRole === 'viewer') ||
        (permission === 'configure' && memberRole !== 'admin')
      )
        throw new InventoryError('DENIED');
    });
    return {
      installationId: this.session.installationId,
      tenantId,
      actor: { kind: 'atlassian-user', accountId: this.session.accountId },
    };
  }
  async overview() {
    const schemaStatus = await this.deps.access.schemaStatus(this.session);
    const ready = schemaStatus === 'ready';
    return {
      ready,
      schemaStatus,
      tenants: ready ? await this.deps.access.memberships(this.session) : [],
      canBootstrap: await this.deps.isJiraAdmin(),
      development: this.session.environment === 'DEVELOPMENT',
    };
  }
  async migrate() {
    await this.admin();
    if (this.session.environment !== 'DEVELOPMENT')
      throw new InventoryError('DENIED');
    return { ready: await this.deps.migrate(this.session) };
  }
  async bootstrap(input: unknown) {
    await this.admin();
    if (!(await this.deps.access.ready(this.session)))
      throw new InventoryError('NOT_READY');
    const data = object(input);
    const name = text(data.name);
    const slug = text(data.slug, 48);
    if (!/^[a-z][a-z0-9-]{1,47}$/.test(slug))
      throw new InventoryError('INVALID');
    return {
      tenantId: await this.deps.access.bootstrap(this.session, name, slug),
    };
  }
  async configureTenant(input: unknown) {
    const data = object(input);
    const ctx = await this.context(data.tenantId, 'configure');
    const status = text(data.status, 24);
    if (!['active', 'suspended', 'retired'].includes(status))
      throw new InventoryError('INVALID');
    const expected = integer(data.expected);
    const intent = JSON.stringify({
      operation: 'configure',
      name: text(data.name),
      status,
      expected,
    } satisfies TenantMutation);
    if (!(await this.deps.inventory.claim(ctx, intent)))
      throw new InventoryError('REPAIR_REQUIRED');
    await this.applyMutation(ctx, intent);
    return { version: expected + 1 };
  }
  async grant(input: unknown) {
    const data = object(input);
    const ctx = await this.context(data.tenantId, 'configure');
    const accountId = text(data.accountId, 128);
    // Preserve an administrator's own access. Recovery requires a Jira administrator bootstrap.
    if (accountId === this.session.accountId)
      throw new InventoryError('DENIED');
    const expires = data.expiresAt === null ? null : utc(data.expiresAt);
    if (expires && expires <= this.deps.now())
      throw new InventoryError('INVALID');
    const status =
      data.status === 'revoked'
        ? 'revoked'
        : data.status === 'active'
          ? 'active'
          : null;
    if (!status) throw new InventoryError('INVALID');
    const saved = await this.deps.access.grant(
      ctx,
      accountId,
      role(data.role),
      expires,
      data.expected === null ? null : integer(data.expected),
      status,
    );
    if (!saved) throw new InventoryError('CONFLICT');
    return { saved: true };
  }
  async list(input: unknown) {
    const { data, entity } = await this.diagnostic.run(
      'inventory.parameters',
      () => {
        const data = object(input);
        return { data, entity: kind(data.entity) };
      },
    );
    const ctx = await this.context(data.tenantId);
    const { after, limit } = await this.diagnostic.run(
      'inventory.parameters',
      () => ({
        after: data.after === '' ? '' : uuid(data.after),
        limit: integer(data.limit, 50),
      }),
    );
    const rows = await this.deps.inventory.list(ctx, entity, after, limit + 1);
    return this.diagnostic.run('response.contract', () => {
      const page = rows.slice(0, limit);
      return {
        rows: page.map((row) => ({
          ...row,
          pending: row.pending ? 'repair-required' : null,
        })),
        next: rows.length > limit ? page[page.length - 1]!.id : null,
      };
    });
  }
  async references(
    ctx: TenantContext,
    entity: Kind,
    fields: ReturnType<typeof validateFields>,
    id: string,
  ) {
    for (const [field, parentKind] of Object.entries(
      definitions[entity].references,
    )) {
      const parentId = fields[field];
      if (parentId === null) continue;
      if (parentId === id) throw new InventoryError('INVALID');
      const parent = await this.deps.inventory.get(
        ctx,
        parentKind,
        uuid(parentId),
      );
      if (
        !parent ||
        parent.pending ||
        !['active', 'maintenance', 'degraded', 'down', 'unmapped'].includes(
          parent.status,
        )
      )
        throw new InventoryError('INVALID');
      if (
        field === 'protected_uplink_id' &&
        (fields.role !== 'backup' ||
          parent.fields.role !== 'primary' ||
          parent.fields.site_id !== fields.site_id)
      )
        throw new InventoryError('INVALID');
    }
  }
  async save(
    input: unknown,
    fixtureKey: string | null = null,
    deferMaterialisation = false,
  ) {
    const data = object(input);
    const entity = kind(data.entity);
    const configure = [
      'teams',
      'assignees',
      'team_memberships',
      'sla_tiers',
      'sla_policy_versions',
    ].includes(entity);
    const ctx = await this.context(
      data.tenantId,
      configure ? 'configure' : 'write',
    );
    const status = text(data.status, 24);
    const fields = validateFields(
      entity,
      entity === 'sla_policy_versions'
        ? { ...object(data.fields), approved_by: null }
        : data.fields,
      status,
    );
    const id = data.id === undefined ? this.deps.id() : uuid(data.id);
    const old =
      data.id === undefined
        ? null
        : await this.deps.inventory.get(ctx, entity, id);
    if (data.id !== undefined && !old) throw new InventoryError('NOT_FOUND');
    if (old?.pending) throw new InventoryError('REPAIR_REQUIRED');
    const expected = old ? integer(data.expected) : 0;
    if (old && old.version !== expected) throw new InventoryError('CONFLICT');
    if (
      old &&
      ['retired', 'disabled', 'revoked', 'expired', 'superseded'].includes(
        old.status,
      )
    )
      throw new InventoryError('INVALID');
    if (
      entity === 'sla_policy_versions' &&
      (status !== 'draft' || (old && old.status !== 'draft'))
    )
      throw new InventoryError('INVALID');
    // Relationships and natural identifiers are fixed after creation. New identity => new record.
    if (old)
      for (const key of [
        ...Object.keys(definitions[entity].references),
        ...definitions[entity].unique,
        ...(entity === 'uplinks' ? ['role'] : []),
      ])
        if (old.fields[key] !== fields[key])
          throw new InventoryError('INVALID');
    const now = this.deps.now();
    const record: InventoryRecord = {
      id,
      tenant_id: ctx.tenantId,
      fields,
      status,
      version: expected + 1,
      created_at: old?.created_at ?? now,
      updated_at: now,
      fixture_key: old?.fixture_key ?? fixtureKey,
      pending: JSON.stringify({
        commandId: this.deps.id(),
        version: expected + 1,
        action: old ? 'update' : 'create',
        at: now,
      }),
    };
    const intent = JSON.stringify({
      operation: 'save',
      entity,
      record,
      expected,
    } satisfies TenantMutation);
    if (!(await this.deps.inventory.claim(ctx, intent)))
      throw new InventoryError('REPAIR_REQUIRED');
    await this.applyMutation(ctx, intent, deferMaterialisation);
    return { id, version: record.version };
  }
  async repairProbe(input: unknown) {
    if (this.session.environment !== 'DEVELOPMENT')
      throw new InventoryError('DENIED');
    const data = object(input);
    const ctx = await this.context(data.tenantId, 'configure');
    const existing = await this.deps.inventory.fixture(
      ctx,
      'sites',
      'repair-probe-v1',
    );
    if (existing) return { id: existing.id, pending: !!existing.pending };
    return this.save(
      {
        tenantId: ctx.tenantId,
        entity: 'sites',
        status: 'active',
        fields: {
          code: 'DEMO-REPAIR-PROBE',
          display_name: 'Synthetic partial-write acceptance probe',
        },
      },
      'repair-probe-v1',
      true,
    );
  }
  async repair(input: unknown) {
    const data = object(input);
    const ctx = await this.context(data.tenantId, 'configure');
    const pending = await this.deps.inventory.pending(ctx);
    if (pending) await this.applyMutation(ctx, pending);
    const entity = kind(data.entity);
    const row = await this.deps.inventory.get(ctx, entity, uuid(data.id));
    if (!row) throw new InventoryError('NOT_FOUND');
    await this.deps.inventory.materialise(ctx, entity, row);
    return { repaired: true };
  }
  async publish(input: unknown) {
    const data = object(input);
    const ctx = await this.context(data.tenantId, 'configure');
    const fields = validateFields(
      'sla_policy_versions',
      { ...object(data.fields), approved_by: this.session.accountId },
      'published',
    );
    const tier = await this.deps.inventory.get(
      ctx,
      'sla_tiers',
      uuid(fields.tier_id),
    );
    if (!tier || tier.status !== 'active') throw new InventoryError('INVALID');
    if (tier.pending) throw new InventoryError('REPAIR_REQUIRED');
    const expected = integer(data.expectedTierVersion);
    if (tier.version !== expected) throw new InventoryError('CONFLICT');
    const policies = await this.deps.inventory.policies(ctx, tier.id);
    if (policies.length >= 100) throw new InventoryError('INVALID');
    const draft = policies.find(
      (policy) =>
        policy.status === 'draft' &&
        policy.fields.version_number === fields.version_number,
    );
    if (draft?.pending) throw new InventoryError('REPAIR_REQUIRED');
    if (
      draft &&
      Object.keys(fields).some(
        (key) => key !== 'approved_by' && draft.fields[key] !== fields[key],
      )
    )
      throw new InventoryError('CONFLICT');
    for (const policy of policies.filter(
      (policy) => policy.status === 'published',
    )) {
      if (
        policy.fields.version_number === fields.version_number ||
        (String(fields.effective_from) <
          String(policy.fields.effective_until ?? '9999') &&
          String(policy.fields.effective_from) <
            String(fields.effective_until ?? '9999'))
      )
        throw new InventoryError('CONFLICT');
    }
    const last = policies
      .filter((policy) => policy.status === 'published')
      .at(-1);
    if (last && fields.effective_from !== last.fields.effective_until)
      throw new InventoryError('INVALID');
    const now = this.deps.now();
    const id = draft?.id ?? this.deps.id();
    const policy: InventoryRecord = {
      id,
      tenant_id: ctx.tenantId,
      fields,
      status: 'published',
      version: draft ? draft.version + 1 : 1,
      created_at: draft?.created_at ?? now,
      updated_at: now,
      fixture_key: null,
      pending: null,
    };
    const changed = {
      ...tier,
      version: expected + 1,
      updated_at: now,
      pending: JSON.stringify({
        commandId: this.deps.id(),
        version: expected + 1,
        action: 'update',
        at: now,
        policy,
      }),
    };
    const intent = JSON.stringify({
      operation: 'save',
      entity: 'sla_tiers',
      record: changed,
      expected,
    } satisfies TenantMutation);
    if (!(await this.deps.inventory.claim(ctx, intent)))
      throw new InventoryError('REPAIR_REQUIRED');
    await this.applyMutation(ctx, intent);
    return { id, version: policy.version };
  }
  async repairTenant(input: unknown) {
    const data = object(input);
    const ctx = await this.context(data.tenantId, 'configure');
    const pending = await this.deps.inventory.pending(ctx);
    if (pending) await this.applyMutation(ctx, pending);
    return { repaired: true };
  }
  private async applyMutation(
    ctx: TenantContext,
    intent: string,
    defer = false,
  ): Promise<void> {
    const mutation = JSON.parse(intent) as TenantMutation;
    let stored = false;
    try {
      if (mutation.operation === 'configure') {
        if (
          mutation.status === 'retired' &&
          (await this.deps.inventory.hasLiveInventory(ctx))
        )
          throw new InventoryError('INVALID');
        if (
          !(await this.deps.access.configureTenant(
            ctx,
            mutation.name,
            mutation.status,
            mutation.expected,
            intent,
          ))
        )
          throw new InventoryError('CONFLICT');
        return;
      }
      const { entity, record, expected } = mutation;
      const commandId = String(object(JSON.parse(record.pending!)).commandId);
      const current = await this.deps.inventory.get(ctx, entity, record.id);
      const recorded = await this.deps.inventory.recorded(ctx, commandId);
      if (recorded && current?.pending !== record.pending) {
        await this.deps.inventory.finish(ctx, intent);
        return;
      }
      if (current?.pending === record.pending) stored = true;
      else {
        if (
          (current && (current.version !== expected || current.pending)) ||
          (!current && expected !== 0)
        )
          throw new InventoryError('CONFLICT');
        if (entity === 'sla_tiers') {
          const policy = object(JSON.parse(record.pending!)).policy as
            InventoryRecord | undefined;
          if (policy)
            for (const existing of await this.deps.inventory.policies(
              ctx,
              record.id,
            ))
              if (
                existing.fields.version_number ===
                  policy.fields.version_number &&
                (existing.id !== policy.id ||
                  existing.status !== 'draft' ||
                  existing.version !== policy.version - 1 ||
                  Object.keys(policy.fields).some(
                    (key) =>
                      key !== 'approved_by' &&
                      existing.fields[key] !== policy.fields[key],
                  ))
              )
                throw new InventoryError('CONFLICT');
        }
        await this.references(ctx, entity, record.fields, record.id);
        if (
          current &&
          ['retired', 'disabled', 'revoked'].includes(record.status) &&
          (await this.deps.inventory.referenced(ctx, entity, record.id))
        )
          throw new InventoryError('INVALID');
        try {
          if (current) {
            if (
              !(await this.deps.inventory.update(ctx, entity, record, expected))
            )
              throw new InventoryError('CONFLICT');
          } else await this.deps.inventory.create(ctx, entity, record);
          stored = true;
        } catch (error) {
          const raced = await this.deps.inventory.get(ctx, entity, record.id);
          if (
            raced?.pending === record.pending ||
            (await this.deps.inventory.recorded(ctx, commandId))
          )
            stored = true;
          else throw error;
        }
      }
      if (defer) throw new InventoryError('REPAIR_REQUIRED');
      await this.deps.inventory.materialise(ctx, entity, record);
      await this.deps.inventory.finish(ctx, intent);
    } catch (error) {
      if (
        !stored &&
        error instanceof InventoryError &&
        ['INVALID', 'CONFLICT'].includes(error.code)
      )
        await this.deps.inventory.finish(ctx, intent);
      throw error;
    }
  }
}
