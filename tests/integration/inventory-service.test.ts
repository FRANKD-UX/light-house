import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { database } from '../support/sqlite';
import { InventoryService } from '../../src/application/inventory/service';
import { seedBatch } from '../../src/application/inventory/seed';
import { fixtures, demoPolicy } from '../../src/application/inventory/fixtures';
import type { Fields, Kind } from '../../src/domain/inventory/model';
async function seeded() {
  const h = database();
  const tenantId = await h.setup();
  for (let offset = 0; offset < fixtures.length; offset += 4)
    await seedBatch(h.service, h.deps, { tenantId, offset });
  const ctx = await h.service.context(tenantId);
  return { ...h, tenantId, ctx };
}
const site = (tenantId: string, code = 'hill') => ({
  tenantId,
  entity: 'sites',
  fields: { code, display_name: 'Hill POP' },
  status: 'active',
});
describe('inventory services against local SQLite relational simulation (not Forge SQL)', () => {
  it('denies arbitrary bootstrap and fails closed before schema readiness', async () => {
    const h = database();
    expect((await h.service.overview()).ready).toBe(false);
    await expect(h.service.context(randomUUID())).rejects.toThrow('NOT_READY');
    await expect(
      h.service.bootstrap({ name: 'Demo', slug: 'demo' }),
    ).rejects.toThrow('NOT_READY');
    h.deps.isJiraAdmin.mockResolvedValue(false);
    await expect(h.service.bootstrap({})).rejects.toThrow('DENIED');
    await expect(h.service.migrate()).rejects.toThrow('DENIED');
    h.deps.isJiraAdmin.mockResolvedValue(true);
    expect(await h.service.migrate()).toEqual({ ready: false });
    expect(h.deps.migrate).toHaveBeenCalledWith(h.session);
    const production = new InventoryService(h.deps, {
      ...h.session,
      environment: 'PRODUCTION',
    });
    await expect(production.migrate()).rejects.toThrow('DENIED');
    await expect(seedBatch(production, h.deps, {})).rejects.toThrow('DENIED');
  });
  it('bootstraps safely, resumes after a partial failure and supports admin recovery', async () => {
    const h = database();
    await h.ready();
    await expect(
      h.service.bootstrap({ name: 'Demo', slug: 'INVALID SPACE' }),
    ).rejects.toThrow('INVALID');
    h.failNext('INSERT INTO tenant_memberships');
    await expect(
      h.service.bootstrap({ name: 'Demo', slug: 'demo' }),
    ).rejects.toThrow('UNAVAILABLE');
    expect((await h.service.overview()).tenants).toEqual([]);
    const { tenantId } = await h.service.bootstrap({
      name: 'Demo',
      slug: 'demo',
    });
    expect(await h.service.bootstrap({ name: 'Demo', slug: 'demo' })).toEqual({
      tenantId,
    });
    expect((await h.service.overview()).tenants).toEqual([
      { tenantId, name: 'Demo', role: 'admin', version: 2 },
    ]);
    h.sqlite.prepare('UPDATE isp_tenants SET status = ?').run('retired');
    await expect(
      h.service.bootstrap({ name: 'Demo', slug: 'demo' }),
    ).rejects.toThrow('CONFLICT');
  });
  it('isolates two ISPs, checks every role server-side, revokes and expires grants', async () => {
    const h = database();
    const one = await h.setup();
    const two = (
      await h.service.bootstrap({
        name: 'Beacon Transit',
        slug: 'beacon-transit',
      })
    ).tenantId;
    const created = await h.service.save(site(one));
    await h.service.save(site(two));
    expect(
      (
        await h.service.list({
          tenantId: two,
          entity: 'sites',
          after: '',
          limit: 20,
        })
      ).rows,
    ).toHaveLength(1);
    await expect(
      h.service.save({ ...site(two), id: created.id, expected: 1 }),
    ).rejects.toThrow('NOT_FOUND');
    const user = new InventoryService(h.deps, {
      ...h.session,
      accountId: 'viewer-test',
    });
    await expect(user.context(one)).rejects.toThrow('DENIED');
    await expect(
      h.service.grant({
        tenantId: one,
        accountId: h.session.accountId,
        role: 'viewer',
        expiresAt: null,
        expected: null,
        status: 'active',
      }),
    ).rejects.toThrow('DENIED');
    const grant = {
      tenantId: one,
      accountId: 'viewer-test',
      role: 'viewer',
      expiresAt: null,
      expected: null,
      status: 'active',
    };
    await h.service.grant(grant);
    expect((await user.overview()).tenants).toHaveLength(1);
    await expect(user.context(two)).rejects.toThrow('DENIED');
    await expect(user.save(site(one, 'other'))).rejects.toThrow('DENIED');
    await expect(user.grant(grant)).rejects.toThrow('DENIED');
    await h.service.grant({ ...grant, expected: 1, role: 'operator' });
    await user.save(site(one, 'other'));
    await expect(
      user.save({
        tenantId: one,
        entity: 'teams',
        fields: { code: 'noc', name: 'NOC' },
        status: 'active',
      }),
    ).rejects.toThrow('DENIED');
    await expect(
      h.service.grant({ ...grant, expected: 1, status: 'revoked' }),
    ).rejects.toThrow('CONFLICT');
    await h.service.grant({ ...grant, expected: 2, status: 'revoked' });
    await expect(user.context(one)).rejects.toThrow('DENIED');
    await expect(
      h.service.grant({ ...grant, expiresAt: '2026-01-01T00:00:00.000Z' }),
    ).rejects.toThrow('INVALID');
    await expect(h.service.grant({ ...grant, status: 'bad' })).rejects.toThrow(
      'INVALID',
    );
    await h.service.grant({
      ...grant,
      expected: 3,
      expiresAt: '2027-01-01T00:00:00.000Z',
    });
    await user.context(one);
    h.sqlite
      .prepare(
        'UPDATE tenant_memberships SET expires_at = ? WHERE account_id = ?',
      )
      .run('2026-01-01T00:00:00.000Z', 'viewer-test');
    await expect(user.context(one)).rejects.toThrow('DENIED');
  });
  it('version-checks tenant configuration and denies suspended membership until administrator recovery', async () => {
    const h = database();
    const tenantId = await h.setup();
    await expect(
      h.service.configureTenant({
        tenantId,
        name: 'Demo',
        status: 'deleted',
        expected: 2,
      }),
    ).rejects.toThrow('INVALID');
    await expect(
      h.service.configureTenant({
        tenantId,
        name: 'Demo',
        status: 'active',
        expected: 1,
      }),
    ).rejects.toThrow('CONFLICT');
    expect(
      await h.service.configureTenant({
        tenantId,
        name: 'Renamed demonstration ISP',
        status: 'suspended',
        expected: 2,
      }),
    ).toEqual({ version: 3 });
    await expect(h.service.context(tenantId)).rejects.toThrow('DENIED');
    await h.service.bootstrap({ name: 'Original', slug: 'lantern-fibre' });
    await h.service.context(tenantId);
    await h.service.configureTenant({
      tenantId,
      name: 'Retired demonstration ISP',
      status: 'retired',
      expected: 4,
    });
    await expect(h.service.context(tenantId)).rejects.toThrow('DENIED');
  });
  it('creates one explicit development-only durable repair probe', async () => {
    const h = database();
    const tenantId = await h.setup();
    await expect(h.service.repairProbe({ tenantId })).rejects.toThrow(
      'REPAIR_REQUIRED',
    );
    const again = await h.service.repairProbe({ tenantId });
    expect(again).toMatchObject({ pending: true });
    const ctx = await h.service.context(tenantId);
    const row = await h.deps.inventory.fixture(ctx, 'sites', 'repair-probe-v1');
    await h.service.repair({ tenantId, entity: 'sites', id: row!.id });
    expect(await h.service.repairProbe({ tenantId })).toMatchObject({
      pending: false,
    });
    await expect(
      new InventoryService(h.deps, {
        ...h.session,
        environment: 'PRODUCTION',
      }).repairProbe({ tenantId }),
    ).rejects.toThrow('DENIED');
  });
  it('creates, retrieves, bounds pages, rejects uniqueness and preserves external identifier case', async () => {
    const h = database();
    const tenantId = await h.setup();
    const first = await h.service.save(site(tenantId));
    await h.service.save(site(tenantId, 'HILL'));
    await expect(h.service.save(site(tenantId))).rejects.toThrow('CONFLICT');
    const page = await h.service.list({
      tenantId,
      entity: 'sites',
      after: '',
      limit: 1,
    });
    expect(page.rows).toHaveLength(1);
    expect(page.next).toBe(page.rows[0]!.id);
    const end = await h.service.list({
      tenantId,
      entity: 'sites',
      after: page.next,
      limit: 1,
    });
    expect(end.rows).toHaveLength(1);
    expect(end.next).toBeNull();
    await expect(
      h.service.list({ tenantId, entity: 'sites', after: '', limit: 51 }),
    ).rejects.toThrow('INVALID');
    const changed = {
      ...site(tenantId),
      id: first.id,
      expected: 1,
      fields: { code: 'hill', display_name: 'Updated' },
    };
    expect(await h.service.save(changed)).toEqual({ id: first.id, version: 2 });
    await expect(h.service.save(changed)).rejects.toThrow('CONFLICT');
    await expect(
      h.service.save({
        ...changed,
        expected: 2,
        fields: { code: 'moved', display_name: 'Updated' },
      }),
    ).rejects.toThrow('INVALID');
    await h.service.save({ ...changed, expected: 2, status: 'retired' });
    await expect(h.service.save({ ...changed, expected: 3 })).rejects.toThrow(
      'INVALID',
    );
  });
  it('recovers durable mutation intent after failed materialisation and blocks competing writes', async () => {
    const h = database();
    const tenantId = await h.setup();
    h.failNext('INSERT INTO mutation_receipts');
    await expect(h.service.save(site(tenantId))).rejects.toThrow('UNAVAILABLE');
    const row = (
      await h.service.list({ tenantId, entity: 'sites', after: '', limit: 20 })
    ).rows[0]!;
    expect(row.pending).toBe('repair-required');
    await expect(
      h.service.save({ ...site(tenantId), id: row.id, expected: 1 }),
    ).rejects.toThrow('REPAIR_REQUIRED');
    await h.service.repair({ tenantId, entity: 'sites', id: row.id });
    await h.service.repair({ tenantId, entity: 'sites', id: row.id });
    expect(
      h.sqlite.prepare('SELECT * FROM mutation_receipts').all(),
    ).toHaveLength(1);
    await h.service.save({ ...site(tenantId), id: row.id, expected: 1 });
    await expect(
      h.service.repair({ tenantId, entity: 'sites', id: randomUUID() }),
    ).rejects.toThrow('NOT_FOUND');
  });
  it('seeds bounded batches idempotently with independent services and missing mappings', async () => {
    const h = await seeded();
    await expect(
      h.service.configureTenant({
        tenantId: h.tenantId,
        name: 'Demo',
        status: 'retired',
        expected: 2,
      }),
    ).rejects.toThrow('INVALID');
    expect(fixtures.length).toBeLessThan(100);
    const initial = h.sqlite
      .prepare('SELECT COUNT(*) AS n FROM mutation_receipts')
      .get();
    for (let offset = 0; offset < fixtures.length; offset += 4)
      await seedBatch(h.service, h.deps, { tenantId: h.tenantId, offset });
    expect(
      h.sqlite.prepare('SELECT COUNT(*) AS n FROM mutation_receipts').get(),
    ).toEqual(initial);
    expect(
      await h.deps.inventory.list(h.ctx, 'customers', '', 50),
    ).toHaveLength(6);
    expect(
      await h.deps.inventory.list(h.ctx, 'customer_services', '', 50),
    ).toHaveLength(8);
    const services = await h.deps.inventory.list(
      h.ctx,
      'customer_services',
      '',
      50,
    );
    expect(new Set(services.map((s) => s.id)).size).toBe(8);
    expect(new Set(services.map((s) => s.fields.customer_id)).size).toBe(6);
    const missing = await h.deps.inventory.fixture(
      h.ctx,
      'customer_services',
      'service-8',
    );
    expect(
      h.sqlite
        .prepare(
          'SELECT * FROM service_dependencies WHERE tenant_id = ? AND service_id = ?',
        )
        .all(h.tenantId, missing!.id),
    ).toEqual([]);
    await expect(
      seedBatch(h.service, h.deps, { tenantId: h.tenantId, offset: 999 }),
    ).rejects.toThrow('INVALID');
  });
  it('repairs incomplete seeding, rejects out-of-order batches and cross-tenant relationship injection', async () => {
    const h = database();
    const tenantId = await h.setup();
    await expect(
      seedBatch(h.service, h.deps, { tenantId, offset: 12 }),
    ).rejects.toThrow('NOT_READY');
    h.failNext('INSERT INTO mutation_receipts');
    await expect(
      seedBatch(h.service, h.deps, { tenantId, offset: 0 }),
    ).rejects.toThrow('UNAVAILABLE');
    await seedBatch(h.service, h.deps, { tenantId, offset: 0 });
    const other = (await h.service.bootstrap({ name: 'Other', slug: 'other' }))
      .tenantId;
    const foreign = await h.service.save(site(other));
    await expect(
      h.service.save({
        tenantId,
        entity: 'uplinks',
        status: 'active',
        fields: {
          site_id: foreign.id,
          carrier_id: randomUUID(),
          code: 'A',
          role: 'primary',
          capacity_mbps: 1000,
        },
      }),
    ).rejects.toThrow('INVALID');
  });
  it('enforces backup, parent lifecycle and dependency uniqueness', async () => {
    const h = await seeded();
    const row = async (entity: Kind, key: string) =>
      (await h.deps.inventory.fixture(h.ctx, entity, key))!;
    const primary = await row('uplinks', 'hill-primary');
    const backup = await row('uplinks', 'hill-backup');
    const siteRow = await row('sites', 'hill');
    const saveLink = (fields: Fields) =>
      h.service.save({
        tenantId: h.tenantId,
        entity: 'uplinks',
        fields,
        status: 'active',
      });
    await expect(
      saveLink({
        ...backup.fields,
        code: 'other',
        protected_uplink_id: backup.id,
      }),
    ).rejects.toThrow('INVALID');
    await expect(
      saveLink({
        ...backup.fields,
        code: 'other',
        site_id: (await row('sites', 'harbour')).id,
      }),
    ).rejects.toThrow('INVALID');
    await expect(
      h.service.save({
        tenantId: h.tenantId,
        entity: 'uplinks',
        id: backup.id,
        expected: 1,
        fields: { ...backup.fields, protected_uplink_id: backup.id },
        status: 'active',
      }),
    ).rejects.toThrow('INVALID');
    await expect(
      h.service.save({
        tenantId: h.tenantId,
        entity: 'sites',
        id: siteRow.id,
        expected: 1,
        fields: siteRow.fields,
        status: 'retired',
      }),
    ).rejects.toThrow('INVALID');
    const dependency = await row('service_dependencies', 'dependency-1');
    await expect(
      h.service.save({
        tenantId: h.tenantId,
        entity: 'service_dependencies',
        fields: dependency.fields,
        status: 'active',
      }),
    ).rejects.toThrow('CONFLICT');
    h.sqlite
      .prepare('UPDATE carriers SET status = ? WHERE tenant_id = ?')
      .run('retired', h.tenantId);
    await expect(
      saveLink({ ...primary.fields, code: 'other' }),
    ).rejects.toThrow('INVALID');
  });
  it('publishes through version-claimed tier intent, repairs partial publication and forbids edits or overlaps', async () => {
    const h = await seeded();
    const tier = (await h.deps.inventory.fixture(
      h.ctx,
      'sla_tiers',
      'enterprise',
    ))!;
    const fields = demoPolicy(tier.id);
    h.failNext('UPDATE sla_policy_versions');
    await expect(
      h.service.publish({
        tenantId: h.tenantId,
        fields,
        expectedTierVersion: 1,
      }),
    ).rejects.toThrow('UNAVAILABLE');
    await expect(
      h.service.publish({
        tenantId: h.tenantId,
        fields,
        expectedTierVersion: 2,
      }),
    ).rejects.toThrow('REPAIR_REQUIRED');
    await h.service.repair({
      tenantId: h.tenantId,
      entity: 'sla_tiers',
      id: tier.id,
    });
    const published = (await h.deps.inventory.policies(h.ctx, tier.id)).filter(
      (row) => row.status === 'published',
    );
    expect(published).toHaveLength(1);
    await expect(
      h.service.save({
        tenantId: h.tenantId,
        entity: 'sla_policy_versions',
        id: published[0]!.id,
        fields,
        status: 'draft',
        expected: published[0]!.version,
      }),
    ).rejects.toThrow('INVALID');
    await expect(
      h.service.save({
        tenantId: h.tenantId,
        entity: 'sla_policy_versions',
        fields,
        status: 'published',
      }),
    ).rejects.toThrow('INVALID');
    await expect(
      h.service.publish({
        tenantId: h.tenantId,
        fields,
        expectedTierVersion: 1,
      }),
    ).rejects.toThrow('CONFLICT');
    await expect(
      h.service.publish({
        tenantId: h.tenantId,
        fields: { ...fields, version_number: 2 },
        expectedTierVersion: 2,
      }),
    ).rejects.toThrow('CONFLICT');
    await expect(
      h.service.publish({
        tenantId: h.tenantId,
        fields: { ...fields, tier_id: randomUUID() },
        expectedTierVersion: 1,
      }),
    ).rejects.toThrow('INVALID');
    const tier2 = await h.service.save({
      tenantId: h.tenantId,
      entity: 'sla_tiers',
      fields: { code: 'new-tier', name: 'Demonstration new' },
      status: 'active',
    });
    const first = await h.service.publish({
      tenantId: h.tenantId,
      fields: {
        ...demoPolicy(tier2.id),
        effective_until: '2027-01-01T00:00:00.000Z',
      },
      expectedTierVersion: 1,
    });
    expect(first.version).toBe(1);
    await h.service.publish({
      tenantId: h.tenantId,
      fields: {
        ...demoPolicy(tier2.id),
        version_number: 2,
        effective_from: '2027-01-01T00:00:00.000Z',
      },
      expectedTierVersion: 2,
    });
  });
  it('reports CAS races explicitly for aggregate and tier publication', async () => {
    const h = await seeded();
    const row = (await h.deps.inventory.fixture(h.ctx, 'sites', 'hill'))!;
    const update = vi
      .spyOn(h.deps.inventory, 'update')
      .mockResolvedValue(false);
    await expect(
      h.service.save({
        tenantId: h.tenantId,
        entity: 'sites',
        id: row.id,
        expected: 1,
        fields: row.fields,
        status: 'active',
      }),
    ).rejects.toThrow('CONFLICT');
    const tier = (await h.deps.inventory.fixture(
      h.ctx,
      'sla_tiers',
      'enterprise',
    ))!;
    await expect(
      h.service.publish({
        tenantId: h.tenantId,
        fields: demoPolicy(tier.id),
        expectedTierVersion: 1,
      }),
    ).rejects.toThrow('CONFLICT');
    update.mockRestore();
  });
  it('simulates two distinct installation databases without claiming real installation acceptance', async () => {
    const a = await seeded();
    const b = database();
    b.session.installationId = 'second-simulated-installation';
    await b.setup();
    expect(
      await b.deps.inventory.get(
        await b.service.context(
          (await b.service.overview()).tenants[0]!.tenantId,
        ),
        'sites',
        (await a.deps.inventory.list(a.ctx, 'sites', '', 1))[0]!.id,
      ),
    ).toBeNull();
    expect(await b.deps.access.membership(b.session, a.tenantId)).toBeNull();
  });
});

