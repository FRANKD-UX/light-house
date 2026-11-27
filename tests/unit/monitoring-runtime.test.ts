// Mock Forge boundary tests, not deployed integration evidence.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
const m = vi.hoisted(() => ({
  environment: 'DEVELOPMENT',
  push: vi.fn(),
  rows: vi.fn(),
  write: vi.fn(),
}));
vi.mock('@forge/api', () => ({
  getAppContext: () => ({
    environmentType: m.environment,
    installationAri: { toString: () => 'installation-example' },
  }),
  default: {},
}));
vi.mock('@forge/events', () => ({
  Queue: class {
    push = m.push;
  },
}));
vi.mock('../../src/infrastructure/sql/driver', () => ({
  forgeSql: { rows: m.rows, write: m.write },
}));
import { InventoryService } from '../../src/application/inventory/service';
import * as migration from '../../src/infrastructure/sql/monitoring-migrations';
import { monitoringFixture } from '../support/monitoring';
import { createMonitoringHandlers } from '../../src/forge/monitoring/handlers';
import { MonitoringService } from '../../src/application/monitoring/service';
import { InventoryError } from '../../src/domain/inventory/model';
const secrets = { put: vi.fn(), get: vi.fn(), remove: vi.fn() };
beforeEach(() => {
  m.environment = 'DEVELOPMENT';
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it('maps static ingress outputs and sanitises failures using generated correlation IDs', async () => {
  const receive = vi.spyOn(MonitoringService.prototype, 'receive');
  const h = createMonitoringHandlers(secrets);
  for (const [output, status] of Object.entries({
    accepted: 202,
    invalid: 400,
    unauthorised: 401,
    conflict: 409,
    too_large: 413,
    method: 405,
    rate_limited: 429,
    unavailable: 503,
  })) {
    receive.mockResolvedValueOnce(
      output as Awaited<ReturnType<MonitoringService['receive']>>,
    );
    expect(await h.ingress({ private: 'never-log' })).toEqual({
      outputKey: output,
      statusCode: status,
    });
  }
  receive.mockRejectedValueOnce(new Error('private-exception'));
  expect(await h.ingress({})).toEqual({
    outputKey: 'unavailable',
    statusCode: 503,
  });
  const correlations = receive.mock.calls.map((call) => call[1]);
  expect(new Set(correlations).size).toBe(correlations.length);
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(
    /private-exception|never-log/,
  );
});
it('dispatches only known resolver operations and masks unexpected exceptions', async () => {
  const h = createMonitoringHandlers(secrets);
  for (const action of [
    'overview',
    'configure',
    'revoke',
    'map',
    'retry',
  ] as const) {
    const spy = vi
      .spyOn(MonitoringService.prototype, action)
      .mockResolvedValueOnce(undefined as never);
    expect(
      await h.request({ accountId: 'synthetic' }, { action }),
    ).toMatchObject({ ok: true });
    expect(spy).toHaveBeenCalledWith({ action });
  }
  expect(
    await h.request({ accountId: 'synthetic' }, { action: 'unknown' }),
  ).toMatchObject({ ok: false, code: 'INVALID' });
  vi.spyOn(MonitoringService.prototype, 'overview').mockRejectedValueOnce(
    new Error('private'),
  );
  expect(
    await h.request({ accountId: 'synthetic' }, { action: 'overview' }),
  ).toMatchObject({ ok: false, code: 'UNAVAILABLE' });
  expect(await h.request(null, {})).toMatchObject({
    ok: false,
    code: 'INVALID',
  });
  m.environment = 'PRODUCTION';
  expect(await h.request({}, {})).toMatchObject({ ok: false, code: 'DENIED' });
  expect(await h.ingress({})).toEqual({
    outputKey: 'unavailable',
    statusCode: 503,
  });
});
it('binds consumer jobs to the runtime installation and fails safely for invalid or failed jobs', async () => {
  const h = createMonitoringHandlers(secrets);
  const process = vi
    .spyOn(MonitoringService.prototype, 'process')
    .mockResolvedValue(undefined);
  const body = {
    installationId: 'installation-example',
    tenantId: randomUUID(),
    inboxId: randomUUID(),
  };
  await h.consume({ body });
  expect(process).toHaveBeenCalledWith(
    {
      installationId: body.installationId,
      tenantId: body.tenantId,
      actor: { kind: 'system' },
    },
    body.inboxId,
  );
  for (const value of [
    null,
    {},
    { body: { ...body, installationId: 'foreign' } },
    { body: { ...body, payload: 'forged' } },
    { body: { ...body, tenantId: 'invalid' } },
  ])
    await expect(h.consume(value)).rejects.toThrow(
      'MONITORING_WORKER_UNAVAILABLE',
    );
  expect(process).toHaveBeenCalledTimes(1);
  process.mockRejectedValueOnce(new InventoryError('UNAVAILABLE'));
  await expect(h.consume({ body })).rejects.toThrow(
    'MONITORING_WORKER_UNAVAILABLE',
  );
});
it('authorises and serialises schema requests and only executes matching DEVELOPMENT migration jobs', async () => {
  const h = createMonitoringHandlers(secrets);
  const ctx = {
    installationId: 'installation-example',
    tenantId: randomUUID(),
    actor: { kind: 'system' as const },
  };
  const auth = vi
    .spyOn(InventoryService.prototype, 'context')
    .mockResolvedValue(ctx);
  const admin = vi
    .spyOn(InventoryService.prototype, 'admin')
    .mockResolvedValue(undefined);
  m.push.mockResolvedValue(undefined);
  expect(
    await h.request(
      { accountId: 'synthetic' },
      { action: 'migrate', tenantId: ctx.tenantId },
    ),
  ).toMatchObject({ ok: true, value: { queued: true } });
  expect(auth).toHaveBeenCalledWith(ctx.tenantId, 'configure');
  expect(admin).toHaveBeenCalled();
  expect(m.push).toHaveBeenCalledWith({
    body: { installationId: ctx.installationId },
    concurrency: { key: 'light-house-monitoring-schema-v2', limit: 1 },
  });
  const migrate = vi
    .spyOn(migration, 'migrateMonitoring')
    .mockResolvedValue(undefined);
  m.rows.mockResolvedValue([{ readiness: 'ready', schema_version: 1 }]);
  await h.migrate({ body: { installationId: ctx.installationId } });
  expect(migrate).toHaveBeenCalledTimes(1);
  await h.migrate({
    body: { installationId: ctx.installationId },
    retryContext: { retryCount: 3 },
  });
  expect(migrate).toHaveBeenCalledTimes(1);
  for (const event of [
    null,
    { body: { installationId: 'foreign' } },
    { body: { installationId: ctx.installationId, tenantId: ctx.tenantId } },
  ])
    await expect(h.migrate(event)).rejects.toThrow(
      'MONITORING_MIGRATION_UNAVAILABLE',
    );
  m.rows.mockResolvedValue([]);
  await expect(
    h.migrate({ body: { installationId: ctx.installationId } }),
  ).rejects.toThrow('MONITORING_MIGRATION_UNAVAILABLE');
  admin.mockRejectedValueOnce(new InventoryError('DENIED'));
  expect(
    await h.request(
      { accountId: 'synthetic' },
      { action: 'migrate', tenantId: ctx.tenantId },
    ),
  ).toMatchObject({ ok: false, code: 'DENIED' });
  for (const action of ['recover', 'cleanup'] as const) {
    vi.spyOn(MonitoringService.prototype, action).mockResolvedValueOnce(
      {} as never,
    );
    expect(
      await h.request(
        { accountId: 'synthetic' },
        { action, tenantId: ctx.tenantId },
      ),
    ).toMatchObject({ ok: true });
  }
});
it('runs authenticated SQL-backed ingress through the actual handler assembly, and bounds worker delivery retries', async () => {
  const f = await monitoringFixture();
  m.rows.mockImplementation(f.h.db.rows);
  m.write.mockImplementation(f.h.db.write);
  vi.useFakeTimers();
  vi.setSystemTime('2026-11-26T00:00:00.000Z');
  m.push.mockResolvedValue(undefined);
  const h = createMonitoringHandlers(f.deps.secrets);
  expect(await h.ingress(f.request())).toEqual({
    outputKey: 'accepted',
    statusCode: 202,
  });
  expect(m.push).toHaveBeenCalledWith(
    expect.objectContaining({
      body: expect.objectContaining({
        installationId: f.ctx.installationId,
        tenantId: f.tenantId,
        inboxId: expect.any(String),
      }),
      concurrency: expect.objectContaining({ limit: 1 }),
    }),
  );
  const row = (await f.service.overview({ tenantId: f.tenantId })).receipts[0]!;
  const event = {
    body: {
      installationId: f.ctx.installationId,
      tenantId: f.tenantId,
      inboxId: row.id,
    },
  };
  await h.consume(event);
  expect((await f.repository.inbox(f.ctx, row.id))?.status).toBe(
    'manual_triage',
  );
  const process = vi
    .spyOn(MonitoringService.prototype, 'process')
    .mockResolvedValue('busy');
  await expect(h.consume(event)).rejects.toThrow(
    'MONITORING_WORKER_UNAVAILABLE',
  );
  const count = process.mock.calls.length;
  await h.consume({ ...event, retryContext: { retryCount: 5 } });
  expect(process).toHaveBeenCalledTimes(count);
  vi.spyOn(InventoryService.prototype, 'context').mockRejectedValueOnce(
    new InventoryError('DENIED'),
  );
  expect(
    await h.request(
      { accountId: 'stranger' },
      { action: 'overview', tenantId: f.tenantId },
    ),
  ).toMatchObject({ ok: false, code: 'DENIED' });
});
it('redacts all unapproved diagnostic properties including malicious monitoring outcome text', async () => {
  const { createStructuredLogger } =
    await import('../../src/infrastructure/observability/structured-logger');
  const sink = { info: vi.fn(), error: vi.fn() };
  createStructuredLogger(sink).info({
    event: 'monitoring.ingress',
    correlationId: randomUUID(),
    outcome: 'failure',
    monitoringResult: 'secret-value',
    secret: 'private-token',
    payload: { title: 'private-content' },
  } as unknown as import('../../src/application/ports/logger').LogRecord);
  const result = JSON.parse(sink.info.mock.calls[0]![0] as string);
  expect(result).not.toHaveProperty('monitoringResult');
  expect(JSON.stringify(result)).not.toMatch(
    /secret-value|private-token|private-content/,
  );
});
