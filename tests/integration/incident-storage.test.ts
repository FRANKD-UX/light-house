// Adapted in-memory SQLite and mocked ports only. Not Forge/TiDB/native acceptance.
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { monitoringFixture } from '../support/monitoring';
import {
  migrateIncidents,
  incidentMigrations,
} from '../../src/infrastructure/sql/incident-migrations';
import {
  SqlIncidentRepository,
  SqlIncidentInventory,
} from '../../src/infrastructure/sql/incident-repository';
import { IncidentService } from '../../src/application/incidents/service';
import type { IncidentPolicy } from '../../src/domain/incidents/model';
import type { SqlDriver } from '../../src/infrastructure/sql/driver';
async function fixture(migrate = true) {
  const f = await monitoringFixture();
  const db: SqlDriver = {
    rows: f.h.db.rows,
    write: (query, params) =>
      f.h.db.write(
        query.replace(
          'ON DUPLICATE KEY UPDATE ready = 0',
          'ON CONFLICT (installation_id) DO UPDATE SET ready = 0',
        ),
        params,
      ),
  };
  const ddl = vi.fn(async (statement: string) => {
    f.h.sqlite.exec(
      statement
        .replace(/ CHARACTER SET utf8mb4 COLLATE utf8mb4_bin/g, '')
        .replace(/,\s*INDEX \w+ \([^)]*\)/g, '')
        .replace(/UNIQUE KEY \w+/g, 'UNIQUE'),
    );
  });
  const migrateV3 = () =>
    migrateIncidents(db, ddl, f.ctx.installationId, f.deps.now);
  if (migrate) await migrateV3();
  const repository = new SqlIncidentRepository(db),
    inventory = new SqlIncidentInventory(repository);
  const service = new IncidentService({
    repository,
    inventory,
    now: f.deps.now,
    id: randomUUID,
  });
  async function topology() {
    const link = await f.topology();
    const save = async (
      entity: string,
      fields: Record<string, string | number | null>,
    ) =>
      (
        await f.h.service.save({
          tenantId: f.tenantId,
          entity,
          fields,
          status: 'active',
        })
      ).id;
    const tier = await save('sla_tiers', {
      code: 'synthetic-operational',
      name: 'Synthetic operational tier',
    });
    const customer = await save('customers', {
      reference: 'synthetic-incident',
      display_alias: 'Synthetic incident customer',
      site_id: link.siteId,
      sla_tier_id: tier,
    });
    const customerService = await save('customer_services', {
      customer_id: customer,
      site_id: link.siteId,
      tier_id: tier,
      code: 'synthetic-service',
    });
    await save('service_dependencies', {
      service_id: customerService,
      uplink_id: link.uplinkId,
      dependency_mode: 'required',
      failover_group: null,
    });
    return { ...link, tier, customer, customerService };
  }
  function policy(
    tierId: string,
    overrides: Partial<IncidentPolicy> = {},
  ): IncidentPolicy {
    return {
      id: randomUUID(),
      tenantId: f.tenantId,
      tierId,
      version: 1,
      status: 'published',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveUntil: null,
      clock: 'elapsed-utc',
      severityMap: { '4': 'P1' },
      unknownImpact: 'manual-review',
      targets: {
        P1: { durationSeconds: 60, warningSeconds: 45 },
        P2: { durationSeconds: 240, warningSeconds: 180 },
        P3: { durationSeconds: 1440, warningSeconds: 1080 },
      },
      ...overrides,
    };
  }
  return {
    ...f,
    db,
    ddl,
    migrateV3,
    repository,
    inventory,
    incidentService: service,
    topology,
    policy,
  };
}
async function readyInbox(
  f: Awaited<ReturnType<typeof fixture>>,
  payload = f.event,
) {
  expect(await f.service.receive(f.request(payload), randomUUID())).toBe(
    'accepted',
  );
  await f.process();
  const rows = await f.repository.db.rows<{ id: string }>(
    'SELECT id FROM monitoring_inbox WHERE tenant_id = ? ORDER BY id',
    [f.tenantId],
  );
  const matches = [];
  for (const row of rows) {
    const entry = await f.repository.inbox(f.ctx, row.id);
    if (
      entry?.event.externalEventId === payload.externalEventId &&
      entry.event.kind === payload.kind
    )
      matches.push(entry);
  }
  expect(matches).toHaveLength(1);
  return matches[0]!;
}
describe('incident v003 SQL adapter simulation', () => {
  it('fails closed rather than enriching a truncated inventory snapshot', async () => {
    const f = await fixture();
    const t = await f.topology();
    const insert = f.h.sqlite.prepare(
      'INSERT INTO sites (tenant_id, id, status, version, created_at, updated_at, fixture_key, pending, code, display_name) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)',
    );
    for (let index = 0; index < 1001; index++)
      insert.run(
        f.tenantId,
        randomUUID(),
        'active',
        1,
        f.event.occurredAt,
        f.event.occurredAt,
        'synthetic-overflow-' + index,
        'Synthetic overflow',
      );
    await expect(f.inventory.load(f.ctx, t.uplinkId)).rejects.toThrow(
      'NOT_READY',
    );
    expect(
      f.h.sqlite.prepare('SELECT COUNT(*) AS total FROM incidents').get(),
    ).toMatchObject({ total: 0 });
  });
  it('concurrent first policy publications converge through single-row CAS', async () => {
    const f = await fixture();
    const t = await f.topology();
    const results = await Promise.all([
      f.repository.publishPolicy(f.ctx, f.policy(t.tier), 0),
      f.repository.publishPolicy(f.ctx, f.policy(t.tier), 0),
    ]);
    expect(results.sort()).toEqual([false, true]);
    expect(await f.repository.policies(f.ctx)).toHaveLength(1);
  });
  it('rejects malformed persisted policy and inbox contracts without accepting partial projection', async () => {
    const f = await fixture();
    const t = await f.topology();
    await f.repository.publishPolicy(f.ctx, f.policy(t.tier), 0);
    f.h.sqlite
      .prepare('UPDATE incident_policies SET policies_json = ?')
      .run('[null]');
    await expect(f.repository.policies(f.ctx)).rejects.toThrow('INVALID');
    const entry = await readyInbox(f);
    f.h.sqlite
      .prepare('UPDATE monitoring_inbox SET event_json = ? WHERE id = ?')
      .run(JSON.stringify({ ...f.event, kind: 'closed' }), entry.inboxId);
    await expect(f.repository.inbox(f.ctx, entry.inboxId)).rejects.toThrow(
      'INVALID',
    );
  });

  it('requires prior v002 readiness and resumes additive checkpoint failures without changing v001/v002', async () => {
    const f = await fixture(false);
    f.h.sqlite.prepare('UPDATE monitoring_schema_state SET ready = 0').run();
    await expect(f.migrateV3()).rejects.toThrow('NOT_READY');
    expect(f.ddl).not.toHaveBeenCalled();
    f.h.sqlite.prepare('UPDATE monitoring_schema_state SET ready = 1').run();
    const original = f.ddl.getMockImplementation()!;
    let calls = 0;
    f.ddl.mockImplementation(async (query) => {
      if (++calls === 3) throw new Error('synthetic DDL interruption');
      await original(query);
    });
    await expect(f.migrateV3()).rejects.toThrow('synthetic DDL interruption');
    expect(await f.repository.ready(f.ctx.installationId)).toBe(false);
    f.ddl.mockImplementation(original);
    f.ddl.mockClear();
    await f.migrateV3();
    expect(f.ddl.mock.calls.map(([query]) => query)).not.toContain(
      incidentMigrations[1]!.ddl,
    );
    expect(await f.repository.ready(f.ctx.installationId)).toBe(true);
    expect(
      f.h.sqlite
        .prepare('SELECT schema_version, readiness FROM installation_metadata')
        .get(),
    ).toMatchObject({ schema_version: 1, readiness: 'ready' });
    expect(
      f.h.sqlite
        .prepare('SELECT schema_version, ready FROM monitoring_schema_state')
        .get(),
    ).toMatchObject({ schema_version: 2, ready: 1 });
    f.ddl.mockClear();
    await f.migrateV3();
    expect(f.ddl).toHaveBeenCalledTimes(1);
    f.h.sqlite
      .prepare('UPDATE incident_schema_state SET checkpoints = ?')
      .run('["unknown"]');
    await expect(f.migrateV3()).rejects.toThrow('NOT_READY');
    expect(await f.repository.ready(f.ctx.installationId)).toBe(false);
  });
  it('enriches persisted ready inbox into exactly one incident and one durable evidence row', async () => {
    const f = await fixture();
    const t = await f.topology();
    expect(await f.repository.publishPolicy(f.ctx, f.policy(t.tier), 0)).toBe(
      true,
    );
    const entry = await readyInbox(f);
    const outcomes = await Promise.all([
      f.incidentService.process(f.ctx, { inboxId: entry.inboxId }),
      f.incidentService.process(f.ctx, { inboxId: entry.inboxId }),
    ]);
    expect(outcomes[0]).toEqual(outcomes[1]);
    expect(outcomes[0]).toMatchObject({
      kind: 'incident',
      incident: {
        tenantId: f.tenantId,
        state: 'new',
        sourceId: f.configured.sourceId,
        problemEventId: '100',
        impact: {
          affectedCustomerIds: [t.customer],
          affectedServiceIds: [t.customerService],
          siteId: t.siteId,
        },
        sla: {
          kind: 'selected',
          snapshot: { priority: 'P1', startedAt: f.event.occurredAt },
        },
      },
    });
    expect(
      f.h.sqlite.prepare('SELECT COUNT(*) AS total FROM incidents').get(),
    ).toMatchObject({ total: 1 });
    expect(
      f.h.sqlite
        .prepare('SELECT COUNT(*) AS total FROM incident_evidence')
        .get(),
    ).toMatchObject({ total: 1 });
    const original = outcomes[0];
    expect(
      await f.incidentService.process(f.ctx, { inboxId: entry.inboxId }),
    ).toEqual(original);
    expect(await f.repository.list(f.ctx)).toHaveLength(1);
  });
  it('retains recovery-before-problem persistently and never resolves or resets the incident', async () => {
    const f = await fixture();
    const t = await f.topology();
    await f.repository.publishPolicy(f.ctx, f.policy(t.tier), 0);
    const recovery = {
      ...f.event,
      kind: 'recovery',
      externalEventId: '101',
      occurredAt: '2026-11-26T00:00:10.000Z',
    };
    f.setNow('2026-11-26T00:00:20.000Z');
    const first = await readyInbox(f, recovery);
    expect(
      await f.incidentService.process(f.ctx, { inboxId: first.inboxId }),
    ).toEqual({ kind: 'awaiting_problem' });
    const problem = await readyInbox(f);
    const result = await f.incidentService.process(f.ctx, {
      inboxId: problem.inboxId,
    });
    expect(result).toMatchObject({
      kind: 'incident',
      recoveryObservedAt: recovery.occurredAt,
      incident: {
        state: 'new',
        occurredAt: f.event.occurredAt,
        sla: {
          snapshot: {
            startedAt: f.event.occurredAt,
            deadlineAt: '2026-11-26T00:01:00.000Z',
          },
        },
      },
    });
    expect(
      await f.repository.evidence(f.ctx, f.configured.sourceId, '100'),
    ).toHaveLength(2);
  });
  it('builds a complete single-statement snapshot and does not infer backup availability', async () => {
    const f = await fixture();
    const t = await f.topology();
    f.h.statements.length = 0;
    const snapshot = await f.inventory.load(f.ctx, t.uplinkId);
    const statements = f.h.statements.filter((s) =>
      s.query.includes('UNION ALL'),
    );
    expect(statements).toHaveLength(1);
    expect(statements[0]!.query).toContain('JSON_OBJECT');
    expect(statements[0]!.query).toContain('LIMIT 1001');
    expect(statements[0]!.params).toHaveLength(21);
    expect(snapshot).toMatchObject({
      availability: [],
      services: [
        expect.objectContaining({
          id: t.customerService,
          fields: expect.objectContaining({
            customer_id: t.customer,
            tier_id: t.tier,
          }),
        }),
      ],
    });
    expect(snapshot.uplinks.every((row) => row.tenant_id === f.tenantId)).toBe(
      true,
    );
    expect(await f.inventory.policies(f.ctx)).toEqual([]);
  });
  it('enforces policy CAS, same-tenant tier references and overlap detection atomically', async () => {
    const f = await fixture();
    const t = await f.topology();
    const boundary = '2026-11-27T00:00:00.000Z';
    const first = f.policy(t.tier, { effectiveUntil: boundary });
    expect(await f.repository.publishPolicy(f.ctx, first, 0)).toBe(true);
    expect(
      await f.repository.publishPolicy(
        f.ctx,
        f.policy(t.tier, { version: 2, effectiveFrom: boundary }),
        0,
      ),
    ).toBe(false);
    await expect(
      f.repository.publishPolicy(f.ctx, f.policy(t.tier, { version: 2 }), 1),
    ).rejects.toThrow('CONFLICT');
    expect(
      await f.repository.publishPolicy(
        f.ctx,
        f.policy(t.tier, { version: 2, effectiveFrom: boundary }),
        1,
      ),
    ).toBe(true);
    expect(await f.repository.policies(f.ctx)).toHaveLength(2);
    await expect(
      f.repository.publishPolicy(f.ctx, f.policy(randomUUID()), 0),
    ).rejects.toThrow('DENIED');
    await expect(
      f.repository.publishPolicy(
        f.ctx,
        f.policy(t.tier, { tenantId: randomUUID() }),
        2,
      ),
    ).rejects.toThrow('DENIED');
    await expect(
      f.repository.publishPolicy(f.ctx, f.policy(t.tier), -1),
    ).rejects.toThrow('INVALID');
  });
  it('denies foreign tenant/installation, pending state and stale/disabled source reads', async () => {
    const f = await fixture();
    await f.topology();
    const entry = await readyInbox(f);
    const other = (
      await f.h.service.bootstrap({
        name: 'Synthetic second ISP',
        slug: 'synthetic-second',
      })
    ).tenantId;
    expect(
      await f.repository.inbox({ ...f.ctx, tenantId: other }, entry.inboxId),
    ).toBe(null);
    expect(
      await f.repository.find(
        { ...f.ctx, tenantId: other },
        f.configured.sourceId,
        '100',
      ),
    ).toBe(null);
    await expect(
      f.repository.inbox(
        { ...f.ctx, installationId: 'other-synthetic-installation' },
        entry.inboxId,
      ),
    ).rejects.toThrow('DENIED');
    await expect(
      f.repository.recordEvidence(f.ctx, { ...entry, siteId: randomUUID() }),
    ).rejects.toThrow('DENIED');
    f.h.sqlite
      .prepare('UPDATE isp_tenants SET pending_mutation = ? WHERE id = ?')
      .run('synthetic pending', f.tenantId);
    await expect(f.repository.inbox(f.ctx, entry.inboxId)).rejects.toThrow(
      'NOT_READY',
    );
    f.h.sqlite
      .prepare('UPDATE isp_tenants SET pending_mutation = NULL WHERE id = ?')
      .run(f.tenantId);
    f.h.sqlite
      .prepare('UPDATE monitoring_sources SET status = ? WHERE id = ?')
      .run('disabled', f.configured.sourceId);
    expect(await f.repository.inbox(f.ctx, entry.inboxId)).toBe(null);
    await expect(f.repository.recordEvidence(f.ctx, entry)).rejects.toThrow(
      'DENIED',
    );
  });
});
