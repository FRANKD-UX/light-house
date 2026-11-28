import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { database } from '../support/sqlite';
import { seedBatch } from '../../src/application/inventory/seed';
import { fixtures } from '../../src/application/inventory/fixtures';
import { kinds } from '../../src/domain/inventory/model';
import { InventoryService } from '../../src/application/inventory/service';

describe('inventory pagination (local SQLite simulation, not native Forge SQL)', () => {
  it('retrieves persisted first/subsequent/empty pages for every kind without crossing tenants', async () => {
    const h = database();
    const tenantId = await h.setup();
    const other = (
      await h.service.bootstrap({
        name: 'Beacon Transit',
        slug: 'beacon-transit',
      })
    ).tenantId;
    for (const target of [tenantId, other])
      for (let offset = 0; offset < fixtures.length; offset += 4)
        await seedBatch(h.service, h.deps, { tenantId: target, offset });
    const ctx = await h.service.context(tenantId);
    for (const entity of kinds) {
      const expected = await h.deps.inventory.list(ctx, entity, '', 51);
      expect(expected.length).toBeGreaterThan(0);
      const seen: string[] = [];
      let after = '';
      for (let pageIndex = 0; pageIndex < expected.length; pageIndex++) {
        const page = await h.service.list({
          tenantId,
          entity,
          after,
          limit: 1,
        });
        expect(page.rows).toHaveLength(1);
        expect(page.rows[0]!.tenant_id).toBe(tenantId);
        seen.push(page.rows[0]!.id);
        expect(page.next).toBe(
          pageIndex < expected.length - 1 ? page.rows[0]!.id : null,
        );
        after = page.rows[0]!.id;
      }
      expect(seen).toEqual(expected.map((row) => row.id));
      expect(
        await h.service.list({ tenantId, entity, after, limit: 50 }),
      ).toEqual({ rows: [], next: null });
    }
    const denied = new InventoryService(h.deps, {
      ...h.session,
      accountId: 'ungranted-example',
    });
    const foreignInstallation = new InventoryService(h.deps, {
      ...h.session,
      installationId: 'other-installation',
    });
    const list = vi.spyOn(h.deps.inventory, 'list');
    for (const entity of kinds) {
      await expect(
        denied.list({ tenantId, entity, after: '', limit: 50 }),
      ).rejects.toThrow('DENIED');
      await expect(
        foreignInstallation.list({ tenantId, entity, after: '', limit: 50 }),
      ).rejects.toThrow('NOT_READY');
    }
    expect(list).not.toHaveBeenCalled();
  });

  it('returns an empty success and uses record 51 only as lookahead at maximum page size', async () => {
    const h = database();
    const tenantId = await h.setup();
    expect(
      await h.service.list({ tenantId, entity: 'sites', after: '', limit: 50 }),
    ).toEqual({ rows: [], next: null });
    for (let index = 0; index < 51; index++)
      await h.service.save({
        tenantId,
        entity: 'sites',
        status: 'active',
        fields: { code: `site-${index}`, display_name: 'Synthetic site' },
      });
    const first = await h.service.list({
      tenantId,
      entity: 'sites',
      after: '',
      limit: 50,
    });
    expect(first.rows).toHaveLength(50);
    expect(first.next).toBe(first.rows[49]!.id);
    const last = await h.service.list({
      tenantId,
      entity: 'sites',
      after: first.next,
      limit: 50,
    });
    expect(last.rows).toHaveLength(1);
    expect(last.next).toBeNull();
    expect(
      new Set([...first.rows, ...last.rows].map((row) => row.id)).size,
    ).toBe(51);
    const calls = h.statements.filter(({ query }) =>
      query.includes('ORDER BY id LIMIT'),
    );
    expect(
      calls.every(
        ({ query, params }) =>
          query.endsWith('LIMIT 51') && params.length === 2,
      ),
    ).toBe(true);
    expect(calls.at(-1)!.params).toEqual([tenantId, first.next]);
    await expect(
      h.service.list({
        tenantId,
        entity: 'sites',
        after: "' OR 1=1 --",
        limit: 50,
      }),
    ).rejects.toThrow('INVALID');
    await expect(
      h.service.list({
        tenantId,
        entity: 'sites',
        after: randomUUID(),
        limit: 51,
      }),
    ).rejects.toThrow('INVALID');
  });
});
