import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { database } from '../support/sqlite';
import { migrations } from '../../src/infrastructure/sql/migrations';
import { fixtures } from '../../src/application/inventory/fixtures';
import { seedBatch } from '../../src/application/inventory/seed';
describe('SQL contracts (local adapted SQLite, not Forge runtime)', () => {
  it('pins immutable initial DDL, ordering and Sprint 1 table scope', () => {
    expect(
      createHash('sha256')
        .update(readFileSync('src/infrastructure/sql/migrations.v001.json'))
        .digest('hex'),
    ).toBe('f868b21682183cb04d195687aa86934e0f89b941e1d4a480878bc18fbfb94f91');
    expect(migrations.map((m) => m.name)).toEqual(
      [
        'installation_metadata',
        'isp_tenants',
        'tenant_memberships',
        'sites',
        'carriers',
        'uplinks',
        'customers',
        'customer_services',
        'service_dependencies',
        'teams',
        'assignees',
        'team_memberships',
        'sla_tiers',
        'sla_policy_versions',
        'mutation_receipts',
      ].map((name) => 'v001_' + name),
    );
    for (const m of migrations) expect(m.ddl).toContain('utf8mb4_bin');
  });
  it('binds injection-like labels as values, scopes SQL predicates and bounds result pages', async () => {
    const h = database();
    const tenantId = await h.setup();
    const injected = "Synthetic ' OR 1=1 --";
    const saved = await h.service.save({
      tenantId,
      entity: 'sites',
      status: 'active',
      fields: { code: 'demo', display_name: injected },
    });
    await h.service.save({
      tenantId,
      entity: 'sites',
      id: saved.id,
      expected: 1,
      status: 'maintenance',
      fields: { code: 'demo', display_name: injected },
    });
    await h.service.list({ tenantId, entity: 'sites', after: '', limit: 50 });
    for (const statement of h.statements) {
      expect(statement.query).not.toContain(injected);
      expect((statement.query.match(/\?/g) ?? []).length).toBe(
        statement.params.length,
      );
    }
    expect(h.statements.some((s) => s.params.includes(injected))).toBe(true);
    for (const statement of h.statements.filter((s) =>
      /^(SELECT .* FROM sites|UPDATE sites)/.test(s.query),
    )) {
      expect(statement.query).toContain('tenant_id = ?');
      expect(statement.params).toContain(tenantId);
    }
    const list = h.statements.find((s) =>
      s.query.includes('ORDER BY id LIMIT'),
    );
    expect(list?.query).toMatch(/ORDER BY id LIMIT 51$/);
    expect(list?.params).toEqual([tenantId, '']);
  });
  it('bounds membership enumeration and rejects readiness from another installation/environment/version', async () => {
    const h = database();
    await h.setup();
    expect(
      await h.deps.access.ready({ ...h.session, installationId: 'other' }),
    ).toBe(false);
    expect(
      await h.deps.access.ready({ ...h.session, environment: 'PRODUCTION' }),
    ).toBe(false);
    h.sqlite
      .prepare('UPDATE installation_metadata SET schema_version = ?')
      .run(9);
    expect(await h.deps.access.ready(h.session)).toBe(false);
    vi.spyOn(h.db, 'rows').mockResolvedValueOnce(Array(51).fill({}));
    await expect(h.deps.access.memberships(h.session)).rejects.toThrow(
      'INVALID',
    );
  });
  it('keeps seed execution and reruns within a fixed query budget without rerun writes', async () => {
    const h = database();
    const tenantId = await h.setup();
    h.statements.length = 0;
    for (let offset = 0; offset < fixtures.length; offset += 4)
      await seedBatch(h.service, h.deps, { tenantId, offset });
    const initial = h.statements.length;
    expect(initial).toBeLessThan(1000);
    h.statements.length = 0;
    for (let offset = 0; offset < fixtures.length; offset += 4)
      await seedBatch(h.service, h.deps, { tenantId, offset });
    expect(h.statements.length).toBeLessThan(150);
    expect(h.statements.every((s) => s.query.startsWith('SELECT'))).toBe(true);
  });
});
