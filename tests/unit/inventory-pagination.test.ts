import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { kinds, type Scalar } from '../../src/domain/inventory/model';
import type { TenantContext } from '../../src/application/ports/tenant-context';
import {
  noInventoryDiagnostics,
  type InventoryDiagnostics,
  type InventoryStage,
} from '../../src/application/ports/inventory-diagnostics';
import { SqlInventoryRepository } from '../../src/infrastructure/sql/inventory-repository';

const ctx: TenantContext = {
  installationId: 'installation-example',
  tenantId: randomUUID(),
  actor: { kind: 'system' },
};

describe('inventory pagination SQL construction (mock driver, not Forge runtime)', () => {
  for (const entity of kinds) {
    it(`${entity}: renders bounded decimal limits and binds tenant then cursor`, async () => {
      const db = {
        rows: vi.fn<(query: string, params: Scalar[]) => Promise<never[]>>(
          async () => [],
        ),
        write: vi.fn(),
      };
      const recordStage = vi.fn<(stage: InventoryStage) => void>();
      const diagnostic: InventoryDiagnostics = {
        run<T>(stage: InventoryStage, work: () => T | Promise<T>): Promise<T> {
          recordStage(stage);
          return noInventoryDiagnostics.run(stage, work);
        },
      };
      const repo = new SqlInventoryRepository(db, diagnostic);
      for (const limit of [1, 21, 51]) {
        for (const after of ['', randomUUID(), "' OR 1=1 --"]) {
          expect(await repo.list(ctx, entity, after, limit)).toEqual([]);
          const [query, params] = db.rows.mock.lastCall!;
          expect(query).toBe(
            `SELECT * FROM ${entity} WHERE tenant_id = ? AND id > ? ORDER BY id LIMIT ${limit}`,
          );
          expect(params).toEqual([ctx.tenantId, after]);
          expect(query.match(/\?/g)).toHaveLength(params.length);
          if (after) expect(query).not.toContain(after);
        }
      }
      expect(recordStage.mock.calls.map(([stage]) => stage)).toEqual(
        Array.from({ length: 9 }, () => [
          'inventory.query',
          'inventory.sql',
          'inventory.mapping',
        ]).flat(),
      );
    });
    it(`${entity}: rejects invalid and injection-shaped limits before SQL`, async () => {
      const db = { rows: vi.fn(async () => []), write: vi.fn() };
      const repo = new SqlInventoryRepository(db);
      const coercion = vi.fn(() => 1);
      for (const limit of [
        0,
        -1,
        1.5,
        52,
        NaN,
        Infinity,
        -Infinity,
        Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER + 1,
        '1',
        '21; DROP TABLE sites; --',
        '1 OR 1=1',
        null,
        undefined,
        true,
        false,
        {},
        [],
        [1],
        1n,
        Symbol('limit'),
        { valueOf: coercion, toString: coercion },
      ]) {
        await expect(repo.list(ctx, entity, '', limit)).rejects.toThrow(
          'INVALID',
        );
      }
      expect(db.rows).not.toHaveBeenCalled();
      expect(db.write).not.toHaveBeenCalled();
      expect(coercion).not.toHaveBeenCalled();
    });
  }
});
