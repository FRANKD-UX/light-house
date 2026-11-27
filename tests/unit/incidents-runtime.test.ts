// Mocked Forge SDK/resolver boundaries only; no hosted acceptance or network requests.
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const runtime = vi.hoisted(() => ({
  environment: 'DEVELOPMENT',
  installationId: 'synthetic-installation',
  push: vi.fn(),
  rows: vi.fn(),
  write: vi.fn(),
  ddl: vi.fn(),
}));
vi.mock('@forge/api', () => ({
  getAppContext: () => ({
    environmentType: runtime.environment,
    installationAri: { toString: () => runtime.installationId },
  }),
  default: {},
  route: vi.fn(),
}));
vi.mock('@forge/sql', () => ({ default: { executeDDL: runtime.ddl } }));
vi.mock('@forge/events', () => ({
  Queue: class {
    push = runtime.push;
  },
}));
vi.mock('../../src/infrastructure/sql/driver', () => ({
  forgeSql: { rows: runtime.rows, write: runtime.write },
}));
vi.mock('../../src/forge/inventory/boundary', () => ({
  isJiraAdmin: vi.fn(async () => true),
}));
import { createIncidentHandlers } from '../../src/forge/incidents/runtime';
import { createMonitoringHandlers } from '../../src/forge/monitoring/handlers';
import { IncidentService } from '../../src/application/incidents/service';
import { InventoryService } from '../../src/application/inventory/service';
import { MonitoringService } from '../../src/application/monitoring/service';
import { JsmCreationService } from '../../src/application/jsm/service';
import { SqlIncidentRepository } from '../../src/infrastructure/sql/incident-repository';
import { SqlJsmRepository } from '../../src/infrastructure/sql/jsm-repository';
import * as incidentMigration from '../../src/infrastructure/sql/incident-migrations';
import * as jsmMigration from '../../src/infrastructure/sql/jsm-migrations';
import { InventoryError } from '../../src/domain/inventory/model';
import {
  IncidentError,
  type Incident,
  type IncidentEvidence,
  type IncidentPolicy,
} from '../../src/domain/incidents/model';
import {
  JsmError,
  type JsmConfiguration,
  type JsmGateway,
} from '../../src/application/jsm/contracts';
import type { TenantContext } from '../../src/application/ports/tenant-context';
const tenant = randomUUID(),
  source = randomUUID(),
  inboxId = randomUUID(),
  site = randomUUID(),
  uplink = randomUUID(),
  tier = randomUUID();
