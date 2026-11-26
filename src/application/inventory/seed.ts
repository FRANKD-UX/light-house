import { fixtures } from './fixtures';
import {
  integer,
  InventoryError,
  object,
  type Fields,
} from '../../domain/inventory/model';
import type { InventoryDependencies } from './ports';
import type { InventoryService } from './service';
export async function seedBatch(
  service: InventoryService,
  deps: InventoryDependencies,
  input: unknown,
) {
  if (service.session.environment !== 'DEVELOPMENT')
    throw new InventoryError('DENIED');
  const data = object(input);
  const ctx = await service.context(data.tenantId, 'configure');
  if (await deps.inventory.pending(ctx)) await service.repairTenant(data);
  const start = data.offset === 0 ? 0 : integer(data.offset, fixtures.length);
  const end = Math.min(start + 4, fixtures.length);
  for (const fixture of fixtures.slice(start, end)) {
    const existing = await deps.inventory.fixture(
      ctx,
      fixture.entity,
      fixture.key,
    );
    if (existing) {
      if (existing.pending)
        await deps.inventory.materialise(ctx, fixture.entity, existing);
      continue;
    }
    const fields: Fields = { ...fixture.fields };
    for (const [field, key] of Object.entries(fixture.refs ?? {})) {
      const referenced = fixtures.find((item) => item.key === key);
      if (!referenced) throw new InventoryError('INVALID');
      const row = await deps.inventory.fixture(ctx, referenced.entity, key);
      if (!row || row.pending) throw new InventoryError('NOT_READY');
      fields[field] = row.id;
    }
    await service.save(
      {
        tenantId: ctx.tenantId,
        entity: fixture.entity,
        status: fixture.status,
        fields,
      },
      fixture.key,
    );
  }
  return {
    processed: end,
    total: fixtures.length,
    next: end < fixtures.length ? end : null,
  };
}
