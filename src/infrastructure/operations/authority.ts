import type { TenantContext } from '../../application/ports/tenant-context';
import {
  OperationError,
  type OperationAggregate,
  type OperationCommand,
} from '../../application/operations/contracts';
import type { WorkflowActor } from '../../domain/incidents/workflow';
import { role, utc, uuid } from '../../domain/inventory/model';
import type { SqlDriver } from '../sql/driver';
interface AuthorityRepository {
  configuration(
    ctx: TenantContext,
  ): Promise<{ nocTeamId: string; version: number } | null>;
  load(
    ctx: TenantContext,
    incidentId: string,
  ): Promise<OperationAggregate | null>;
  commandTeam(
    ctx: TenantContext,
    incidentId: string,
    commandId: string,
  ): Promise<string | null>;
}
/** Resolves team authority exclusively from current stored Atlassian/manual membership. */
export class SqlOperationAuthority {
  constructor(
    private readonly db: SqlDriver,
    private readonly repository: AuthorityRepository,
    private readonly now: () => string,
  ) {}
  async authorise(
    ctx: TenantContext,
    command: OperationCommand,
  ): Promise<WorkflowActor> {
    if (ctx.actor.kind !== 'atlassian-user') throw new OperationError('DENIED');
    if (
      (command.targetTeamId !== undefined &&
        command.kind !== 'request_handoff') ||
      (command.targetAssigneeId !== undefined && command.kind !== 'assign')
    )
      throw new OperationError('INVALID');
    const config = await this.repository.configuration(ctx);
    if (!config) throw new OperationError('NOT_READY');
    const nocTeamId = uuid(config.nocTeamId);
    const current = await this.repository.load(ctx, command.incidentId);
    const replayTeam = await this.repository.commandTeam(
      ctx,
      command.incidentId,
      command.commandId,
    );
    let teamId: string;
    if (replayTeam) teamId = uuid(replayTeam);
    else if (command.kind === 'initialise') teamId = nocTeamId;
    else {
      if (!current) throw new OperationError('NOT_READY');
      if (
        current.installationId !== ctx.installationId ||
        current.tenantId !== ctx.tenantId ||
        current.incident.id !== command.incidentId
      )
        throw new OperationError('DENIED');
      if (
        command.kind === 'accept_handoff' ||
        command.kind === 'reject_handoff'
      ) {
        if (!current.incident.pendingHandoff)
          throw new OperationError('CONFLICT');
        teamId = uuid(current.incident.pendingHandoff.targetTeamId);
      } else if (
        command.kind === 'accept_return' ||
        command.kind === 'reject_return'
      )
        teamId = nocTeamId;
      else teamId = uuid(current.incident.ownerTeamId);
    }
    const now = utc(this.now());
    const members = await this.db.rows<{
      role: unknown;
      assignee_id: string;
      team_id: string;
      team_role: unknown;
    }>(
      'SELECT m.role, a.id AS assignee_id, tm.team_id, tm.role AS team_role FROM isp_tenants t JOIN tenant_memberships m ON m.tenant_id = t.id JOIN assignees a ON a.tenant_id = t.id AND a.atlassian_account_id = m.account_id JOIN team_memberships tm ON tm.tenant_id = t.id AND tm.assignee_id = a.id JOIN teams team ON team.tenant_id = t.id AND team.id = tm.team_id JOIN teams noc ON noc.tenant_id = t.id WHERE t.installation_id = ? AND t.id = ? AND t.status = ? AND t.pending_mutation IS NULL AND m.account_id = ? AND m.status = ? AND (m.expires_at IS NULL OR m.expires_at > ?) AND a.status = ? AND a.pending IS NULL AND tm.team_id = ? AND tm.status = ? AND tm.pending IS NULL AND (tm.effective_until IS NULL OR tm.effective_until > ?) AND team.status = ? AND team.pending IS NULL AND noc.id = ? AND noc.status = ? AND noc.pending IS NULL',
      [
        ctx.installationId,
        ctx.tenantId,
        'active',
        ctx.actor.accountId,
        'active',
        now,
        'active',
        teamId,
        'active',
        now,
        'active',
        nocTeamId,
        'active',
      ],
    );
    if (members.length !== 1) throw new OperationError('DENIED');
    const member = members[0]!,
      memberRole = role(member.role);
    const assigneeId = uuid(member.assignee_id);
    if (member.team_role !== 'engineer' && member.team_role !== 'lead')
      throw new OperationError('DENIED');
    const teamRole = member.team_role;
    if (
      command.kind === 'assign' &&
      memberRole !== 'admin' &&
      teamRole !== 'lead'
    )
      throw new OperationError('DENIED');
    if (member.team_id !== teamId || memberRole === 'viewer')
      throw new OperationError('DENIED');
    if (command.targetTeamId !== undefined) {
      const target = await this.db.rows<{ id: string }>(
        'SELECT team.id FROM teams team JOIN isp_tenants t ON t.id = team.tenant_id WHERE t.installation_id = ? AND t.id = ? AND t.status = ? AND t.pending_mutation IS NULL AND team.id = ? AND team.status = ? AND team.pending IS NULL',
        [
          ctx.installationId,
          ctx.tenantId,
          'active',
          uuid(command.targetTeamId),
          'active',
        ],
      );
      if (target.length !== 1 || target[0]!.id !== command.targetTeamId)
        throw new OperationError('DENIED');
    }
    if (command.kind === 'assign' && !replayTeam) {
      if (!current || teamId !== current.incident.ownerTeamId)
        throw new OperationError('DENIED');
      const targetId = uuid(command.targetAssigneeId);
      const targets = await this.db.rows<{ id: string }>(
        'SELECT a.id FROM isp_tenants t JOIN assignees a ON a.tenant_id = t.id JOIN team_memberships tm ON tm.tenant_id = a.tenant_id AND tm.assignee_id = a.id JOIN teams team ON team.tenant_id = tm.tenant_id AND team.id = tm.team_id JOIN tenant_memberships m ON m.tenant_id = a.tenant_id AND m.account_id = a.atlassian_account_id WHERE t.installation_id = ? AND t.id = ? AND t.status = ? AND t.pending_mutation IS NULL AND a.id = ? AND a.status = ? AND a.pending IS NULL AND a.atlassian_account_id IS NOT NULL AND tm.team_id = ? AND tm.status = ? AND tm.role IN (?, ?) AND tm.pending IS NULL AND (tm.effective_until IS NULL OR tm.effective_until > ?) AND team.status = ? AND team.pending IS NULL AND m.status = ? AND m.role IN (?, ?) AND (m.expires_at IS NULL OR m.expires_at > ?)',
        [
          ctx.installationId,
          ctx.tenantId,
          'active',
          targetId,
          'active',
          current.incident.ownerTeamId,
          'active',
          'engineer',
          'lead',
          now,
          'active',
          'active',
          'operator',
          'admin',
          now,
        ],
      );
      if (targets.length !== 1 || targets[0]!.id !== targetId)
        throw new OperationError('DENIED');
    }
    return {
      tenantId: ctx.tenantId,
      role: memberRole,
      teamId,
      nocTeamId,
      assigneeId,
      teamRole,
    };
  }
}