const timestamp = '2026-11-27T00:00:00.000Z';
const ctx: TenantContext = {
  installationId: 'synthetic-installation',
  tenantId: tenant,
  actor: { kind: 'atlassian-user', accountId: 'synthetic-user' },
};
const gateway: JsmGateway = {
  verifyConfiguration: vi.fn(async () => true),
  create: vi.fn(async () => ({ kind: 'AMBIGUOUS' as const })),
  find: vi.fn(async () => ({ complete: false, issues: [] })),
};
function policy(): IncidentPolicy {
  return {
    id: randomUUID(),
    tenantId: tenant,
    tierId: tier,
    status: 'published',
    version: 1,
    effectiveFrom: timestamp,
    effectiveUntil: null,
    clock: 'elapsed-utc',
    severityMap: { '4': 'P1' },
    unknownImpact: 'manual-review',
    targets: {
      P1: { durationSeconds: 60, warningSeconds: 45 },
      P2: { durationSeconds: 240, warningSeconds: 180 },
      P3: { durationSeconds: 1440, warningSeconds: 1080 },
    },
  };
}
function incident(selected = true): Incident {
  return {
    id: randomUUID(),
    installationId: ctx.installationId,
    tenantId: tenant,
    sourceId: source,
    problemEventId: '100',
    correlationId: randomUUID(),
    createdAt: timestamp,
    occurredAt: timestamp,
    impact: {
      confidence: 'known',
      reason: 'COMPLETE',
      siteId: site,
      uplinkId: uplink,
      carrierId: randomUUID(),
      affectedServiceIds: [],
      affectedCustomerIds: [],
      potentiallyAffectedCustomerIds: [],
      potentiallyAffectedServiceIds: [],
      protectedServiceIds: [],
      uncertainServiceIds: [],
      tierIds: [tier],
    },
    sla: selected
      ? {
          kind: 'selected',
          snapshot: {
            policyId: randomUUID(),
            policyVersion: 1,
            tierId: tier,
            consideredTierIds: [tier],
            priority: 'P1',
            severity: '4',
            confidence: 'known',
            reason: 'STRICTEST_AFFECTED_TIER',
            clock: 'elapsed-utc',
            startedAt: timestamp,
            durationSeconds: 60,
            warningSeconds: 45,
            warningAt: '2026-11-27T00:00:45.000Z',
            deadlineAt: '2026-11-27T00:01:00.000Z',
          },
        }
      : { kind: 'manual_triage', reason: 'UNKNOWN_IMPACT' },
    state: selected ? 'new' : 'manual_triage',
    version: 1,
  };
}
function configuration(): JsmConfiguration {
  return {
    installationId: ctx.installationId,
    tenantId: tenant,
    version: 1,
    projectId: '10',
    serviceDeskId: '20',
    requestTypeId: '30',
    fields: {
      marker: 'customfield_100',
      deadline: 'customfield_101',
      warning: 'customfield_102',
      policy: 'customfield_103',
    },
    priorityIds: { P1: '1', P2: '2', P3: '3' },
  };
}
function evidence(): IncidentEvidence {
  return {
    inboxId,
    sourceId: source,
    correlationId: randomUUID(),
    receivedAt: timestamp,
    uplinkId: uplink,
    siteId: site,
    event: {
      externalEventId: '100',
      problemEventId: '100',
      resourceId: 'synthetic:uplink',
      kind: 'problem',
      occurredAt: timestamp,
      severity: '4',
    },
  };
}
beforeEach(() => {
  runtime.environment = 'DEVELOPMENT';
  runtime.installationId = ctx.installationId;
  runtime.rows.mockReset().mockResolvedValue([{ ready: 1, schema_version: 4 }]);
  runtime.write.mockReset().mockResolvedValue(1);
  runtime.push.mockReset().mockResolvedValue(undefined);
  runtime.ddl.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(InventoryService.prototype, 'context').mockResolvedValue(ctx);
  vi.spyOn(InventoryService.prototype, 'admin').mockResolvedValue(undefined);
  vi.spyOn(SqlIncidentRepository.prototype, 'ready').mockResolvedValue(true);
  vi.spyOn(SqlIncidentRepository.prototype, 'list').mockResolvedValue([]);
  vi.spyOn(SqlIncidentRepository.prototype, 'policies').mockResolvedValue([]);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
describe('incident trusted runtime resolver wiring', () => {
  it('uses server installation/actor and rejects untrusted runtime/input before mutation', async () => {
    const handlers = createIncidentHandlers(gateway);
    for (const value of [
      null,
      [],
      {},
      { action: 'unknown', tenantId: tenant },
      { action: 'migrate', tenantId: tenant, installationId: 'forged' },
      { action: 'overview', tenantId: tenant, extra: 'private-input' },
    ])
      expect(
        await handlers.request({ accountId: 'synthetic-user' }, value),
      ).toMatchObject({ ok: false, code: 'INVALID' });
    expect(runtime.push).not.toHaveBeenCalled();
    expect(
      await handlers.request(null, { action: 'overview', tenantId: tenant }),
    ).toMatchObject({ ok: false, code: 'INVALID' });
    runtime.environment = 'PRODUCTION';
    expect(
      await handlers.request(
        { accountId: 'synthetic-user' },
        { action: 'overview', tenantId: tenant },
      ),
    ).toMatchObject({ ok: false, code: 'DENIED' });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(
      /private-input|forged|synthetic-user/,
    );
  });
  it('requires fresh configure membership for every mutation and Jira admin for schema admission', async () => {
    const auth = vi.mocked(InventoryService.prototype.context);
    auth.mockImplementation(async (_tenant, permission) => {
      if (permission === 'configure') throw new InventoryError('DENIED');
      return ctx;
    });
    const handlers = createIncidentHandlers(gateway);
    for (const action of [
      'migrate',
      'process',
      'publishPolicy',
      'configureJsm',
      'createJsm',
    ])
      expect(
        await handlers.request(
          { accountId: 'viewer' },
          { action, tenantId: tenant },
        ),
      ).toMatchObject({ ok: false, code: 'DENIED' });
    expect(
      await handlers.request(
        { accountId: 'viewer' },
        { action: 'overview', tenantId: tenant },
      ),
    ).toMatchObject({ ok: true });
    auth.mockResolvedValue(ctx);
    vi.mocked(InventoryService.prototype.admin).mockRejectedValueOnce(
      new InventoryError('DENIED'),
    );
    expect(
      await handlers.request(
        { accountId: 'non-jira-admin' },
        { action: 'migrate', tenantId: tenant },
      ),
    ).toMatchObject({ ok: false, code: 'DENIED' });
    expect(runtime.push).not.toHaveBeenCalled();
    expect(
      await handlers.request(
        { accountId: 'synthetic-user' },
        { action: 'migrate', tenantId: tenant },
      ),
    ).toMatchObject({ ok: true, value: { queued: true } });
    expect(runtime.push).toHaveBeenCalledWith({
      body: { installationId: ctx.installationId },
      concurrency: { key: 'light-house-incident-schema-v3', limit: 1 },
    });
  });
  it('projects overview pages without private installation identity and distinguishes unavailable from empty success', async () => {
    const rows = Array.from({ length: 21 }, () => incident());
    vi.mocked(SqlIncidentRepository.prototype.list).mockResolvedValue(rows);
    runtime.rows.mockImplementation(async (query: string) =>
      query.includes('FROM jsm_intents')
        ? [
            {
              incidentId: rows[0]!.id,
              state: 'linked',
              issueId: '50',
              issueKey: 'SYNTH-1',
            },
          ]
        : [{ ready: 1, schema_version: 4 }],
    );
    const handlers = createIncidentHandlers(gateway);
    const result = await handlers.request(
      { accountId: 'synthetic-user' },
      { action: 'overview', tenantId: tenant },
    );
    expect(result).toMatchObject({
      ok: true,
      value: { incidents: expect.any(Array), next: rows[19]!.id, policies: [] },
    });
    expect(JSON.stringify(result)).not.toContain(ctx.installationId);
    expect(result).toMatchObject({
      value: {
        jsmLinks: [
          { incidentId: rows[0]!.id, state: 'linked', issueKey: 'SYNTH-1' },
        ],
      },
    });
    expect(runtime.rows).toHaveBeenCalledWith(
      expect.stringContaining('FROM jsm_intents'),
      [ctx.installationId, tenant, ...rows.slice(0, 20).map((row) => row.id)],
    );
    if (!result.ok) throw new Error('fixture');
    expect((result.value as { incidents: unknown[] }).incidents).toHaveLength(
      20,
    );
    vi.mocked(SqlIncidentRepository.prototype.list).mockRejectedValueOnce(
      new Error('private database error'),
    );
    expect(
      await handlers.request(
        { accountId: 'synthetic-user' },
        { action: 'overview', tenantId: tenant },
      ),
    ).toMatchObject({ ok: false, code: 'UNAVAILABLE' });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      'private database error',
    );
    vi.mocked(SqlIncidentRepository.prototype.ready).mockResolvedValueOnce(
      false,
    );
    expect(
      await handlers.request(
        { accountId: 'synthetic-user' },
        { action: 'overview', tenantId: tenant },
      ),
    ).toMatchObject({ ok: false, code: 'NOT_READY' });
  });
  it('processes persisted inbox identity and projects incident while retaining awaiting-problem result', async () => {
    const saved = incident();
    const process = vi
      .spyOn(IncidentService.prototype, 'process')
      .mockResolvedValueOnce({
        kind: 'incident',
        incident: saved,
        recoveryObservedAt: null,
        updateCount: 0,
      })
      .mockResolvedValueOnce({ kind: 'awaiting_problem' });
    const handlers = createIncidentHandlers(gateway);
    const first = await handlers.request(
      { accountId: 'synthetic-user' },
      { action: 'process', tenantId: tenant, inboxId },
    );
    expect(first).toMatchObject({
      ok: true,
      value: { kind: 'incident', incident: { id: saved.id } },
    });
    expect(JSON.stringify(first)).not.toContain(ctx.installationId);
    expect(process).toHaveBeenCalledWith(ctx, { inboxId });
    expect(
      await handlers.request(
        { accountId: 'synthetic-user' },
        { action: 'process', tenantId: tenant, inboxId },
      ),
    ).toMatchObject({ ok: true, value: { kind: 'awaiting_problem' } });
    process.mockRejectedValueOnce(new IncidentError('CONFLICT'));
    expect(
      await handlers.request(
        { accountId: 'synthetic-user' },
        { action: 'process', tenantId: tenant, inboxId },
      ),
    ).toMatchObject({ ok: false, code: 'CONFLICT' });
  });
  it('projects policy input through parser, preserves CAS conflict and rejects invalid mapping', async () => {
    const publish = vi
      .spyOn(SqlIncidentRepository.prototype, 'publishPolicy')
      .mockResolvedValue(true);
    const p = policy();
    const handlers = createIncidentHandlers(gateway);
    expect(
      await handlers.request(
        { accountId: 'synthetic-user' },
        {
          action: 'publishPolicy',
          tenantId: tenant,
          policy: { ...p, arbitrary: 'private-policy-extra' },
          expected: 0,
        },
      ),
    ).toMatchObject({ ok: true, value: { saved: true } });
    expect(publish).toHaveBeenCalledWith(
      ctx,
      { ...p, id: expect.any(String) },
      0,
    );
    const firstSavedId = publish.mock.calls[0]![1].id;
    expect(firstSavedId).not.toBe(p.id);
    expect(firstSavedId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(
      await handlers.request(
        { accountId: 'synthetic-user' },
        { action: 'publishPolicy', tenantId: tenant, policy: p, expected: 0 },
      ),
    ).toMatchObject({ ok: true });
    expect(publish.mock.calls[1]![1].id).not.toBe(firstSavedId);
    expect(publish.mock.calls[1]![1].id).not.toBe(p.id);
    expect(JSON.stringify(publish.mock.calls)).not.toContain(
      'private-policy-extra',
    );
    publish.mockResolvedValueOnce(false);
    expect(
      await handlers.request(
        { accountId: 'synthetic-user' },
        { action: 'publishPolicy', tenantId: tenant, policy: p, expected: 0 },
      ),
    ).toMatchObject({ ok: false, code: 'CONFLICT' });
    expect(
      await handlers.request(
        { accountId: 'synthetic-user' },
        {
          action: 'publishPolicy',
          tenantId: tenant,
          policy: { ...p, unknownImpact: 'lowest' },
          expected: 0,
        },
      ),
    ).toMatchObject({ ok: false, code: 'INVALID' });
  });
  it('delegates JSM creation and validates actual configuration authority through the fresh callback', async () => {
    const config = configuration();
    const save = vi
      .spyOn(SqlJsmRepository.prototype, 'saveConfiguration')
      .mockResolvedValue(true);
    const create = vi
      .spyOn(JsmCreationService.prototype, 'create')
      .mockResolvedValue({
        state: 'linked',
        intentId: randomUUID(),
        issue: { id: '50', key: 'SYNTH-1' },
      });
    const handlers = createIncidentHandlers(gateway);
    expect(
      await handlers.request(
        { accountId: 'synthetic-user' },
        {
          action: 'configureJsm',
          tenantId: tenant,
          configuration: {
            version: config.version,
            projectId: config.projectId,
            serviceDeskId: config.serviceDeskId,
            requestTypeId: config.requestTypeId,
            fields: config.fields,
            priorityIds: config.priorityIds,
          },
          expected: 0,
        },
      ),
    ).toMatchObject({ ok: true, value: { saved: true } });
    expect(save).toHaveBeenCalledWith(ctx, config, 0);
    expect(gateway.verifyConfiguration).toHaveBeenCalledWith(config);
    expect(InventoryService.prototype.admin).toHaveBeenCalled();
    const incidentId = randomUUID();
    expect(
      await handlers.request(
        { accountId: 'synthetic-user' },
        { action: 'createJsm', tenantId: tenant, incidentId },
      ),
    ).toMatchObject({ ok: true, value: { state: 'linked' } });
    expect(create).toHaveBeenCalledWith(ctx, incidentId);
    create.mockRejectedValueOnce(new JsmError('NOT_READY'));
    expect(
      await handlers.request(
        { accountId: 'synthetic-user' },
        { action: 'createJsm', tenantId: tenant, incidentId },
      ),
    ).toMatchObject({ ok: false, code: 'NOT_READY' });
  });
});
describe('incident schema and monitoring downstream workers', () => {
  it('executes both additive registries only for matching bounded DEVELOPMENT jobs and masks migration failures', async () => {
    const first = vi
      .spyOn(incidentMigration, 'migrateIncidents')
      .mockImplementation(async (_db, ddl) => {
        await ddl('synthetic v003 DDL');
      });
    const second = vi
      .spyOn(jsmMigration, 'migrateJsm')
      .mockImplementation(async (_db, ddl) => {
        await ddl('synthetic v004 DDL');
      });
    const handlers = createIncidentHandlers(gateway),
      body = { installationId: ctx.installationId };
    await handlers.migrate({ body });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(runtime.ddl.mock.calls).toEqual([
      ['synthetic v003 DDL'],
      ['synthetic v004 DDL'],
    ]);
    await handlers.migrate({ body, retryContext: { retryCount: 3 } });
    expect(first).toHaveBeenCalledTimes(1);
    for (const event of [
      null,
      {},
      { body: { installationId: 'foreign' } },
      { body: { ...body, extra: tenant } },
      { body, retryContext: { retryCount: -1 } },
    ])
      await expect(handlers.migrate(event)).rejects.toThrow(
        'INCIDENT_MIGRATION_UNAVAILABLE',
      );
    first.mockRejectedValueOnce(new Error('private failed checkpoint'));
    await expect(handlers.migrate({ body })).rejects.toThrow(
      'INCIDENT_MIGRATION_UNAVAILABLE',
    );
    expect(second).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      'private failed checkpoint',
    );
    runtime.environment = 'STAGING';
    await expect(handlers.migrate({ body })).rejects.toThrow(
      'INCIDENT_MIGRATION_UNAVAILABLE',
    );
  });
  it('skips unavailable schemas/nonready receipts and rejects foreign installation before downstream processing', async () => {
    const process = vi
      .spyOn(IncidentService.prototype, 'process')
      .mockResolvedValue({ kind: 'awaiting_problem' });
    const inbox = vi
      .spyOn(SqlIncidentRepository.prototype, 'inbox')
      .mockResolvedValue(null);
    const handlers = createIncidentHandlers(gateway);
    vi.mocked(SqlIncidentRepository.prototype.ready).mockResolvedValueOnce(
      false,
    );
    await handlers.processReady(ctx, inboxId);
    expect(inbox).not.toHaveBeenCalled();
    await handlers.processReady(ctx, inboxId);
    expect(process).not.toHaveBeenCalled();
    await expect(
      handlers.processReady({ ...ctx, installationId: 'foreign' }, inboxId),
    ).rejects.toThrow('DENIED');
    inbox.mockResolvedValue(evidence());
    await handlers.processReady(ctx, inboxId);
    expect(process).toHaveBeenCalledWith(ctx, { inboxId });
  });
  it('creates JSM only for selected SLA and configured ready v004; propagates partial failures for worker retry', async () => {
    const saved = incident();
    vi.spyOn(SqlIncidentRepository.prototype, 'inbox').mockResolvedValue(
      evidence(),
    );
    const process = vi
      .spyOn(IncidentService.prototype, 'process')
      .mockResolvedValue({
        kind: 'incident',
        incident: saved,
        recoveryObservedAt: null,
        updateCount: 0,
      });
    const config = vi
      .spyOn(SqlJsmRepository.prototype, 'configuration')
      .mockResolvedValue(configuration());
    const create = vi
      .spyOn(JsmCreationService.prototype, 'create')
      .mockResolvedValue({
        state: 'linked',
        intentId: randomUUID(),
        issue: { id: '50', key: 'SYNTH-1' },
      });
    const handlers = createIncidentHandlers(gateway);
    await handlers.processReady(ctx, inboxId);
    expect(create).toHaveBeenCalledWith(ctx, saved.id);
    config.mockResolvedValueOnce(null);
    await handlers.processReady(ctx, inboxId);
    expect(create).toHaveBeenCalledTimes(1);
    runtime.rows.mockResolvedValueOnce([]);
    await handlers.processReady(ctx, inboxId);
    expect(create).toHaveBeenCalledTimes(1);
    runtime.rows.mockRejectedValueOnce(new Error('private read failure'));
    await handlers.processReady(ctx, inboxId);
    expect(create).toHaveBeenCalledTimes(1);
    process.mockResolvedValueOnce({
      kind: 'incident',
      incident: incident(false),
      recoveryObservedAt: null,
      updateCount: 0,
    });
    await handlers.processReady(ctx, inboxId);
    expect(create).toHaveBeenCalledTimes(1);
    create.mockRejectedValueOnce(new Error('private downstream failure'));
    await expect(handlers.processReady(ctx, inboxId)).rejects.toThrow(
      'private downstream failure',
    );
    await handlers.processReady(ctx, inboxId);
    expect(create).toHaveBeenCalledTimes(3);
  });
  it('retries downstream after mapped monitoring completion without suppressing callback failure', async () => {
    const process = vi
      .spyOn(MonitoringService.prototype, 'process')
      .mockResolvedValue(undefined);
    const callback = vi
      .fn()
      .mockRejectedValueOnce(new Error('private downstream'))
      .mockResolvedValue(undefined);
    const handlers = createMonitoringHandlers(
      { put: vi.fn(), get: vi.fn(), remove: vi.fn() },
      callback,
    );
    const job = {
      body: { installationId: ctx.installationId, tenantId: tenant, inboxId },
    };
    await expect(handlers.consume(job)).rejects.toThrow(
      'MONITORING_WORKER_UNAVAILABLE',
    );
    await handlers.consume(job);
    expect(process).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith(
      { ...ctx, actor: { kind: 'system' } },
      inboxId,
    );
    process.mockResolvedValueOnce('busy');
    await expect(handlers.consume(job)).rejects.toThrow(
      'MONITORING_WORKER_UNAVAILABLE',
    );
    expect(callback).toHaveBeenCalledTimes(2);
    await handlers.consume({ ...job, retryContext: { retryCount: 5 } });
    expect(callback).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      'private downstream',
    );
  });
});
