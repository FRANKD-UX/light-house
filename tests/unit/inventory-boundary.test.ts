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
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
describe('Forge inventory boundary (mock SDK; not runtime evidence)', () => {
  it.each(['membership', 'inventory'] as const)(
    'attributes a %s SELECT exception without changing the sanitised response or writing',
    async (stage) => {
      const tenantId = randomUUID();
      mocks.rows.mockResolvedValueOnce([
        { readiness: 'ready', schema_version: 1 },
      ]);
      if (stage === 'inventory')
        mocks.rows.mockResolvedValueOnce([{ role: 'admin' }]);
      mocks.rows.mockRejectedValueOnce({
        code: 'SQL_EXECUTION_ERROR',
        context: { debug: { code: 'ER_PARSE_ERROR' } },
        message: 'synthetic-private-error',
      });
      const result = await inventoryRequest(ctx, {
        action: 'list',
        tenantId,
        entity: 'sites',
        after: '',
        limit: 20,
      });
      expect(result).toEqual({
        ok: false,
        code: 'UNAVAILABLE',
        correlationId: expect.any(String),
      });
      const log = JSON.parse(
        vi.mocked(console.error).mock.lastCall![0] as string,
      );
      expect(log).toEqual({
        event: 'processing.failed',
        correlationId: result.correlationId,
        outcome: 'failure',
      });
      const diagnostics = vi
        .mocked(console.error)
        .mock.calls.map(([line]) => JSON.parse(line as string))
        .filter((event) => event.event === 'inventory.diagnostic');
      expect(diagnostics[0]).toMatchObject({
        stage: stage === 'membership' ? 'tenant.membership' : 'inventory.sql',
        outcome: 'failure',
        exceptionCategory: 'SQL_ERROR',
        errorCode: 'SQL_EXECUTION_ERROR',
        providerCode: 'ER_PARSE_ERROR',
        correlationId: result.correlationId,
      });
      const allLogs = [
        ...vi.mocked(console.info).mock.calls,
        ...vi.mocked(console.error).mock.calls,
      ].map(([line]) => JSON.parse(line as string));
      expect(
        allLogs.every((event) => event.correlationId === result.correlationId),
      ).toBe(true);
      expect(JSON.stringify([result, allLogs])).not.toMatch(
        /synthetic-private-error|installation-example|consenting-test-account/,
      );
      expect(JSON.stringify(allLogs)).not.toContain(tenantId);
      expect(mocks.rows).toHaveBeenCalledTimes(stage === 'inventory' ? 3 : 2);
      expect(mocks.write).not.toHaveBeenCalled();
      expect(mocks.run).not.toHaveBeenCalled();
      expect(mocks.push).not.toHaveBeenCalled();
    },
  );
  it.each(['mapping', 'serialization'] as const)(
    'distinguishes %s failures (mock SQL)',
    async (stage) => {
      mocks.rows.mockResolvedValueOnce([
        { readiness: 'ready', schema_version: 1 },
      ]);
      mocks.rows.mockResolvedValueOnce([{ role: 'admin' }]);
      mocks.rows.mockResolvedValueOnce(
        stage === 'mapping' ? [null] : [{ version: BigInt(1) }],
      );
      const result = await inventoryRequest(ctx, {
        action: 'list',
        tenantId: randomUUID(),
        entity: 'sites',
        after: '',
        limit: 20,
      });
      expect(result).toMatchObject({ ok: false, code: 'UNAVAILABLE' });
      const failures = vi
        .mocked(console.error)
        .mock.calls.map(([line]) => JSON.parse(line as string))
        .filter((event) => event.event === 'inventory.diagnostic');
      expect(failures[0]).toMatchObject({
        stage:
          stage === 'mapping' ? 'inventory.mapping' : 'response.serialization',
        exceptionCategory: 'TYPE_ERROR',
        correlationId: result.correlationId,
      });
      expect(mocks.write).not.toHaveBeenCalled();
    },
  );
  it('retains readiness failure attribution even though the repository fails closed', async () => {
    mocks.rows.mockRejectedValueOnce({
      code: 'SQL_POLICY_VIOLATION',
      message: 'private',
    });
    expect(
      await inventoryRequest(ctx, {
        action: 'list',
        tenantId: randomUUID(),
        entity: 'sites',
        after: '',
        limit: 20,
      }),
    ).toMatchObject({ ok: false, code: 'NOT_READY' });
    expect(
      vi
        .mocked(console.error)
        .mock.calls.map(([line]) => JSON.parse(line as string)),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: 'schema.sql',
          outcome: 'failure',
          errorCode: 'SQL_POLICY_VIOLATION',
        }),
      ]),
    );
    expect(mocks.rows).toHaveBeenCalledTimes(1);
  });
  it('does not let diagnostic labels or spoofed membership bypass tenant authorisation', async () => {
    mocks.rows.mockResolvedValueOnce([
      { readiness: 'ready', schema_version: 1 },
    ]);
    mocks.rows.mockResolvedValueOnce([]);
    const result = await inventoryRequest(ctx, {
      action: 'list',
      tenantId: randomUUID(),
      entity: 'sites',
      after: '',
      limit: 20,
      role: 'admin',
      diagnostic: true,
      installationId: 'foreign',
    });
    expect(result).toMatchObject({ ok: false, code: 'DENIED' });
    expect(mocks.rows).toHaveBeenCalledTimes(2);
    expect(mocks.rows.mock.calls[1]![1]).toContain('installation-example');
    expect(mocks.rows.mock.calls[1]![1]).not.toContain('foreign');
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('preserves successful empty inventory and completes the same correlation', async () => {
    mocks.rows.mockResolvedValueOnce([
      { readiness: 'ready', schema_version: 1 },
    ]);
    mocks.rows.mockResolvedValueOnce([{ role: 'viewer' }]);
    const result = await inventoryRequest(ctx, {
      action: 'list',
      tenantId: randomUUID(),
      entity: 'sites',
      after: '',
      limit: 20,
    });
    expect(result).toEqual({
      ok: true,
      value: { rows: [], next: null },
      correlationId: expect.any(String),
    });
    expect(
      vi
        .mocked(console.info)
        .mock.calls.map(([line]) => JSON.parse(line as string)),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: 'resolver.completion',
          outcome: 'success',
          correlationId: result.correlationId,
        }),
      ]),
    );
    expect(console.error).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('authorises fixed development diagnostics without readiness or tenant membership', async () => {
    mocks.rows.mockResolvedValue([{ readiness: 'failed', schema_version: 0 }]);
    expect(
      await inventoryRequest(ctx, { action: 'schemaDiagnostics' }),
    ).toMatchObject({
      ok: true,
      value: {
        environment: 'DEVELOPMENT',
        readinessRecordPresent: true,
        readiness: 'failed',
        schemaVersion: 0,
        schemaVersionType: 'number',
        missingMigrationNames: [],
      },
    });
    expect(mocks.rows).toHaveBeenCalledExactlyOnceWith(
      'SELECT readiness, schema_version FROM installation_metadata WHERE installation_id = ? AND environment = ?',
      ['installation-example', 'DEVELOPMENT'],
    );
    expect(mocks.list).toHaveBeenCalledTimes(1);
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.ddl).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it('denies diagnostic spoofing, non-admins, missing identity and non-development before SQL', async () => {
    for (const environment of ['STAGING', 'PRODUCTION']) {
      mocks.runtime.environmentType = environment;
      expect(
        await inventoryRequest(ctx, { action: 'schemaDiagnostics' }),
      ).toMatchObject({ ok: false, code: 'DENIED' });
    }
    mocks.runtime.environmentType = 'DEVELOPMENT';
    expect(
      await inventoryRequest(
        {},
        { action: 'schemaDiagnostics', accountId: 'fake' },
      ),
    ).toMatchObject({ ok: false });
    for (const extra of [
      { installationId: 'foreign' },
      { environment: 'DEVELOPMENT' },
      { sql: 'SELECT secret' },
      { tenantId: 'foreign' },
    ]) {
      expect(
        await inventoryRequest(ctx, { action: 'schemaDiagnostics', ...extra }),
      ).toMatchObject({ ok: false, code: 'INVALID' });
    }
    mocks.request.mockRejectedValueOnce(new Error('private'));
    expect(
      await inventoryRequest(ctx, { action: 'schemaDiagnostics' }),
    ).toMatchObject({ ok: false, code: 'DENIED' });
    mocks.request.mockResolvedValue({
      ok: true,
      json: async () => ({
        permissions: {
          ADMINISTER: {
            key: 'ADMINISTER',
            type: 'GLOBAL',
            havePermission: false,
          },
        },
      }),
    });
    expect(
      await inventoryRequest(ctx, { action: 'schemaDiagnostics' }),
    ).toMatchObject({ ok: false, code: 'DENIED' });
    expect(mocks.rows).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
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