describe('durable tenant admission and partial-write races (local simulation)', () => {
  it('serializes parent retirement against child creation and allows replay concurrent with the original invocation', async () => {
    const h = await seeded();
    const parent = (await h.deps.inventory.fixture(h.ctx, 'sites', 'hill'))!;
    const carrier = (await h.deps.inventory.fixture(
      h.ctx,
      'carriers',
      'copper-kite',
    ))!;
    const create = h.deps.inventory.create.bind(h.deps.inventory);
    let release!: () => void;
    let started!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(h.deps.inventory, 'create').mockImplementationOnce(
      async (...args) => {
        started();
        await hold;
        return create(...args);
      },
    );
    const first = h.service.save({
      tenantId: h.tenantId,
      entity: 'uplinks',
      status: 'active',
      fields: {
        site_id: parent.id,
        carrier_id: carrier.id,
        code: 'concurrent-demo',
        role: 'primary',
        capacity_mbps: 100,
      },
    });
    await entered;
    await expect(
      h.service.save({
        tenantId: h.tenantId,
        entity: 'sites',
        id: parent.id,
        expected: 1,
        status: 'retired',
        fields: parent.fields,
      }),
    ).rejects.toThrow('REPAIR_REQUIRED');
    await h.service.repairTenant({ tenantId: h.tenantId }); // Materialises the same complete intent before original resumes.
    await expect(
      h.service.repairProbe({ tenantId: h.tenantId }),
    ).rejects.toThrow('REPAIR_REQUIRED');
    const newer = await h.deps.inventory.pending(h.ctx);
    release();
    await first;
    expect(await h.deps.inventory.pending(h.ctx)).toBe(newer); // Old completion cannot clear another command.
    await h.service.repairTenant({ tenantId: h.tenantId });
    expect(await h.deps.inventory.pending(h.ctx)).toBeNull();
    await expect(
      h.service.save({
        tenantId: h.tenantId,
        entity: 'sites',
        id: parent.id,
        expected: 1,
        status: 'retired',
        fields: parent.fields,
      }),
    ).rejects.toThrow('INVALID');
  });
  it('repairs an intent retained before the target write and rejects malformed or oversized admissions', async () => {
    const h = database();
    const tenantId = await h.setup();
    const ctx = await h.service.context(tenantId);
    h.failNext('INSERT INTO sites');
    await expect(h.service.save(site(tenantId))).rejects.toThrow('UNAVAILABLE');
    expect(await h.deps.inventory.pending(ctx)).toBeTruthy();
    await h.service.repairTenant({ tenantId });
    expect(await h.deps.inventory.list(ctx, 'sites', '', 20)).toHaveLength(1);
    await expect(h.deps.inventory.claim(ctx, 'x'.repeat(8193))).rejects.toThrow(
      'INVALID',
    );
    await h.service.repairTenant({ tenantId });
  });
});

