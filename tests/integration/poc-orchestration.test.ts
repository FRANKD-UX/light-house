// Full local vertical slice using adapted SQLite + injected mock Jira gateway.
// This is NOT native Forge, real Zabbix transport, or Jira acceptance evidence.
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { monitoringFixture } from '../support/monitoring';
import { IncidentService } from '../../src/application/incidents/service';
import { JsmCreationService } from '../../src/application/jsm/service';
import type {
  JsmConfiguration,
  JsmCreateOutcome,
  JsmRequest,
} from '../../src/application/jsm/contracts';
import type { IncidentPolicy } from '../../src/domain/incidents/model';
import {
  SqlIncidentInventory,
  SqlIncidentRepository,
} from '../../src/infrastructure/sql/incident-repository';
import { SqlJsmRepository } from '../../src/infrastructure/sql/jsm-repository';
import { migrateIncidents } from '../../src/infrastructure/sql/incident-migrations';
import { migrateJsm } from '../../src/infrastructure/sql/jsm-migrations';
import type { SqlDriver } from '../../src/infrastructure/sql/driver';

async function orchestration() {
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
  const ddl = async (statement: string) =>
    f.h.sqlite.exec(
      statement
        .replace(/ CHARACTER SET utf8mb4 COLLATE utf8mb4_bin/g, '')
        .replace(/,\s*INDEX \w+ \([^)]*\)/g, '')
        .replace(/UNIQUE KEY \w+/g, 'UNIQUE'),
    );
  await migrateIncidents(db, ddl, f.ctx.installationId, f.deps.now);
  await migrateJsm(db, ddl, f.ctx.installationId, f.deps.now);
  const incidentRepository = new SqlIncidentRepository(db),
    jsmRepository = new SqlJsmRepository(db, f.deps.now);
  const incidents = new IncidentService({
    repository: incidentRepository,
    inventory: new SqlIncidentInventory(incidentRepository),
    now: f.deps.now,
    id: randomUUID,
  });
  const gateway = {
    verifyConfiguration: vi.fn(async () => true),
    create: vi.fn<
      (
        config: JsmConfiguration,
        request: JsmRequest,
      ) => Promise<JsmCreateOutcome>
    >(async () => ({
      kind: 'created',
      issue: { id: '90001', key: 'SYNTH-1' },
    })),
    find: vi.fn(async () => ({
      complete: true,
      issues: [{ id: '90001', key: 'SYNTH-1' }],
    })),
  };
  const jsm = new JsmCreationService({
    repository: jsmRepository,
    gateway,
    now: f.deps.now,
    id: randomUUID,
    authoriseConfiguration: async (ctx) => {
      expect(ctx).toEqual(f.ctx);
    },
  });
  const config: JsmConfiguration = {
    installationId: f.ctx.installationId,
    tenantId: f.tenantId,
    version: 1,
    projectId: '10000',
    serviceDeskId: '1',
    requestTypeId: '2',
    fields: {
      marker: 'customfield_10001',
      deadline: 'customfield_10002',
      warning: 'customfield_10003',
      policy: 'customfield_10004',
    },
    priorityIds: { P1: '1', P2: '2', P3: '3' },
  };
  await jsm.configure(f.ctx, config, 0);
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
  const gold = await save('sla_tiers', {
      code: 'poc-gold',
      name: 'Synthetic gold',
    }),
    silver = await save('sla_tiers', {
      code: 'poc-silver',
      name: 'Synthetic silver',
    });
  const customer = await save('customers', {
    reference: 'poc-customer',
    display_alias: 'Synthetic POC customer',
    site_id: link.siteId,
    sla_tier_id: gold,
  });
  const services: string[] = [];
  for (const [code, tier] of [
    ['poc-access', gold],
    ['poc-voice', silver],
  ]) {
    const service = await save('customer_services', {
      customer_id: customer,
      site_id: link.siteId,
      tier_id: tier!,
      code: code!,
    });
    services.push(service);
    await save('service_dependencies', {
      service_id: service,
      uplink_id: link.uplinkId,
      dependency_mode: 'required',
      failover_group: null,
    });
  }
  const policies: IncidentPolicy[] = [gold, silver].map((tierId, index) => ({
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
      P1: {
        durationSeconds: index ? 120 : 60,
        warningSeconds: index ? 90 : 45,
      },
      P2: { durationSeconds: 240, warningSeconds: 180 },
      P3: { durationSeconds: 1440, warningSeconds: 1080 },
    },
  }));
  for (const policy of policies)
    expect(await incidentRepository.publishPolicy(f.ctx, policy, 0)).toBe(true);
  const process = async (inboxId: string) => {
    const result = await incidents.process(f.ctx, { inboxId });
    if (result.kind === 'incident' && result.incident.sla.kind === 'selected')
      await jsm.create(f.ctx, result.incident.id);
    return result;
  };
  const counts = () =>
    Object.fromEntries(
      ['monitoring_inbox', 'incident_evidence', 'incidents', 'jsm_intents'].map(
        (table) => [
          table,
          (
            f.h.sqlite
              .prepare(`SELECT COUNT(*) AS total FROM ${table}`)
              .get() as { total: number }
          ).total,
        ],
      ),
    );
  return {
    ...f,
    incidentRepository,
    jsmRepository,
    gateway,
    incidents,
    jsm,
    config,
    customer,
    services,
    gold,
    policies,
    processIncident: process,
    counts,
  };
}

