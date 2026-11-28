// Synthetic local SQLite adaptation + in-memory secret/queue ports, NOT Forge runtime acceptance.
import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import { database } from './sqlite';
import ddl from '../../src/infrastructure/sql/migrations.v002.json';
import { SqlMonitoringRepository } from '../../src/infrastructure/sql/monitoring-repository';
import { MonitoringService } from '../../src/application/monitoring/service';
import { monitoringCrypto } from '../../src/infrastructure/monitoring/crypto';
import { ZabbixAdapter } from '../../src/infrastructure/monitoring/zabbix-adapter';
import type { SecretBinding } from '../../src/domain/monitoring/model';
import type { TenantContext } from '../../src/application/ports/tenant-context';
export async function monitoringFixture() {
  const h = database();
  const tenantId = await h.setup();
  for (const m of ddl)
    h.sqlite.exec(
      m.ddl
        .replace(/ CHARACTER SET utf8mb4 COLLATE utf8mb4_bin/g, '')
        .replace(/,\s*INDEX \w+ \([^)]*\)/g, '')
        .replace(/UNIQUE KEY \w+/g, 'UNIQUE'),
    );
  let now = '2026-11-26T00:00:00.000Z';
  await h.db.write(
    'INSERT INTO monitoring_schema_state VALUES (?, ?, ?, ?, ?)',
    [h.session.installationId, 2, 1, '[]', now],
  );
  const secrets = new Map<string, SecretBinding>();
  const jobs: { ctx: TenantContext; id: string }[] = [];
  const repository = new SqlMonitoringRepository(h.db);
  const deps = {
    repository,
    crypto: monitoringCrypto,
    now: () => now,
    id: randomUUID,
    secrets: {
      put: vi.fn(async (key: string, value: SecretBinding) => {
        secrets.set(key, value);
      }),
      get: vi.fn(async (key: string): Promise<unknown> => secrets.get(key)),
      remove: vi.fn(async (key: string) => {
        secrets.delete(key);
      }),
    },
    queue: {
      push: vi.fn(async (ctx: TenantContext, id: string) => {
        jobs.push({ ctx, id });
      }),
    },
    authorise: (tenant: unknown, permission: 'read' | 'configure') =>
      h.service.context(tenant, permission),
  };
  const service = new MonitoringService(
    deps,
    h.session.installationId,
    new ZabbixAdapter(),
  );
  const token = 'a'.repeat(43); // Synthetic only; never used against any host.
  const configured = await service.configure({
    tenantId,
    name: 'Synthetic Zabbix',
    secret: token,
  });
  const ctx = await h.service.context(tenantId);
  const event = {
    schemaVersion: 1,
    externalEventId: '100',
    problemEventId: '100',
    externalResourceId: 'trigger:1',
    kind: 'problem',
    occurredAt: now,
    severity: '4',
    title: 'Synthetic uplink problem',
  };
  function request(
    payload: unknown = event,
    headers: Record<string, string[]> = {},
  ) {
    return {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        authorization: ['Bearer ' + token],
        'x-light-house-key-id': [configured.keyId],
        'x-light-house-sent-at': [now],
        'content-type': ['application/json'],
        ...headers,
      },
      queryParameters: {},
      userPath: '',
    };
  }
  async function process() {
    for (const job of jobs.splice(0)) await service.process(job.ctx, job.id);
  }
  async function topology() {
    const save = async (
      entity: string,
      fields: Record<string, string | number | null>,
    ) =>
      (await h.service.save({ tenantId, entity, fields, status: 'active' })).id;
    const siteId = await save('sites', {
      code: 'synthetic',
      display_name: 'Synthetic POP',
    });
    const carrierId = await save('carriers', {
      code: 'synthetic',
      display_name: 'Synthetic carrier',
    });
    const uplinkId = await save('uplinks', {
      site_id: siteId,
      carrier_id: carrierId,
      code: 'primary',
      role: 'primary',
      capacity_mbps: 1000,
      protected_uplink_id: null,
    });
    await service.map({
      tenantId,
      sourceId: configured.sourceId,
      externalResourceId: 'trigger:1',
      uplinkId,
    });
    return { siteId, uplinkId };
  }
  return {
    h,
    tenantId,
    ctx,
    service,
    deps,
    repository,
    token,
    configured,
    event,
    request,
    process,
    topology,
    secrets,
    jobs,
    setNow: (value: string) => {
      now = value;
    },
  };
}