describe('editable SLA drafts and immutable published configuration', () => {
  it('edits a seeded draft with CAS, publishes it with its trusted actor, and preserves immutable history', async () => {
    const h = await seeded();
    const draft = (await h.deps.inventory.fixture(
      h.ctx,
      'sla_policy_versions',
      'enterprise-policy',
    ))!;
    const fields = {
      ...draft.fields,
      effective_until: '2027-01-01T00:00:00.000Z',
      p1_duration_seconds: 4000,
    };
    expect(
      await h.service.save({
        tenantId: h.tenantId,
        entity: 'sla_policy_versions',
        id: draft.id,
        expected: 1,
        status: 'draft',
        fields,
      }),
    ).toMatchObject({ version: 2 });
    const published = await h.service.publish({
      tenantId: h.tenantId,
      fields,
      expectedTierVersion: 1,
    });
    expect(published).toMatchObject({ id: draft.id, version: 3 });
    const row = await h.deps.inventory.get(
      h.ctx,
      'sla_policy_versions',
      draft.id,
    );
    expect(row!.fields.approved_by).toBe(h.session.accountId);
    await expect(
      h.service.save({
        tenantId: h.tenantId,
        entity: 'sla_policy_versions',
        id: draft.id,
        expected: 3,
        status: 'draft',
        fields,
      }),
    ).rejects.toThrow('INVALID');
  });
});

describe('same-tenant reference matrix', () => {
  it('denies each foreign reference across all seeded relationship kinds', async () => {
    const h = await seeded();
    const foreign = (
      await h.service.bootstrap({
        name: 'Beacon Transit',
        slug: 'beacon-transit',
      })
    ).tenantId;
    for (let offset = 0; offset < fixtures.length; offset += 4)
      await seedBatch(h.service, h.deps, { tenantId: foreign, offset });
    const foreignCtx = await h.service.context(foreign);
    for (const fixture of fixtures) {
      if (!fixture.refs) continue;
      const own = (await h.deps.inventory.fixture(
        h.ctx,
        fixture.entity,
        fixture.key,
      ))!;
      for (const [field, key] of Object.entries(fixture.refs)) {
        const definition = fixtures.find((item) => item.key === key)!;
        const other = (await h.deps.inventory.fixture(
          foreignCtx,
          definition.entity,
          key,
        ))!;
        await expect(
          h.service.save({
            tenantId: h.tenantId,
            entity: fixture.entity,
            fields: { ...own.fields, [field]: other.id },
            status: own.status,
          }),
        ).rejects.toThrow('INVALID');
        expect(await h.deps.inventory.pending(h.ctx)).toBeNull();
      }
    }
  });
});
