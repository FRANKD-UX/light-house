// Adapted SQLite + injected visibility proof only; no Jira API/native permission evidence.
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { database } from '../support/sqlite';
import monitoring from '../../src/infrastructure/sql/migrations.v002.json';
import incidents from '../../src/infrastructure/sql/migrations.v003.json';
import jsm from '../../src/infrastructure/sql/migrations.v004.json';
import operations from '../../src/infrastructure/sql/migrations.v005.json';
import { SqlJsmContextRepository } from '../../src/infrastructure/sql/jsm-context-repository';
import { JsmContextService } from '../../src/application/jsm-context/service';
import type { JsmContextSession } from '../../src/application/jsm-context/contracts';
import type { Incident } from '../../src/domain/incidents/model';
import type { SqlDriver } from '../../src/infrastructure/sql/driver';
const at = '2026-11-28T00:00:00.000Z';
async function fixture(allowDuplicate = false) {
  const h = database(),
    tenantId = await h.setup();
  for (const migration of [...monitoring, ...incidents, ...jsm, ...operations])
    h.sqlite.exec(
      migration.ddl
        .replace(
          allowDuplicate
            ? /, UNIQUE KEY uq_jsm_issue \(installation_id, issue_id\)/g
            : /UNMATCHABLE_CONSTRAINT/g,
          '',
        )
        .replace(/ CHARACTER SET utf8mb4 COLLATE utf8mb4_bin/g, '')
        .replace(/,\s*INDEX \w+ \([^)]*\)/g, '')
        .replace(/UNIQUE KEY \w+/g, 'UNIQUE'),
    );
  for (const [table, version] of [
    ['monitoring_schema_state', 2],
    ['incident_schema_state', 3],
    ['jsm_schema_state', 4],
    ['operations_schema_state', 5],
  ] as const)
    h.sqlite
      .prepare(`INSERT INTO ${table} VALUES (?, ?, 1, '[]', ?)`)
      .run(h.session.installationId, version, at);
  const session: JsmContextSession = {
      installationId: h.session.installationId,
      accountId: h.session.accountId,
      projectId: '100',
    },
    incidentId = randomUUID();
  const incident: Incident = {
    id: incidentId,
    installationId: session.installationId,
    tenantId,
    sourceId: randomUUID(),
    problemEventId: '100',
    correlationId: randomUUID(),
    createdAt: at,
    occurredAt: at,
    state: 'manual_triage',
    version: 1,
    impact: {
      confidence: 'unknown',
      reason: 'INCOMPLETE_INVENTORY',
      siteId: randomUUID(),
      uplinkId: randomUUID(),
      carrierId: randomUUID(),
      affectedServiceIds: [],
      affectedCustomerIds: [],
      potentiallyAffectedCustomerIds: [],
      potentiallyAffectedServiceIds: [],
      protectedServiceIds: [],
      uncertainServiceIds: [],
      tierIds: [],
    },
    sla: { kind: 'manual_triage', reason: 'POLICY_GAP' },
  };
  h.sqlite
    .prepare('INSERT INTO incidents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(
      session.installationId,
      tenantId,
      incidentId,
      incident.sourceId,
      '100',
      at,
      at,
      'manual_triage',
      1,
      JSON.stringify({ ...incident, privateActor: 'private-source-actor' }),
    );
  const config = {
    installationId: session.installationId,
    tenantId,
    version: 1,
    projectId: session.projectId,
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
  h.sqlite
    .prepare('INSERT INTO jsm_configuration VALUES (?, ?, 1, ?)')
    .run(session.installationId, tenantId, JSON.stringify(config));
  const linkId = randomUUID();
  h.sqlite
    .prepare(
      "INSERT INTO jsm_intents (installation_id, tenant_id, id, incident_id, marker, configuration_json, request_json, state, version, attempts, reconciliations, due_at, lease_token, lease_until, issue_id, issue_key, reason, audit_json) VALUES (?, ?, ?, ?, ?, ?, ?, 'linked', 3, 1, 0, NULL, NULL, NULL, '10000', 'SYNTH-1', NULL, ?)",
    )
    .run(
      session.installationId,
      tenantId,
      linkId,
      incidentId,
      'light-house-' + linkId,
      JSON.stringify(config),
      '{"private":"private-request"}',
      '[{"private":"private-audit"}]',
    );
  const team = randomUUID(),
    pendingCommand = randomUUID();
  const op = {
    installationId: session.installationId,
    tenantId,
    nocTeamId: team,
    incident: {
      id: incidentId,
      tenantId,
      state: 'in_progress',
      version: 4,
      ownerTeamId: team,
      ownerAssigneeId: randomUUID(),
      pendingHandoff: null,
      pendingReturn: null,
      resolvedAt: null,
    },
    pending: {
      receipt: { commandId: pendingCommand },
      audit: { accountId: 'private-operational-actor' },
    },
    lease: { token: 'private-lease' },
  };
  h.sqlite
    .prepare('INSERT INTO operations_state VALUES (?, ?, ?, 4, 1, ?, ?, ?, ?)')
    .run(
      session.installationId,
      tenantId,
      incidentId,
      JSON.stringify(op),
      pendingCommand,
      JSON.stringify(op.pending),
      at,
    );
  let beforeRead: ((query: string) => void) | null = null;
  const write = vi.fn(async () => {
    throw new Error('UNEXPECTED_WRITE');
  });
  const db: SqlDriver = {
    rows: async <T>(
      query: string,
      params: Parameters<SqlDriver['rows']>[1],
    ) => {
      beforeRead?.(query);
      return h.db.rows<T>(query, params);
    },
    write,
  };
  const repository = new SqlJsmContextRepository(db, () => at);
  const visibility = {
    verify: vi.fn(async (current: JsmContextSession, issueId: string) => ({
      mode: 'asUser',
      issueId,
      projectId: current.projectId,
      accountId: current.accountId,
      browseAllowed: true,
      issueSecurityAllowed: true,
    })),
  };
  return {
    ...h,
    session,
    tenantId,
    incidentId,
    incident,
    op,
    repository,
    visibility,
    contextService: new JsmContextService(repository, visibility),
    write,
    beforeRead: (hook: typeof beforeRead) => {
      beforeRead = hook;
    },
  };
}
describe('linked Jira context SQL read boundary', () => {
  it('resolves installation+issue internally and returns safe incident/current operation without any writes', async () => {
    const f = await fixture();
    f.statements.length = 0;
    const result = await f.contextService.lookup(f.session, '10000');
    expect(result).toMatchObject({
      kind: 'available',
      incident: { id: f.incidentId, tenantId: f.tenantId },
      operations: {
        readiness: 'ready',
        summary: {
          state: 'in_progress',
          version: 4,
          pendingMaterialisation: true,
        },
      },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /installationId|accountId|private-|request_json|audit_json|configuration_json|lease|commandId/,
    );
    expect(f.write).not.toHaveBeenCalled();
    expect(f.statements.every((s) => s.query.startsWith('SELECT'))).toBe(true);
    const reverse = f.statements.find((s) =>
      s.query.startsWith('SELECT tenant_id, incident_id'),
    )!;
    expect(reverse.params).toEqual([f.session.installationId, '10000']);
    expect(reverse.query).toContain('LIMIT 2');
    const snapshot = f.statements.find((s) =>
      s.query.includes('AS link_configuration_json'),
    )!;
    expect(snapshot.query).toContain('m.role IN (?, ?, ?)');
    expect(snapshot.query).toContain(
      '(m.expires_at IS NULL OR m.expires_at > ?)',
    );
    expect(snapshot.query).toContain('t.pending_mutation IS NULL');
    expect(snapshot.params.slice(0, 4)).toEqual([
      f.session.installationId,
      '10000',
      f.tenantId,
      f.incidentId,
    ]);
  });
  it('allows current viewers while hiding the mapping identically after grant expiry/revocation or missing membership', async () => {
    const f = await fixture(),
      account = 'synthetic-viewer';
    await f.service.grant({
      tenantId: f.tenantId,
      accountId: account,
      role: 'viewer',
      expiresAt: null,
      expected: null,
      status: 'active',
    });
    const viewer = { ...f.session, accountId: account };
    expect(await f.contextService.lookup(viewer, '10000')).toMatchObject({
      kind: 'available',
    });
    f.sqlite
      .prepare(
        'UPDATE tenant_memberships SET expires_at = ? WHERE tenant_id = ? AND account_id = ?',
      )
      .run(at, f.tenantId, account);
    expect(await f.contextService.lookup(viewer, '10000')).toEqual({
      kind: 'unavailable',
      reason: 'NOT_AVAILABLE',
    });
    f.sqlite
      .prepare(
        'UPDATE tenant_memberships SET expires_at = NULL, status = ? WHERE tenant_id = ? AND account_id = ?',
      )
      .run('revoked', f.tenantId, account);
    expect(await f.contextService.lookup(viewer, '10000')).toEqual({
      kind: 'unavailable',
      reason: 'NOT_AVAILABLE',
    });
    expect(
      await f.contextService.lookup(
        { ...f.session, accountId: 'synthetic-nonmember' },
        '10000',
      ),
    ).toEqual({ kind: 'unavailable', reason: 'NOT_AVAILABLE' });
  });
  it('does not expose a mapped tenant when a grant is revoked between reverse lookup and the final snapshot read', async () => {
    const f = await fixture();
    f.beforeRead((query) => {
      if (query.includes('AS link_configuration_json'))
        f.sqlite
          .prepare(
            'UPDATE tenant_memberships SET status = ? WHERE tenant_id = ?',
          )
          .run('revoked', f.tenantId);
    });
    expect(await f.contextService.lookup(f.session, '10000')).toEqual({
      kind: 'unavailable',
      reason: 'NOT_AVAILABLE',
    });
    expect(f.write).not.toHaveBeenCalled();
  });
  it('requires a positively verified current Jira project to match the immutable linked creation configuration', async () => {
    const f = await fixture();
    expect(
      await f.contextService.lookup(
        { ...f.session, projectId: '999' },
        '10000',
      ),
    ).toEqual({ kind: 'unavailable', reason: 'NOT_AVAILABLE' });
    f.sqlite.prepare('UPDATE jsm_configuration SET configuration_json = ?').run(
      JSON.stringify({
        ...JSON.parse(
          (
            f.sqlite
              .prepare('SELECT configuration_json FROM jsm_configuration')
              .get() as { configuration_json: string }
          ).configuration_json,
        ),
        projectId: '999',
      }),
    );
    // Later tenant configuration does not overwrite the historical link's project binding.
    expect(await f.contextService.lookup(f.session, '10000')).toMatchObject({
      kind: 'available',
    });
  });
  it('reports absent config/unknown link/readiness explicitly but masks inaccessible links', async () => {
    const f = await fixture();
    expect(await f.contextService.lookup(f.session, '99999')).toEqual({
      kind: 'unavailable',
      reason: 'NOT_AVAILABLE',
    });
    f.sqlite.prepare('UPDATE jsm_intents SET state = ?').run('unexpected');
    expect(await f.contextService.lookup(f.session, '10000')).toEqual({
      kind: 'unavailable',
      reason: 'NOT_READY',
    });
    f.sqlite.prepare('UPDATE jsm_intents SET state = ?').run('linked');
    f.sqlite.prepare('DELETE FROM jsm_configuration').run();
    expect(await f.contextService.lookup(f.session, '10000')).toEqual({
      kind: 'unavailable',
      reason: 'NOT_READY',
    });
    f.sqlite.prepare('UPDATE jsm_schema_state SET ready = 0').run();
    expect(await f.contextService.lookup(f.session, '10000')).toEqual({
      kind: 'unavailable',
      reason: 'NOT_READY',
    });
  });
  it('distinguishes operation schema not-ready, absent operation and unavailable operation metadata without fabricating state', async () => {
    const f = await fixture();
    f.sqlite.prepare('UPDATE operations_schema_state SET ready = 0').run();
    expect(await f.contextService.lookup(f.session, '10000')).toMatchObject({
      kind: 'available',
      operations: { readiness: 'not-ready', summary: null },
    });
    f.sqlite.prepare('UPDATE operations_schema_state SET ready = 1').run();
    f.sqlite.prepare('DELETE FROM operations_state').run();
    expect(await f.contextService.lookup(f.session, '10000')).toMatchObject({
      kind: 'available',
      operations: { readiness: 'ready', summary: null },
    });
    f.beforeRead((query) => {
      if (query.startsWith('SELECT ready FROM operations_schema_state'))
        throw new Error('private SQL metadata error');
    });
    expect(await f.contextService.lookup(f.session, '10000')).toMatchObject({
      kind: 'available',
      operations: { readiness: 'unavailable', summary: null },
    });
  });
  it('fails closed on duplicate issue mappings rather than selecting one tenant incident', async () => {
    const f = await fixture(true);
    const row = f.sqlite.prepare('SELECT * FROM jsm_intents').get() as Record<
      string,
      string | number | null
    >;
    f.sqlite
      .prepare(
        'INSERT INTO jsm_intents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        f.session.installationId,
        f.tenantId,
        randomUUID(),
        randomUUID(),
        'light-house-' + randomUUID(),
        row.configuration_json!,
        row.request_json!,
        'linked',
        3,
        1,
        0,
        null,
        null,
        null,
        '10000',
        'SYNTH-1',
        null,
        '[]',
      );
    expect(await f.contextService.lookup(f.session, '10000')).toEqual({
      kind: 'unavailable',
      reason: 'NOT_READY',
    });
    expect(f.write).not.toHaveBeenCalled();
  });
  it('does not traverse the link with a wrong installation, foreign snapshot or pending/suspended tenant', async () => {
    const f = await fixture();
    expect(
      await f.contextService.lookup(
        { ...f.session, installationId: 'foreign-installation' },
        '10000',
      ),
    ).toEqual({ kind: 'unavailable', reason: 'NOT_READY' });
    f.sqlite
      .prepare('UPDATE incidents SET snapshot_json = ?')
      .run(JSON.stringify({ ...f.incident, tenantId: randomUUID() }));
    expect(await f.contextService.lookup(f.session, '10000')).toEqual({
      kind: 'unavailable',
      reason: 'UNAVAILABLE',
    });
    f.sqlite
      .prepare('UPDATE isp_tenants SET pending_mutation = ?')
      .run('synthetic pending');
    expect(await f.contextService.lookup(f.session, '10000')).toEqual({
      kind: 'unavailable',
      reason: 'NOT_AVAILABLE',
    });
    f.sqlite
      .prepare('UPDATE isp_tenants SET pending_mutation = NULL, status = ?')
      .run('suspended');
    expect(await f.contextService.lookup(f.session, '10000')).toEqual({
      kind: 'unavailable',
      reason: 'NOT_AVAILABLE',
    });
  });
});
