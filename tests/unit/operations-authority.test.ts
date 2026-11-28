// Mocked SQL-driver authority tests, not native RBAC or installation isolation evidence.
import { expect, it, vi } from 'vitest';
import { SqlOperationAuthority } from '../../src/infrastructure/operations/authority';
import type { SqlDriver } from '../../src/infrastructure/sql/driver';
import type { TenantContext } from '../../src/application/ports/tenant-context';
import type {
  OperationAggregate,
  OperationCommand,
} from '../../src/application/operations/contracts';

const id = (n: number) =>
  `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const now = '2026-11-27T00:10:00.000Z';
function fixture() {
  const ctx: TenantContext = {
    installationId: 'installation-example',
    tenantId: id(1),
    actor: { kind: 'atlassian-user', accountId: 'synthetic-account' },
  };
  const noc = id(2),
    owner = id(3),
    receiving = id(4),
    assignee = id(5),
    incidentId = id(6);
  let selectedTeam = owner;
  let members:
    | {
        role: unknown;
        assignee_id: string;
        team_id: string;
        team_role: unknown;
      }[]
    | null = null;
  let targets: { id: string }[] | null = null;
  const row: OperationAggregate = {
    installationId: ctx.installationId,
    tenantId: ctx.tenantId,
    nocTeamId: noc,
    factsVersion: 1,
    validation: null,
    pending: null,
    lease: null,
    incident: {
      id: incidentId,
      tenantId: ctx.tenantId,
      state: 'in_progress',
      version: 4,
      ownerTeamId: owner,
      ownerAssigneeId: assignee,
      pendingHandoff: null,
      pendingReturn: null,
      recoveryObservedAt: null,
      restorationValidatedAt: null,
      resolvedAt: null,
      sla: {
        policyId: id(7),
        policyVersion: 1,
        tierId: id(8),
        consideredTierIds: [id(8)],
        priority: 'P1',
        severity: '4',
        confidence: 'known',
        reason: 'STRICTEST_AFFECTED_TIER',
        clock: 'elapsed-utc',
        startedAt: '2026-11-27T00:00:00.000Z',
        durationSeconds: 3600,
        warningSeconds: 1800,
        warningAt: '2026-11-27T00:30:00.000Z',
        deadlineAt: '2026-11-27T01:00:00.000Z',
      },
    },
  };
  const repository = {
    configuration: vi.fn<
      (
        ctx: TenantContext,
      ) => Promise<{ nocTeamId: string; version: number } | null>
    >(async () => ({ nocTeamId: noc, version: 1 })),
    load: vi.fn<
      (
        ctx: TenantContext,
        incidentId: string,
      ) => Promise<OperationAggregate | null>
    >(async () => row),
    commandTeam: vi.fn<
      (
        ctx: TenantContext,
        incidentId: string,
        commandId: string,
      ) => Promise<string | null>
    >(async () => null),
  };
  const rows = vi.fn<SqlDriver['rows']>(
    async <T>(
      query: string,
      params: Parameters<SqlDriver['write']>[1],
    ): Promise<T[]> => {
      if (query.startsWith('SELECT m.role')) {
        selectedTeam = params[7] as string;
        return (members ?? [
          {
            role: 'operator',
            assignee_id: assignee,
            team_id: selectedTeam,
            team_role: 'engineer',
          },
        ]) as T[];
      }
      return (targets ?? [{ id: params[3] as string }]) as T[];
    },
  );
  const db: SqlDriver = {
    rows: async <T>(
      query: string,
      params: Parameters<SqlDriver['rows']>[1],
    ): Promise<T[]> => (await rows(query, params)) as T[],
    write: vi.fn(async () => 0),
  };
  const authority = new SqlOperationAuthority(db, repository, () => now);
  const command = (
    kind: OperationCommand['kind'] = 'acknowledge',
    extra: Partial<OperationCommand> = {},
  ): OperationCommand => ({
    commandId: id(9),
    incidentId,
    expected: 4,
    kind,
    ...extra,
  });
  return {
    ctx,
    noc,
    owner,
    receiving,
    assignee,
    incidentId,
    row,
    repository,
    db,
    rows,
    authority,
    command,
    setMembers: (value: typeof members) => {
      members = value;
    },
    setTargets: (value: typeof targets) => {
      targets = value;
    },
  };
}

it('selects the server configured NOC for initialise and current owner for ordinary mutations', async () => {
  const f = fixture();
  expect(
    await f.authority.authorise(f.ctx, f.command('initialise')),
  ).toMatchObject({
    tenantId: f.ctx.tenantId,
    teamId: f.noc,
    nocTeamId: f.noc,
    role: 'operator',
  });
  expect(
    await f.authority.authorise(f.ctx, f.command('acknowledge')),
  ).toMatchObject({ teamId: f.owner });
  expect(f.repository.configuration).toHaveBeenCalledWith(f.ctx);
  expect(f.repository.load).toHaveBeenCalledWith(f.ctx, f.incidentId);
  expect(f.db.write).not.toHaveBeenCalled();
});

it('requires pending target membership for handoff acceptance/rejection and configured NOC for return acceptance/rejection', async () => {
  const f = fixture();
  await expect(
    f.authority.authorise(f.ctx, f.command('accept_handoff')),
  ).rejects.toThrow('CONFLICT');
  f.repository.load.mockResolvedValue({
    ...f.row,
    incident: {
      ...f.row.incident,
      pendingHandoff: { targetTeamId: f.receiving, requestedAt: now },
    },
  });
  for (const kind of ['accept_handoff', 'reject_handoff'] as const)
    expect(await f.authority.authorise(f.ctx, f.command(kind))).toMatchObject({
      teamId: f.receiving,
    });
  for (const kind of ['accept_return', 'reject_return'] as const)
    expect(await f.authority.authorise(f.ctx, f.command(kind))).toMatchObject({
      teamId: f.noc,
    });
  expect(
    await f.authority.authorise(f.ctx, f.command('request_return')),
  ).toMatchObject({ teamId: f.owner });
});

it('replay uses the original acting team but rechecks fresh membership before returning authority', async () => {
  const f = fixture();
  f.repository.commandTeam.mockResolvedValue(f.receiving);
  expect(await f.authority.authorise(f.ctx, f.command())).toMatchObject({
    teamId: f.receiving,
  });
  expect(f.rows.mock.calls[0]?.[1][7]).toBe(f.receiving);
  f.setMembers([]);
  await expect(f.authority.authorise(f.ctx, f.command())).rejects.toThrow(
    'DENIED',
  );
  expect(f.rows).toHaveBeenCalledTimes(2);
  expect(f.repository.commandTeam).toHaveBeenCalledWith(
    f.ctx,
    f.incidentId,
    f.command().commandId,
  );
});

it('denies missing configuration/aggregate and foreign aggregate installation/tenant/incident references', async () => {
  const f = fixture();
  f.repository.configuration.mockResolvedValueOnce(null);
  await expect(f.authority.authorise(f.ctx, f.command())).rejects.toThrow(
    'NOT_READY',
  );
  expect(f.rows).not.toHaveBeenCalled();
  f.repository.load.mockResolvedValueOnce(null);
  await expect(f.authority.authorise(f.ctx, f.command())).rejects.toThrow(
    'NOT_READY',
  );
  for (const row of [
    { ...f.row, installationId: 'foreign-installation' },
    { ...f.row, tenantId: id(99) },
    { ...f.row, incident: { ...f.row.incident, id: id(99) } },
  ]) {
    f.repository.load.mockResolvedValueOnce(row);
    await expect(f.authority.authorise(f.ctx, f.command())).rejects.toThrow(
      'DENIED',
    );
  }
  expect(f.rows).not.toHaveBeenCalled();
});

it('requires active unexpired mapped membership, nonpending teams and installation/tenant predicates in the actual membership query', async () => {
  const f = fixture();
  await f.authority.authorise(f.ctx, f.command());
  const [query, params] = f.rows.mock.calls[0]!;
  for (const predicate of [
    't.installation_id = ?',
    't.id = ?',
    't.status = ?',
    't.pending_mutation IS NULL',
    'm.account_id = ?',
    'm.status = ?',
    '(m.expires_at IS NULL OR m.expires_at > ?)',
    'a.atlassian_account_id = m.account_id',
    'a.status = ?',
    'a.pending IS NULL',
    'tm.assignee_id = a.id',
    'tm.team_id = ?',
    'tm.status = ?',
    'tm.pending IS NULL',
    '(tm.effective_until IS NULL OR tm.effective_until > ?)',
    'team.status = ?',
    'team.pending IS NULL',
    'noc.id = ?',
    'noc.status = ?',
    'noc.pending IS NULL',
  ])
    expect(query).toContain(predicate);
  expect(params).toEqual([
    f.ctx.installationId,
    f.ctx.tenantId,
    'active',
    'synthetic-account',
    'active',
    now,
    'active',
    f.owner,
    'active',
    now,
    'active',
    f.noc,
    'active',
  ]);
  // The injected driver simulates the database excluding inactive/expired/unmapped rows.
  // Predicate assertions above establish filtering intent; this is not native RBAC evidence.
  f.setMembers([]);
  await expect(f.authority.authorise(f.ctx, f.command())).rejects.toThrow(
    'DENIED',
  );
});

it('denies ambiguous mappings, viewer membership, wrong returned team and nonuser actors', async () => {
  const f = fixture();
  const valid = {
    role: 'operator',
    assignee_id: f.assignee,
    team_id: f.owner,
    team_role: 'engineer',
  };
  for (const members of [
    [valid, valid],
    [{ ...valid, role: 'viewer' }],
    [{ ...valid, team_id: f.receiving }],
  ]) {
    f.setMembers(members);
    await expect(f.authority.authorise(f.ctx, f.command())).rejects.toThrow(
      'DENIED',
    );
  }
  f.rows.mockClear();
  for (const actor of [
    { kind: 'system' as const },
    { kind: 'monitoring-source' as const, sourceId: id(10) },
  ])
    await expect(
      f.authority.authorise({ ...f.ctx, actor }, f.command()),
    ).rejects.toThrow('DENIED');
  expect(f.rows).not.toHaveBeenCalled();
});

it('checks the target team through the same active tenant/install scope and rejects foreign or ambiguous targets', async () => {
  const f = fixture();
  const command = f.command('request_handoff', { targetTeamId: f.receiving });
  expect(await f.authority.authorise(f.ctx, command)).toMatchObject({
    teamId: f.owner,
  });
  const [query, params] = f.rows.mock.calls[1]!;
  expect(query).toContain('t.installation_id = ?');
  expect(query).toContain('t.id = ?');
  expect(query).toContain('t.pending_mutation IS NULL');
  expect(query).toContain('team.status = ? AND team.pending IS NULL');
  expect(params).toEqual([
    f.ctx.installationId,
    f.ctx.tenantId,
    'active',
    f.receiving,
    'active',
  ]);
  for (const targets of [
    [],
    [{ id: f.owner }],
    [{ id: f.receiving }, { id: f.receiving }],
  ]) {
    f.setTargets(targets);
    await expect(f.authority.authorise(f.ctx, command)).rejects.toThrow(
      'DENIED',
    );
  }
});

it('a configured foreign NOC cannot authorise through a membership result excluded by the scoped NOC join', async () => {
  const f = fixture();
  f.repository.configuration.mockResolvedValue({
    nocTeamId: id(99),
    version: 1,
  });
  f.setMembers([]);
  await expect(
    f.authority.authorise(f.ctx, f.command('initialise')),
  ).rejects.toThrow('DENIED');
  expect(f.rows.mock.calls[0]?.[1][7]).toBe(id(99));
  expect(f.rows.mock.calls[0]?.[1][11]).toBe(id(99));
});

it('authorises engineer reassignment only for fresh stored team lead or administrator even when not the assigned engineer', async () => {
  const f = fixture();
  const command = f.command('assign', {
    targetAssigneeId: id(20),
    reason: 'Synthetic reassignment',
  });
  const member = {
    role: 'operator',
    assignee_id: id(21),
    team_id: f.owner,
    team_role: 'lead',
  };
  f.setMembers([member]);
  expect(await f.authority.authorise(f.ctx, command)).toMatchObject({
    role: 'operator',
    teamRole: 'lead',
    assigneeId: id(21),
    teamId: f.owner,
  });
  f.setMembers([{ ...member, role: 'admin', team_role: 'engineer' }]);
  expect(await f.authority.authorise(f.ctx, command)).toMatchObject({
    role: 'admin',
    teamRole: 'engineer',
  });
  f.setMembers([{ ...member, team_role: 'engineer' }]);
  await expect(
    f.authority.authorise(f.ctx, {
      ...command,
      teamRole: 'lead',
      role: 'admin',
    } as OperationCommand),
  ).rejects.toThrow('DENIED');
  for (const invalid of [undefined, null, 'Lead', ['lead'], true]) {
    f.setMembers([{ ...member, team_role: invalid }]);
    await expect(f.authority.authorise(f.ctx, command)).rejects.toThrow(
      'DENIED',
    );
  }
});

it('binds reassignment target to active mapped same-owner-team membership and an unexpired operational tenant grant', async () => {
  const f = fixture();
  const target = id(20);
  f.setMembers([
    {
      role: 'admin',
      assignee_id: f.assignee,
      team_id: f.owner,
      team_role: 'engineer',
    },
  ]);
  const command = f.command('assign', {
    targetAssigneeId: target,
    reason: 'Synthetic reassignment',
  });
  await f.authority.authorise(f.ctx, command);
  const [query, params] = f.rows.mock.calls[1]!;
  expect(query).toContain('t.installation_id = ?');
  expect(query).toContain('a.tenant_id = t.id');
  expect(query).toContain('a.atlassian_account_id IS NOT NULL');
  expect(query).toContain('tm.team_id = ?');
  expect(query).toContain('m.role IN (?, ?)');
  expect(query).toContain(
    '(tm.effective_until IS NULL OR tm.effective_until > ?)',
  );
  expect(query).toContain('(m.expires_at IS NULL OR m.expires_at > ?)');
  expect(params).toEqual([
    f.ctx.installationId,
    f.ctx.tenantId,
    'active',
    target,
    'active',
    f.owner,
    'active',
    'engineer',
    'lead',
    now,
    'active',
    'active',
    'operator',
    'admin',
    now,
  ]);
  for (const targets of [
    [],
    [{ id: f.assignee }],
    [{ id: target }, { id: target }],
  ]) {
    f.setTargets(targets);
    await expect(f.authority.authorise(f.ctx, command)).rejects.toThrow(
      'DENIED',
    );
  }
  await expect(
    f.authority.authorise(f.ctx, { ...command, targetTeamId: f.receiving }),
  ).rejects.toThrow('INVALID');
  await expect(
    f.authority.authorise(
      f.ctx,
      f.command('acknowledge', { targetAssigneeId: target }),
    ),
  ).rejects.toThrow('INVALID');
});

it('historical assignment replay keeps the original acting team and refreshes privilege without reauthorising a historical target', async () => {
  const f = fixture();
  f.repository.commandTeam.mockResolvedValue(f.owner);
  f.setMembers([
    {
      role: 'operator',
      assignee_id: f.assignee,
      team_id: f.owner,
      team_role: 'lead',
    },
  ]);
  const command = f.command('assign', {
    targetAssigneeId: id(20),
    reason: 'Synthetic historical reason',
  });
  expect(await f.authority.authorise(f.ctx, command)).toMatchObject({
    teamId: f.owner,
    teamRole: 'lead',
  });
  expect(f.rows).toHaveBeenCalledTimes(1);
  f.setMembers([
    {
      role: 'operator',
      assignee_id: f.assignee,
      team_id: f.owner,
      team_role: 'engineer',
    },
  ]);
  await expect(f.authority.authorise(f.ctx, command)).rejects.toThrow('DENIED');
});
