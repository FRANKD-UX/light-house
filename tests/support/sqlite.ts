// Local relational simulation ONLY. Rewrites MySQL DDL/upserts for SQLite.
// This does not establish TiDB / Forge SQL query-policy or runtime compatibility.
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import { migrations } from '../../src/infrastructure/sql/migrations';
import type { SqlDriver } from '../../src/infrastructure/sql/driver';
import { SqlAccessRepository } from '../../src/infrastructure/sql/access-repository';
import { SqlInventoryRepository } from '../../src/infrastructure/sql/inventory-repository';
import { InventoryService } from '../../src/application/inventory/service';
import { InventoryError, type Scalar } from '../../src/domain/inventory/model';
export function database() {
  const sqlite = new DatabaseSync(':memory:');
  for (const migration of migrations)
    sqlite.exec(
      migration.ddl
        .replace(/ CHARACTER SET utf8mb4 COLLATE utf8mb4_bin/g, '')
        .replace(/,\s*INDEX \w+ \([^)]*\)/g, '')
        .replace(/UNIQUE KEY \w+/g, 'UNIQUE'),
    );
  const statements: { query: string; params: Scalar[] }[] = [];
  let failQuery = '';
  const db: SqlDriver = {
    async rows<T>(query: string, params: Scalar[]) {
      statements.push({ query, params });
      return sqlite.prepare(query).all(...params) as T[];
    },
    async write(query, params) {
      statements.push({ query, params });
      if (failQuery && query.includes(failQuery)) {
        failQuery = '';
        throw new InventoryError('UNAVAILABLE');
      }
      let adapted = query.replace(
        /ON DUPLICATE KEY UPDATE (?:id = id|correlation_id = correlation_id)/,
        'ON CONFLICT DO NOTHING',
      );
      if (query.includes('ON DUPLICATE KEY UPDATE role'))
        adapted = query.replace(
          'ON DUPLICATE KEY UPDATE',
          'ON CONFLICT (tenant_id, account_id) DO UPDATE SET',
        );
      if (query.includes('ON DUPLICATE KEY UPDATE schema_version'))
        adapted = query.replace(
          'ON DUPLICATE KEY UPDATE',
          'ON CONFLICT (installation_id) DO UPDATE SET',
        );
      try {
        return Number(sqlite.prepare(adapted).run(...params).changes);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('UNIQUE constraint')
        )
          throw new InventoryError('CONFLICT');
        throw error;
      }
    },
  };
  const now = () => '2026-11-26T00:00:00.000Z';
  const deps = {
    inventory: new SqlInventoryRepository(db),
    access: new SqlAccessRepository(db, randomUUID, now),
    id: randomUUID,
    now,
    isJiraAdmin: vi.fn(async () => true),
    migrate: vi.fn(async () => false),
  };
  const session = {
    accountId: 'consenting-test-account',
    installationId: 'installation-example',
    environment: 'DEVELOPMENT',
  };
  const service = new InventoryService(deps, session);
  async function ready() {
    await db.write('INSERT INTO installation_metadata VALUES (?, ?, ?, ?, ?)', [
      session.installationId,
      session.environment,
      1,
      'ready',
      now(),
    ]);
  }
  async function setup() {
    await ready();
    return (
      await service.bootstrap({ name: 'Lantern Fibre', slug: 'lantern-fibre' })
    ).tenantId;
  }
  return {
    db,
    sqlite,
    statements,
    deps,
    session,
    service,
    ready,
    setup,
    failNext: (match: string) => {
      failQuery = match;
    },
  };
}
