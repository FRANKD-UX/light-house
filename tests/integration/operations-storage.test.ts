// Adapted SQLite + server-authority test port. Not Forge/TiDB/Jira native acceptance.
import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { monitoringFixture } from '../support/monitoring';
import { migrateIncidents } from '../../src/infrastructure/sql/incident-migrations';
import { migrateJsm } from '../../src/infrastructure/sql/jsm-migrations';
import {
  migrateOperations,
  operationsMigrations,
} from '../../src/infrastructure/sql/operations-migrations';
import { SqlOperationsRepository } from '../../src/infrastructure/sql/operations-repository';
import { SqlIncidentRepository } from '../../src/infrastructure/sql/incident-repository';
import { OperationService } from '../../src/application/operations/service';
import type { GateRecord } from '../../src/application/operations/contracts';
import type {
  Incident,
  IncidentEvidence,
} from '../../src/domain/incidents/model';
import type { SqlDriver } from '../../src/infrastructure/sql/driver';
async function fixture(migrate = true) {
  const f = await monitoringFixture();
  let beforeWrite: ((query: string) => Promise<void> | void) | null = null;
  const db: SqlDriver = {
    rows: f.h.db.rows,
    write: async (query, params) => {
      await beforeWrite?.(query);
      return f.h.db.write(
        query
          .replace(
            'ON DUPLICATE KEY UPDATE ready = 0',
            'ON CONFLICT (installation_id) DO UPDATE SET ready = 0',
          )
          .replace(
            'ON DUPLICATE KEY UPDATE command_id = command_id',
            'ON CONFLICT DO NOTHING',
          ),
        params,
      );
    },
  };
  const ddl = vi.fn(async (statement: string) =>
    f.h.sqlite.exec(
      statement
        .replace(/ CHARACTER SET utf8mb4 COLLATE utf8mb4_bin/g, '')
        .replace(/,\s*INDEX \w+ \([^)]*\)/g, '')
        .replace(/UNIQUE KEY \w+/g, 'UNIQUE'),
    ),
  );
  await migrateIncidents(db, ddl, f.ctx.installationId, f.deps.now);
  await migrateJsm(db, ddl, f.ctx.installationId, f.deps.now);
  const migrateV5 = () =>
    migrateOperations(db, ddl, f.ctx.installationId, f.deps.now);
  if (migrate) await migrateV5();
  const repo = new SqlOperationsRepository(db, f.deps.now),
    incidents = new SqlIncidentRepository(db),
    topology = await f.topology();
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
  const noc = await save('teams', {
      code: 'synthetic-noc',
      name: 'Synthetic NOC',
    }),
    department = await save('teams', {
      code: 'synthetic-department',
      name: 'Synthetic department',
    });
  const assignee = await save('assignees', {
    atlassian_account_id: f.h.session.accountId,
    display_alias: 'Synthetic engineer',
    mapping_method: 'manual',
  });
  const membership = await save('team_memberships', {
    team_id: noc,
    assignee_id: assignee,
    role: 'engineer',
    effective_until: null,
  });
  await save('team_memberships', {
    team_id: department,
    assignee_id: assignee,
    role: 'engineer',
    effective_until: null,
  });
  const tier = await save('sla_tiers', {
    code: 'operations',
    name: 'Synthetic operations SLA',
  });
  expect(await f.service.receive(f.request(), randomUUID())).toBe('accepted');
  await f.process();
  const receipt = (await f.service.overview({ tenantId: f.tenantId }))
    .receipts[0]!;
  const original = (await incidents.inbox(f.ctx, receipt.id))!;
  await incidents.recordEvidence(f.ctx, original);
  const incident: Incident = {
    id: randomUUID(),
    installationId: f.ctx.installationId,
    tenantId: f.tenantId,
    sourceId: original.sourceId,
    problemEventId: original.event.problemEventId,
    correlationId: randomUUID(),
    occurredAt: f.event.occurredAt,
    createdAt: f.event.occurredAt,
    version: 1,
    state: 'new',
    impact: {
      confidence: 'known',
      reason: 'COMPLETE',
      siteId: topology.siteId,
      uplinkId: topology.uplinkId,
      carrierId: randomUUID(),
      affectedCustomerIds: [],
      affectedServiceIds: [],
      potentiallyAffectedCustomerIds: [],
      potentiallyAffectedServiceIds: [],
      uncertainServiceIds: [],
      protectedServiceIds: [],
      tierIds: [tier],
    },
    sla: {
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
        startedAt: f.event.occurredAt,
        durationSeconds: 600,
        warningSeconds: 300,
        warningAt: '2026-11-26T00:05:00.000Z',
        deadlineAt: '2026-11-26T00:10:00.000Z',
      },
    },
  };
  await incidents.createIfAbsent(f.ctx, incident);
  let teamId = noc;
  const service = new OperationService({
    repository: repo,
    now: f.deps.now,
    id: randomUUID,
    digest: (canonical) => createHash('sha256').update(canonical).digest('hex'),
    authorise: async () => ({
      tenantId: f.tenantId,
      role: 'admin',
      assigneeId: assignee,
      teamId,
      nocTeamId: noc,
    }),
  });
  const command = (kind: string, expected: number, extra = {}) => ({
    commandId: randomUUID(),
    incidentId: incident.id,
    kind,
    expected,
    ...extra,
  });
  const initialise = async () => {
    expect(await repo.configure(f.ctx, { nocTeamId: noc, version: 1 }, 0)).toBe(
      true,
    );
    const cmd = command('initialise', 0);
    const result = await service.execute(f.ctx, cmd);
    return { cmd, result };
  };
  const gate = async (
    template: GateRecord['template'],
    gateFields: Record<string, unknown>,
  ) => {
    const current = (await repo.load(f.ctx, incident.id))!;
    const record: GateRecord = {
      installationId: f.ctx.installationId,
      tenantId: f.tenantId,
      incidentId: incident.id,
      id: randomUUID(),
      template,
      templateVersion: 1,
      incidentVersion: current.incident.version,
      factsVersion: (await repo.facts(f.ctx, incident.id)).revision,
      evaluatedAt: f.deps.now(),
      validUntil: '2026-11-26T00:05:00.000Z',
      fields: gateFields,
    };
    return { record, saved: await repo.saveGate(f.ctx, record) };
  };
  const appendEvidence = (
    overrides: Partial<IncidentEvidence> = {},
    eventOverrides: Partial<IncidentEvidence['event']> = {},
  ) => {
    const entry: IncidentEvidence = {
      ...original,
      ...overrides,
      inboxId: randomUUID(),
      event: {
        ...original.event,
        externalEventId: String(200 + f.h.statements.length),
        kind: 'update',
        ...eventOverrides,
      },
    };
    f.h.sqlite
      .prepare('INSERT INTO incident_evidence VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(
        f.ctx.installationId,
        f.tenantId,
        entry.inboxId,
        entry.sourceId,
        entry.event.problemEventId,
        entry.event.externalEventId,
        entry.event.kind,
        JSON.stringify(entry),
      );
    return entry;
  };
  return {
    ...f,
    repo,
    ddl,
    migrateV5,
    service,
    incident,
    original,
    noc,
    department,
    assignee,
    membership,
    tier,
    command,
    initialise,
    gate,
    appendEvidence,
    setTeam: (id: string) => {
      teamId = id;
    },
    setBeforeWrite: (callback: typeof beforeWrite) => {
      beforeWrite = callback;
    },
  };
}
const operationalFields = {
  diagnosticFindings: 'Synthetic diagnosis',
  escalationJustification: 'Synthetic rationale',
  supportingEvidence: 'Synthetic evidence',
  receivingCapability: true,
  accountableEngineer: true,
  outstandingActions: 'None',
};