describe('synthetic Zabbix to JSM local vertical slice', () => {
  it('authenticates, persists, enriches two distinct services for one customer and links exactly one Jira request under concurrent replays', async () => {
    const f = await orchestration();
    expect(
      await Promise.all(
        Array.from({ length: 4 }, () =>
          f.service.receive(f.request(), randomUUID()),
        ),
      ),
    ).toEqual(['accepted', 'accepted', 'accepted', 'accepted']);
    await f.process();
    const receipts = (await f.service.overview({ tenantId: f.tenantId }))
      .receipts;
    expect(receipts).toHaveLength(1);
    const receipt = receipts[0]!;
    expect(receipt).toMatchObject({
      status: 'ready',
      duplicates: 3,
      siteId: expect.any(String),
      uplinkId: expect.any(String),
      occurredAt: f.event.occurredAt,
    });
    await Promise.all([
      f.processIncident(receipt.id),
      f.processIncident(receipt.id),
      f.processIncident(receipt.id),
    ]);
    const saved = (await f.incidentRepository.list(f.ctx))[0]!;
    expect(saved.impact.affectedCustomerIds).toEqual([f.customer]);
    expect(saved.impact.affectedServiceIds).toEqual([...f.services].sort());
    expect(saved.impact.potentiallyAffectedServiceIds).toEqual(
      [...f.services].sort(),
    );
    expect(saved.sla).toMatchObject({
      kind: 'selected',
      snapshot: {
        tierId: f.gold,
        policyId: f.policies[0]!.id,
        consideredTierIds: [f.gold, f.policies[1]!.tierId].sort(),
        startedAt: f.event.occurredAt,
        warningAt: '2026-11-26T00:00:45.000Z',
        deadlineAt: '2026-11-26T00:01:00.000Z',
      },
    });
    expect(f.counts()).toEqual({
      monitoring_inbox: 1,
      incident_evidence: 1,
      incidents: 1,
      jsm_intents: 1,
    });
    expect(f.gateway.create).toHaveBeenCalledTimes(1);
    expect(
      f.h.sqlite
        .prepare('SELECT state, attempts, issue_id, issue_key FROM jsm_intents')
        .get(),
    ).toMatchObject({
      state: 'linked',
      attempts: 1,
      issue_id: '90001',
      issue_key: 'SYNTH-1',
    });
    expect(await f.jsm.create(f.ctx, saved.id)).toMatchObject({
      state: 'linked',
      issue: { id: '90001', key: 'SYNTH-1' },
    });
    expect(f.gateway.create).toHaveBeenCalledTimes(1);
    const [configuredTarget, request] = f.gateway.create.mock.calls[0]!;
    expect(configuredTarget).toEqual(f.config);
    expect(request).toMatchObject({
      serviceDeskId: f.config.serviceDeskId,
      requestTypeId: f.config.requestTypeId,
      requestFieldValues: {
        priority: { id: '1' },
        [f.config.fields.deadline]: '2026-11-26T00:01:00.000Z',
        [f.config.fields.warning]: '2026-11-26T00:00:45.000Z',
        [f.config.fields.policy]: f.policies[0]!.id,
      },
    });
    expect(request.requestFieldValues[f.config.fields.marker]).toMatch(
      /^light-house-[0-9a-f-]{36}$/,
    );
    expect(request.requestFieldValues.description).toContain(
      'confirmed customers 1, potential customers 1; confirmed services 2, potential services 2',
    );
    expect(request.requestFieldValues.description).toContain(
      'Impact known (COMPLETE)',
    );
  });
  it('persists monitoring recovery as evidence without closing, changing the SLA snapshot or creating another Jira issue', async () => {
    const f = await orchestration();
    expect(await f.service.receive(f.request(), randomUUID())).toBe('accepted');
    await f.process();
    const problem = (await f.service.overview({ tenantId: f.tenantId }))
      .receipts[0]!;
    await f.processIncident(problem.id);
    const before = (await f.incidentRepository.list(f.ctx))[0]!;
    f.setNow('2026-11-26T00:00:20.000Z');
    const recovery = {
      ...f.event,
      externalEventId: '101',
      kind: 'recovery',
      occurredAt: '2026-11-26T00:00:10.000Z',
    };
    expect(await f.service.receive(f.request(recovery), randomUUID())).toBe(
      'accepted',
    );
    await f.process();
    const receipt = (
      await f.service.overview({ tenantId: f.tenantId })
    ).receipts.find((r) => r.kind === 'recovery')!;
    const result = await f.processIncident(receipt.id);
    expect(result).toMatchObject({
      kind: 'incident',
      recoveryObservedAt: recovery.occurredAt,
    });
    const after = (await f.incidentRepository.list(f.ctx))[0]!;
    expect(after).toEqual(before);
    expect(after.state).toBe('new');
    expect(f.counts()).toEqual({
      monitoring_inbox: 2,
      incident_evidence: 2,
      incidents: 1,
      jsm_intents: 1,
    });
    expect(f.gateway.create).toHaveBeenCalledTimes(1);
  });
  it('rejects incorrect authentication before inbox, incident, outcome or Jira writes', async () => {
    const f = await orchestration();
    expect(
      await f.service.receive(
        f.request(f.event, { authorization: ['Bearer ' + 'b'.repeat(43)] }),
        randomUUID(),
      ),
    ).toBe('unauthorised');
    expect(f.counts()).toEqual({
      monitoring_inbox: 0,
      incident_evidence: 0,
      incidents: 0,
      jsm_intents: 0,
    });
    expect(
      f.h.sqlite
        .prepare('SELECT COUNT(*) AS total FROM monitoring_observations')
        .get(),
    ).toMatchObject({ total: 0 });
    expect(f.jobs).toHaveLength(0);
    expect(f.gateway.create).not.toHaveBeenCalled();
  });
  it('reconciles an uncertain creation through the durable marker without a second POST', async () => {
    const f = await orchestration();
    f.gateway.create.mockRejectedValueOnce(
      new Error('synthetic transport timeout'),
    );
    expect(await f.service.receive(f.request(), randomUUID())).toBe('accepted');
    await f.process();
    const receipt = (await f.service.overview({ tenantId: f.tenantId }))
      .receipts[0]!;
    await f.processIncident(receipt.id);
    const saved = (await f.incidentRepository.list(f.ctx))[0]!;
    const uncertain = f.h.sqlite
      .prepare(
        'SELECT id, marker, state, attempts, reconciliations FROM jsm_intents',
      )
      .get();
    expect(uncertain).toMatchObject({
      state: 'ambiguous',
      attempts: 1,
      reconciliations: 0,
    });
    const linked = await f.jsm.create(f.ctx, saved.id);
    expect(linked).toMatchObject({
      state: 'linked',
      issue: { id: '90001', key: 'SYNTH-1' },
    });
    expect(f.gateway.find).toHaveBeenCalledWith(
      f.config,
      (uncertain as { marker: string }).marker,
    );
    expect(f.gateway.create).toHaveBeenCalledTimes(1);
    expect(
      f.h.sqlite
        .prepare('SELECT state, attempts, reconciliations FROM jsm_intents')
        .get(),
    ).toMatchObject({ state: 'linked', attempts: 1, reconciliations: 1 });
    expect(f.counts()).toEqual({
      monitoring_inbox: 1,
      incident_evidence: 1,
      incidents: 1,
      jsm_intents: 1,
    });
  });
});
