import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
const mocks = vi.hoisted(() => ({
  runtime: {
    environmentType: 'DEVELOPMENT',
    installationAri: { toString: () => 'installation-example' },
  },
  request: vi.fn(),
  push: vi.fn(),
  run: vi.fn(),
  list: vi.fn(),
  enqueue: vi.fn(),
  rows: vi.fn(),
  write: vi.fn(),
  ddl: vi.fn(),
}));
vi.mock('@forge/api', () => ({
  default: { asUser: () => ({ requestJira: mocks.request }) },
  route: (strings: TemplateStringsArray) => strings.join(''),
  getAppContext: () => mocks.runtime,
}));
vi.mock('@forge/events', () => ({
  Queue: class {
    push = mocks.push;
  },
}));
vi.mock('@forge/sql', () => {
  const runner = { enqueue: vi.fn(), run: mocks.run, list: mocks.list };
  runner.enqueue.mockReturnValue(runner);
  return { default: { executeDDL: mocks.ddl }, migrationRunner: runner };
});
vi.mock('../../src/infrastructure/sql/driver', () => ({
  forgeSql: { rows: mocks.rows, write: mocks.write },
}));
// enqueue returns the same runner at module evaluation.

import {
  inventoryRequest,
  isJiraAdmin,
} from '../../src/forge/inventory/boundary';
import {
  enqueueMigration,
  migrateInstallation,
} from '../../src/forge/inventory/migration';
import { migrations } from '../../src/infrastructure/sql/migrations';
import { database } from '../support/sqlite';
const ctx = { accountId: 'consenting-test-account' };
beforeEach(() => {
  mocks.runtime.environmentType = 'DEVELOPMENT';
  mocks.request.mockResolvedValue({
    ok: true,
    json: async () => ({
      permissions: {
        ADMINISTER: { key: 'ADMINISTER', type: 'GLOBAL', havePermission: true },
      },
    }),
  });
  mocks.rows.mockResolvedValue([]);
  mocks.write.mockResolvedValue(1);
  mocks.run.mockResolvedValue([]);
  mocks.list.mockResolvedValue(migrations.map((row) => ({ name: row.name })));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
describe('Forge inventory boundary (mock SDK; not runtime evidence)', () => {
  it('fails closed for missing trusted account, unknown action, raw errors and permission responses', async () => {
    expect(
      await inventoryRequest(
        {},
        { action: 'overview', accountId: 'fake', isAdmin: true },
      ),
    ).toMatchObject({ ok: false, code: 'INVALID' });
    expect(await inventoryRequest(ctx, { action: 'arbitrary' })).toMatchObject({
      ok: false,
      code: 'INVALID',
    });
    expect(await inventoryRequest(ctx, null)).toMatchObject({
      ok: false,
      code: 'INVALID',
    });
    for (const response of [
      { ok: false },
      { ok: true, json: async () => null },
      {
        ok: true,
        json: async () => ({
          permissions: {
            ADMINISTER: {
              key: 'ADMINISTER',
              type: 'PROJECT',
              havePermission: true,
            },
          },
        }),
      },
    ]) {
      mocks.request.mockResolvedValue(response);
      expect(await isJiraAdmin()).toBe(false);
    }
    mocks.request.mockRejectedValue(new Error('private secret'));
    expect(await isJiraAdmin()).toBe(false);
    mocks.rows.mockRejectedValue(new Error('raw query secret'));
    expect(await inventoryRequest(ctx, { action: 'overview' })).toMatchObject({
      ok: true,
      value: { ready: false, tenants: [] },
    });
    mocks.write.mockRejectedValue(new Error('raw query secret'));
    mocks.rows.mockResolvedValue([{ readiness: 'ready', schema_version: 1 }]);
    mocks.request.mockResolvedValue({
      ok: true,
      json: async () => ({
        permissions: {
          ADMINISTER: {
            key: 'ADMINISTER',
            type: 'GLOBAL',
            havePermission: true,
          },
        },
      }),
    });
    const result = await inventoryRequest(ctx, {
      action: 'bootstrap',
      name: 'Demo',
      slug: 'demo',
    });
    expect(result).toMatchObject({ ok: false, code: 'UNAVAILABLE' });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(console.error).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      'secret',
    );
  });
  it('dispatches authorised operations through server-derived identity and rejects payload claims', async () => {
    const h = database();
    mocks.rows.mockImplementation(h.db.rows);
    mocks.write.mockImplementation(h.db.write);
    await h.ready();
    const boot = await inventoryRequest(ctx, {
      action: 'bootstrap',
      name: 'Lantern Fibre',
      slug: 'lantern-fibre',
    });
    const tenantId = (boot as { value: { tenantId: string } }).value.tenantId;
    expect(await inventoryRequest(ctx, { action: 'migrate' })).toMatchObject({
      ok: true,
      value: { ready: false },
    });
    expect(mocks.push).toHaveBeenCalledWith(
      expect.objectContaining({
        concurrency: { key: 'light-house-schema-v1', limit: 1 },
      }),
    );
    expect(await inventoryRequest(ctx, { action: 'overview' })).toMatchObject({
      ok: true,
      value: { ready: true, canBootstrap: true },
    });
    const saved = await inventoryRequest(ctx, {
      action: 'save',
      tenantId,
      entity: 'sites',
      fields: { code: 'test', display_name: 'Test' },
      status: 'active',
    });
    const id = (saved as { value: { id: string } }).value.id;
    expect(
      await inventoryRequest(ctx, {
        action: 'list',
        tenantId,
        entity: 'sites',
        after: '',
        limit: 1,
      }),
    ).toMatchObject({ ok: true });
    expect(
      await inventoryRequest(ctx, {
        action: 'repair',
        tenantId,
        entity: 'sites',
        id,
      }),
    ).toMatchObject({ ok: true });
    expect(
      await inventoryRequest(ctx, {
        action: 'grant',
        tenantId,
        accountId: 'second-consenting-account',
        role: 'viewer',
        expected: null,
        status: 'active',
        expiresAt: null,
      }),
    ).toMatchObject({ ok: true });
    expect(
      await inventoryRequest(ctx, { action: 'seed', tenantId, offset: 0 }),
    ).toMatchObject({ ok: true, value: { next: 4 } });
    expect(
      await inventoryRequest(ctx, { action: 'publish', tenantId, fields: {} }),
    ).toMatchObject({ ok: false, code: 'INVALID' });
    expect(
      await inventoryRequest(
        { accountId: 'stranger' },
        {
          action: 'save',
          tenantId,
          isAdmin: true,
          accountId: ctx.accountId,
          entity: 'sites',
          fields: { code: 'evil', display_name: 'No' },
          status: 'active',
        },
      ),
    ).toMatchObject({ ok: false, code: 'DENIED' });
  });
  it('queues a single serialized development migration and verifies all checkpoints before readiness', async () => {
    expect(migrations).toHaveLength(15);
    expect(new Set(migrations.map((m) => m.name)).size).toBe(15);
    for (const migration of migrations) {
      expect(migration.ddl).toContain('CREATE TABLE IF NOT EXISTS');
      expect(migration.ddl).not.toMatch(/FOREIGN KEY|DROP |AUTO_INCREMENT/);
    }
    await enqueueMigration({
      installationId: 'installation-example',
      environment: 'DEVELOPMENT',
      accountId: 'test',
    });
    expect(mocks.push).toHaveBeenCalledWith({
      body: { installationId: 'installation-example' },
      concurrency: { key: 'light-house-schema-v1', limit: 1 },
    });
    await migrateInstallation({
      body: { installationId: 'installation-example' },
    });
    expect(mocks.run).toHaveBeenCalledTimes(1);
    expect(mocks.write).toHaveBeenCalledWith(
      expect.stringContaining('installation_metadata'),
      expect.arrayContaining(['ready', 1]),
    );
    mocks.list.mockResolvedValue([]);
    await expect(
      migrateInstallation({ body: { installationId: 'installation-example' } }),
    ).rejects.toThrow('NOT_READY');
    for (const event of [
      null,
      {},
      { body: null },
      { body: {} },
      { body: { installationId: 'foreign' } },
    ])
      await expect(migrateInstallation(event)).rejects.toThrow();
    mocks.runtime.environmentType = 'PRODUCTION';
    await expect(
      migrateInstallation({ body: { installationId: 'installation-example' } }),
    ).rejects.toThrow('DENIED');
  });
  it('leaves readiness unset on failed DDL and permits safe retry', async () => {
    mocks.run.mockRejectedValueOnce(new Error('transient DDL'));
    await expect(
      migrateInstallation({ body: { installationId: 'installation-example' } }),
    ).rejects.toThrow();
    expect(mocks.write).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['failed']),
    );
    await migrateInstallation({
      body: { installationId: 'installation-example' },
    });
    expect(mocks.write).toHaveBeenCalled();
  });
  it('dispatches development probe and versioned tenant configuration', async () => {
    const h = database();
    mocks.rows.mockImplementation(h.db.rows);
    mocks.write.mockImplementation(h.db.write);
    const tenantId = await h.setup();
    expect(
      await inventoryRequest(ctx, { action: 'repairProbe', tenantId }),
    ).toMatchObject({ ok: false, code: 'REPAIR_REQUIRED' });
    expect(
      await inventoryRequest(ctx, { action: 'repairTenant', tenantId }),
    ).toMatchObject({ ok: true });
    expect(
      await inventoryRequest(ctx, {
        action: 'configureTenant',
        tenantId,
        name: 'Demo',
        status: 'active',
        expected: 2,
      }),
    ).toMatchObject({ ok: true, value: { version: 3 } });
  });
  it('bounds migration retries and fails closed if recording failure also fails', async () => {
    await migrateInstallation({
      body: { installationId: 'installation-example' },
      retryContext: { retryCount: 3 },
    });
    expect(mocks.run).not.toHaveBeenCalled();
    mocks.run.mockRejectedValueOnce(new Error('private'));
    mocks.write.mockRejectedValue(new Error('private'));
    await expect(
      migrateInstallation({
        body: { installationId: 'installation-example' },
        retryContext: { retryCount: 1 },
      }),
    ).rejects.toThrow('NOT_READY');
  });
  it('denies cross-tenant mutation independently of client installation claims', async () => {
    const h = database();
    mocks.rows.mockImplementation(h.db.rows);
    mocks.write.mockImplementation(h.db.write);
    const tenantId = await h.setup();
    expect(
      await inventoryRequest(
        { accountId: 'stranger' },
        {
          action: 'repair',
          tenantId,
          id: randomUUID(),
          entity: 'sites',
          installationId: 'installation-example',
          role: 'admin',
        },
      ),
    ).toMatchObject({ ok: false, code: 'DENIED' });
  });
});