describe('operations durable SQL state and recovery simulation', () => {
  it('rejects a backwards server clock at the final command and checklist writes', async () => {
    const f = await fixture();
    await f.initialise();
    f.setNow('2026-11-26T00:01:00.000Z');
    await f.service.execute(f.ctx, f.command('acknowledge', 1));
    f.setNow('2026-11-26T00:00:30.000Z');
    await expect(
      f.service.execute(f.ctx, f.command('triage', 2)),
    ).rejects.toThrow('CONFLICT');
    expect((await f.repo.load(f.ctx, f.incident.id))!.incident.version).toBe(2);
    expect((await f.gate('operational', operationalFields)).saved).toBe(false);
    expect(await f.repo.history(f.ctx, f.incident.id)).toHaveLength(2);
    f.setNow('2026-11-26T00:02:00.000Z');
    expect(
      await f.service.execute(f.ctx, f.command('triage', 2)),
    ).toMatchObject({ version: 3, state: 'triage' });
  });
  it('runs additive v005 only after v004 and resumes a failed checkpoint without touching old readiness', async () => {
    const f = await fixture(false);
    f.ddl.mockClear();
    f.h.sqlite.prepare('UPDATE jsm_schema_state SET ready = 0').run();
    await expect(f.migrateV5()).rejects.toThrow('NOT_READY');
    expect(f.ddl).not.toHaveBeenCalled();
    f.h.sqlite.prepare('UPDATE jsm_schema_state SET ready = 1').run();
    const original = f.ddl.getMockImplementation()!;
    let count = 0;
    f.ddl.mockImplementation(async (query) => {
      if (++count === 4) throw new Error('synthetic DDL fault');
      return original(query);
    });
    await expect(f.migrateV5()).rejects.toThrow('NOT_READY');
    expect(await f.repo.ready(f.ctx.installationId)).toBe(false);
    f.ddl.mockImplementation(original);
    f.ddl.mockClear();
    await f.migrateV5();
    expect(f.ddl.mock.calls.map(([q]) => q)).not.toContain(
      operationsMigrations[1]!.ddl,
    );
    expect(await f.repo.ready(f.ctx.installationId)).toBe(true);
    expect(
      f.h.sqlite
        .prepare('SELECT readiness, schema_version FROM installation_metadata')
        .get(),
    ).toMatchObject({ readiness: 'ready', schema_version: 1 });
    expect(
      f.h.sqlite
        .prepare('SELECT ready, schema_version FROM jsm_schema_state')
        .get(),
    ).toMatchObject({ ready: 1, schema_version: 4 });
    f.ddl.mockClear();
    await f.migrateV5();
    expect(f.ddl).toHaveBeenCalledTimes(1);
    f.h.sqlite
      .prepare('UPDATE operations_schema_state SET checkpoints = ?')
      .run('["unknown"]');
    await expect(f.migrateV5()).rejects.toThrow('NOT_READY');
  });
  it('initialises once, projects immutable audit/receipt and preserves source incident and SLA', async () => {
    const f = await fixture();
    const { cmd, result } = await f.initialise();
    expect(result).toMatchObject({
      version: 1,
      state: 'new',
      ownerTeamId: f.noc,
      pendingMaterialisation: false,
    });
    expect(await f.service.execute(f.ctx, cmd)).toEqual(result);
    const state = (await f.repo.load(f.ctx, f.incident.id))!;
    expect(state.pending).toBe(null);
    expect(state.nocTeamId).toBe(f.noc);
    expect(state.incident.sla).toEqual(
      f.incident.sla.kind === 'selected' ? f.incident.sla.snapshot : null,
    );
    expect(await f.repo.commandTeam(f.ctx, f.incident.id, cmd.commandId)).toBe(
      f.noc,
    );
    const audit = await f.repo.history(f.ctx, f.incident.id);
    expect(audit).toHaveLength(1);
    expect(audit[0]).not.toHaveProperty('accountId');
    expect(
      f.h.sqlite
        .prepare('SELECT COUNT(*) AS total FROM operations_receipts')
        .get(),
    ).toMatchObject({ total: 1 });
    expect(await f.repo.enriched(f.ctx, f.incident.id)).toEqual(f.incident);
    expect((await f.repo.list(f.ctx))[0]!.incident.id).toBe(f.incident.id);
  });
  it('keeps receipt hidden after partial projection and replays exact pending envelope after actor revocation', async () => {
    const f = await fixture();
    await f.repo.configure(f.ctx, { nocTeamId: f.noc, version: 1 }, 0);
    f.h.failNext('INSERT INTO operations_audit');
    const cmd = f.command('initialise', 0);
    expect(await f.service.execute(f.ctx, cmd)).toMatchObject({
      pendingMaterialisation: true,
    });
    expect(await f.repo.receipt(f.ctx, f.incident.id, cmd.commandId)).toBe(
      null,
    );
    expect(await f.repo.commandTeam(f.ctx, f.incident.id, cmd.commandId)).toBe(
      f.noc,
    );
    await expect(
      f.service.execute(f.ctx, f.command('acknowledge', 1)),
    ).rejects.toThrow('REPAIR_REQUIRED');
    const pending = (await f.repo.load(f.ctx, f.incident.id))!.pending;
    expect(pending?.receipt.commandId).toBe(cmd.commandId);
    f.h.sqlite
      .prepare('UPDATE tenant_memberships SET status = ? WHERE tenant_id = ?')
      .run('revoked', f.tenantId);
    // Projection repair is a separate trusted-administrator path, not a new transition.
    expect(await f.repo.materialise(f.ctx, f.incident.id, cmd.commandId)).toBe(
      true,
    );
    expect((await f.repo.load(f.ctx, f.incident.id))!.pending).toBe(null);
    expect(await f.repo.receipt(f.ctx, f.incident.id, cmd.commandId)).not.toBe(
      null,
    );
    expect(
      f.h.sqlite
        .prepare('SELECT COUNT(*) AS total FROM operations_audit')
        .get(),
    ).toMatchObject({ total: 1 });
  });
  it('uses exact CAS, rejects stale commands and refuses a new pending envelope', async () => {
    const f = await fixture();
    await f.initialise();
    const command = f.command('acknowledge', 1);
    const results = await Promise.allSettled([
      f.service.execute(f.ctx, command),
      f.service.execute(f.ctx, f.command('acknowledge', 1)),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await f.repo.load(f.ctx, f.incident.id))!.incident.version).toBe(2);
    await expect(
      f.service.execute(f.ctx, f.command('triage', 1)),
    ).rejects.toThrow('CONFLICT');
  });
  it('retains handoff history and ownership until the target explicitly accepts', async () => {
    const f = await fixture();
    await f.initialise();
    await f.service.execute(f.ctx, f.command('acknowledge', 1));
    await f.service.execute(f.ctx, f.command('triage', 2));
    expect((await f.gate('operational', operationalFields)).saved).toBe(true);
    await f.service.execute(f.ctx, f.command('start_work', 3));
    expect((await f.gate('operational', operationalFields)).saved).toBe(true);
    const requested = await f.service.execute(
      f.ctx,
      f.command('request_handoff', 4, { targetTeamId: f.department }),
    );
    expect(requested.ownerTeamId).toBe(f.noc);
    f.setTeam(f.department);
    expect((await f.gate('operational', operationalFields)).saved).toBe(true);
    const accepted = await f.service.execute(
      f.ctx,
      f.command('accept_handoff', 5),
    );
    expect(accepted.ownerTeamId).toBe(f.department);
    expect(
      f.h.sqlite
        .prepare('SELECT COUNT(*) AS total FROM operations_handoff_history')
        .get(),
    ).toMatchObject({ total: 2 });
    const audit = await f.repo.history(f.ctx, f.incident.id);
    expect(
      audit.find((a) => a.action === 'request_handoff')?.targetTeamId,
    ).toBe(f.department);
  });
  it('counts all evidence revisions but only attributes recovery for the canonical original resource', async () => {
    const f = await fixture();
    expect(await f.repo.facts(f.ctx, f.incident.id)).toEqual({
      revision: 1,
      recoveryObservedAt: null,
    });
    f.appendEvidence(
      {},
      {
        kind: 'recovery',
        resourceId: 'synthetic:foreign',
        occurredAt: '2026-11-26T00:00:10.000Z',
      },
    );
    expect(await f.repo.facts(f.ctx, f.incident.id)).toEqual({
      revision: 2,
      recoveryObservedAt: null,
    });
    f.appendEvidence(
      {},
      { kind: 'recovery', occurredAt: '2026-11-26T00:00:20.000Z' },
    );
    expect(await f.repo.facts(f.ctx, f.incident.id)).toEqual({
      revision: 3,
      recoveryObservedAt: '2026-11-26T00:00:20.000Z',
    });
    f.h.sqlite
      .prepare('DELETE FROM incident_evidence WHERE kind = ?')
      .run('problem');
    await expect(f.repo.facts(f.ctx, f.incident.id)).rejects.toThrow(
      'NOT_READY',
    );
  });
  it('atomically rejects evidence arriving between facts read and the state CAS', async () => {
    const f = await fixture();
    await f.initialise();
    let injected = false;
    f.setBeforeWrite((query) => {
      if (
        !injected &&
        query.startsWith('UPDATE operations_state SET version')
      ) {
        injected = true;
        f.appendEvidence({}, { resourceId: 'synthetic:conflicting-update' });
      }
    });
    await expect(
      f.service.execute(f.ctx, f.command('acknowledge', 1)),
    ).rejects.toThrow('CONFLICT');
    expect((await f.repo.load(f.ctx, f.incident.id))!.incident.version).toBe(1);
  });
  it.each(['tenant-membership', 'assignee', 'team-membership', 'team', 'tier'])(
    'rejects %s revocation at the final state write',
    async (kind) => {
      const f = await fixture();
      await f.initialise();
      let injected = false;
      f.setBeforeWrite((query) => {
        if (
          !injected &&
          query.startsWith('UPDATE operations_state SET version')
        ) {
          injected = true;
          if (kind === 'tenant-membership')
            f.h.sqlite
              .prepare(
                'UPDATE tenant_memberships SET status = ? WHERE tenant_id = ?',
              )
              .run('revoked', f.tenantId);
          else if (kind === 'assignee')
            f.h.sqlite
              .prepare('UPDATE assignees SET status = ? WHERE id = ?')
              .run('disabled', f.assignee);
          else if (kind === 'team-membership')
            f.h.sqlite
              .prepare('UPDATE team_memberships SET status = ? WHERE id = ?')
              .run('revoked', f.membership);
          else if (kind === 'team')
            f.h.sqlite
              .prepare('UPDATE teams SET status = ? WHERE id = ?')
              .run('retired', f.noc);
          else
            f.h.sqlite
              .prepare('UPDATE sla_tiers SET status = ? WHERE id = ?')
              .run('retired', f.tier);
        }
      });
      await expect(
        f.service.execute(f.ctx, f.command('acknowledge', 1)),
      ).rejects.toThrow('CONFLICT');
      expect((await f.repo.load(f.ctx, f.incident.id))!.incident.version).toBe(
        1,
      );
    },
  );
  it('binds stored gates to current facts/version and keeps actor attribution out of the gate DTO', async () => {
    const f = await fixture();
    await f.initialise();
    const current = (await f.repo.load(f.ctx, f.incident.id))!;
    const { record, saved } = await f.gate('operational', operationalFields);
    expect(saved).toBe(true);
    expect(await f.repo.gate(f.ctx, current, 'start_work')).toEqual(record);
    expect(await f.repo.gate(f.ctx, current, 'acknowledge')).toBe(null);
    expect(record).not.toHaveProperty('actor_id');
    expect(
      await f.repo.saveGate(f.ctx, {
        ...record,
        id: randomUUID(),
        incidentVersion: 2,
      }),
    ).toBe(false);
    expect(
      await f.repo.saveGate(f.ctx, {
        ...record,
        id: randomUUID(),
        factsVersion: 2,
      }),
    ).toBe(false);
    await expect(
      f.repo.saveGate(f.ctx, {
        ...record,
        id: randomUUID(),
        fields: { ...record.fields, extra: 'private' },
      }),
    ).rejects.toThrow('INVALID');
    f.appendEvidence();
    expect(await f.repo.gate(f.ctx, current, 'start_work')).toBe(null);
    expect(
      await f.repo.nativeConfirmation(f.ctx, f.incident.id, 'resolve'),
    ).toBe(null);
  });
  it('denies wrong tenant/installation and prevents NOC configuration drift on existing incidents', async () => {
    const f = await fixture();
    await f.initialise();
    await expect(
      f.repo.load(
        { ...f.ctx, installationId: 'foreign-synthetic' },
        f.incident.id,
      ),
    ).rejects.toThrow('NOT_READY');
    const other = (
      await f.h.service.bootstrap({
        name: 'Synthetic second ISP',
        slug: 'synthetic-second',
      })
    ).tenantId;
    expect(
      await f.repo.load({ ...f.ctx, tenantId: other }, f.incident.id),
    ).toBe(null);
    expect(await f.repo.configuration({ ...f.ctx, tenantId: other })).toBe(
      null,
    );
    expect(
      await f.repo.configure(f.ctx, { nocTeamId: f.department, version: 2 }, 1),
    ).toBe(true);
    await expect(
      f.service.execute(f.ctx, f.command('acknowledge', 1)),
    ).rejects.toThrow('CONFLICT');
  });
});
