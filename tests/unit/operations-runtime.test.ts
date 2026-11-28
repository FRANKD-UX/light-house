// Mocked Forge resolver/SDK wiring only. No hosted execution or native permissions evidence.
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const runtime = vi.hoisted(() => ({
  environment: 'DEVELOPMENT',
  installationId: 'synthetic-installation',
  rows: vi.fn(),
  write: vi.fn(),
}));
vi.mock('@forge/api', () => ({
  getAppContext: () => ({
    environmentType: runtime.environment,
    installationAri: { toString: () => runtime.installationId },
  }),
  default: {},
  route: vi.fn(),
}));
vi.mock('@forge/sql', () => ({ default: {} }));
vi.mock('@forge/events', () => ({ Queue: class {} }));
vi.mock('../../src/infrastructure/sql/driver', () => ({
  forgeSql: { rows: runtime.rows, write: runtime.write },
}));
vi.mock('../../src/forge/inventory/boundary', () => ({
  isJiraAdmin: vi.fn(async () => true),
}));
import { operationsRequest } from '../../src/forge/operations/runtime';
import { InventoryService } from '../../src/application/inventory/service';
import { OperationService } from '../../src/application/operations/service';
import {
  OperationError,
  type OperationAggregate,
  type OperationResult,
} from '../../src/application/operations/contracts';
import type { TenantContext } from '../../src/application/ports/tenant-context';
import { InventoryError } from '../../src/domain/inventory/model';
import { SqlOperationsRepository } from '../../src/infrastructure/sql/operations-repository';
import { SqlOperationAuthority } from '../../src/infrastructure/operations/authority';

const id = (n: number) =>
  `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const ctx: TenantContext = {
  installationId: 'synthetic-installation',
  tenantId: id(1),
  actor: { kind: 'atlassian-user', accountId: 'synthetic-admin' },
};
const timestamp = '2026-11-27T00:00:00.000Z';
function aggregate(pending = false): OperationAggregate {
  const result: OperationResult = {
    incidentId: id(2),
    version: 1,
    state: 'new',
    ownerTeamId: id(3),
    ownerAssigneeId: id(5),
    correlationId: id(4),
    pendingMaterialisation: false,
  };
  return {
    installationId: ctx.installationId,
    tenantId: ctx.tenantId,
    nocTeamId: id(3),
    factsVersion: 1,
    validation: null,
    lease: null,
    incident: {
      id: id(2),
      tenantId: ctx.tenantId,
      state: 'new',
      version: 1,
      ownerTeamId: id(3),
      ownerAssigneeId: id(5),
      sla: {
        policyId: id(6),
        policyVersion: 1,
        tierId: id(7),
        consideredTierIds: [id(7)],
        priority: 'P1',
        severity: '4',
        confidence: 'known',
        reason: 'STRICTEST_AFFECTED_TIER',
        clock: 'elapsed-utc',
        startedAt: timestamp,
        durationSeconds: 3600,
        warningSeconds: 1800,
        warningAt: '2026-11-27T00:30:00.000Z',
        deadlineAt: '2026-11-27T01:00:00.000Z',
      },
      pendingHandoff: null,
      pendingReturn: null,
      recoveryObservedAt: null,
      restorationValidatedAt: null,
      resolvedAt: null,
    },
    pending: pending
      ? {
          receipt: { commandId: id(8), fingerprint: 'a'.repeat(64), result },
          audit: {
            correlationId: id(4),
            commandId: id(8),
            at: timestamp,
            accountId: 'synthetic-revoked-original',
            assigneeId: id(5),
            fromAssigneeId: id(5),
            toAssigneeId: id(5),
            teamId: id(3),
            action: 'initialise',
            fromState: 'new',
            toState: 'new',
            fromOwner: id(3),
            toOwner: id(3),
            reason: null,
            gateId: null,
            targetTeamId: null,
            nativeIntentId: null,
            factsVersion: 1,
            slaPolicyId: id(6),
            slaStartedAt: timestamp,
            slaDeadlineAt: '2026-11-27T01:00:00.000Z',
          },
        }
      : null,
  };
}
beforeEach(() => {
  runtime.environment = 'DEVELOPMENT';
  runtime.installationId = ctx.installationId;
  runtime.rows.mockReset();
  runtime.write.mockReset();
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(InventoryService.prototype, 'context').mockImplementation(
    async function (this: InventoryService) {
      expect(this.session.installationId).toBe(ctx.installationId);
      expect(this.session.accountId).toBe('synthetic-admin');
      return ctx;
    },
  );
  vi.spyOn(SqlOperationsRepository.prototype, 'ready').mockResolvedValue(true);
  vi.spyOn(SqlOperationsRepository.prototype, 'load').mockResolvedValue(
    aggregate(),
  );
  vi.spyOn(
    SqlOperationsRepository.prototype,
    'configuration',
  ).mockResolvedValue({ nocTeamId: id(3), version: 1 });
  vi.spyOn(SqlOperationsRepository.prototype, 'configure').mockResolvedValue(
    true,
  );
  vi.spyOn(SqlOperationsRepository.prototype, 'materialise').mockResolvedValue(
    true,
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
const request = (action: string, extra: Record<string, unknown> = {}) =>
  operationsRequest(
    { accountId: 'synthetic-admin' },
    { action, tenantId: ctx.tenantId, ...extra },
  );

it('derives runtime installation/actor, denies nondevelopment and validates unknown top-level/context input', async () => {
  for (const input of [
    null,
    [],
    {},
    { action: 'unknown', tenantId: ctx.tenantId },
    { action: 'overview', tenantId: ctx.tenantId, installationId: 'forged' },
    { action: 'overview', tenantId: ctx.tenantId, accountId: 'forged' },
  ])
    expect(
      await operationsRequest({ accountId: 'synthetic-admin' }, input),
    ).toMatchObject({ ok: false, code: 'INVALID' });
  expect(
    await operationsRequest({}, { action: 'overview', tenantId: ctx.tenantId }),
  ).toMatchObject({ ok: false, code: 'INVALID' });
  runtime.environment = 'PRODUCTION';
  expect(await request('overview', { incidentId: id(2) })).toMatchObject({
    ok: false,
    code: 'DENIED',
  });
  runtime.environment = 'DEVELOPMENT';
  expect(await request('overview', { incidentId: id(2) })).toMatchObject({
    ok: true,
  });
  expect(InventoryService.prototype.context).toHaveBeenLastCalledWith(
    ctx.tenantId,
    'read',
  );
});

it('requires ready operations schema before any read or mutation', async () => {
  vi.mocked(SqlOperationsRepository.prototype.ready).mockResolvedValue(false);
  expect(await request('overview', { incidentId: id(2) })).toMatchObject({
    ok: false,
    code: 'NOT_READY',
  });
  expect(
    await request('configure', {
      configuration: { nocTeamId: id(3), version: 1 },
      expected: 0,
    }),
  ).toMatchObject({ ok: false, code: 'NOT_READY' });
  expect(SqlOperationsRepository.prototype.load).not.toHaveBeenCalled();
  expect(SqlOperationsRepository.prototype.configure).not.toHaveBeenCalled();
});

it('projects public operational fields without installation/account/pending audit/lease material', async () => {
  vi.mocked(SqlOperationsRepository.prototype.load).mockResolvedValue({
    ...aggregate(true),
    lease: { token: id(99), until: '2026-11-27T00:01:00.000Z' },
  });
  const response = await request('overview', { incidentId: id(2) });
  expect(response).toMatchObject({
    ok: true,
    value: {
      operation: {
        id: id(2),
        state: 'new',
        pendingMaterialisation: true,
        nativeClosureAvailable: false,
      },
      configuration: { nocTeamId: id(3), version: 1 },
    },
  });
  const publicJson = JSON.stringify(response);
  for (const secret of [
    ctx.installationId,
    'synthetic-revoked-original',
    'accountId',
    'pendingAudit',
    'lease',
    id(99),
    'fingerprint',
    'a'.repeat(64),
  ])
    expect(publicJson).not.toContain(secret);
  vi.mocked(SqlOperationsRepository.prototype.load).mockResolvedValue(null);
  expect(await request('overview', { incidentId: id(2) })).toMatchObject({
    ok: true,
    value: { operation: null },
  });
});

it('requires fresh configure permission, validates configuration fields and preserves CAS conflicts', async () => {
  const payload = {
    configuration: { nocTeamId: id(3), version: 1 },
    expected: 0,
  };
  expect(await request('configure', payload)).toMatchObject({
    ok: true,
    value: { saved: true },
  });
  expect(InventoryService.prototype.context).toHaveBeenLastCalledWith(
    ctx.tenantId,
    'configure',
  );
  expect(SqlOperationsRepository.prototype.configure).toHaveBeenCalledWith(
    ctx,
    payload.configuration,
    0,
  );
  vi.mocked(InventoryService.prototype.context).mockRejectedValueOnce(
    new InventoryError('DENIED'),
  );
  expect(await request('configure', payload)).toMatchObject({
    ok: false,
    code: 'DENIED',
  });
  vi.mocked(SqlOperationsRepository.prototype.configure).mockResolvedValueOnce(
    false,
  );
  expect(await request('configure', payload)).toMatchObject({
    ok: false,
    code: 'CONFLICT',
  });
  for (const extra of [
    {
      configuration: { ...payload.configuration, installationId: 'forged' },
      expected: 0,
    },
    { ...payload, expected: '0' },
    { configuration: { nocTeamId: ['forged'], version: 1 }, expected: 0 },
  ])
    expect(await request('configure', extra)).toMatchObject({
      ok: false,
      code: 'INVALID',
    });
});

it('execute delegates to the actual application service and its fresh stored authority callback', async () => {
  const actor = {
    tenantId: ctx.tenantId,
    role: 'operator' as const,
    teamId: id(3),
    nocTeamId: id(3),
    assigneeId: id(5),
  };
  const authority = vi
    .spyOn(SqlOperationAuthority.prototype, 'authorise')
    .mockResolvedValue(actor);
  const command = {
    commandId: id(8),
    incidentId: id(2),
    expected: 1,
    kind: 'acknowledge',
  };
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify([
        ctx.installationId,
        ctx.tenantId,
        'synthetic-admin',
        actor.teamId,
        command,
      ]),
    )
    .digest('hex');
  const result: OperationResult = {
    incidentId: id(2),
    version: 2,
    state: 'acknowledged',
    ownerTeamId: id(3),
    ownerAssigneeId: id(5),
    correlationId: id(4),
    pendingMaterialisation: false,
  };
  vi.spyOn(SqlOperationsRepository.prototype, 'receipt').mockResolvedValue({
    commandId: command.commandId,
    fingerprint,
    result,
  });
  expect(await request('execute', { command })).toMatchObject({
    ok: true,
    value: result,
  });
  expect(InventoryService.prototype.context).toHaveBeenLastCalledWith(
    ctx.tenantId,
    'write',
  );
  expect(authority).toHaveBeenCalledWith(ctx, command);
  authority.mockRejectedValueOnce(new OperationError('DENIED'));
  expect(await request('execute', { command })).toMatchObject({
    ok: false,
    code: 'DENIED',
  });
});

it('checklist delegates to the application command using stored user context and write permission', async () => {
  const checklist = { incidentId: id(2), kind: 'start_work', expected: 1 };
  const record = vi
    .spyOn(OperationService.prototype, 'recordChecklist')
    .mockResolvedValue({
      gateId: id(10),
      validUntil: '2026-11-27T00:05:00.000Z',
    });
  expect(await request('checklist', { checklist })).toMatchObject({
    ok: true,
    value: { gateId: id(10) },
  });
  expect(record).toHaveBeenCalledWith(ctx, checklist);
  expect(InventoryService.prototype.context).toHaveBeenLastCalledWith(
    ctx.tenantId,
    'write',
  );
});

it('admin projection repair uses the original committed command even when its actor was revoked, without logical execution', async () => {
  const value = aggregate(true);
  vi.mocked(SqlOperationsRepository.prototype.load).mockResolvedValue(value);
  const execute = vi.spyOn(OperationService.prototype, 'execute');
  expect(
    await request('repair', {
      incidentId: id(2),
      command: { commandId: id(99) },
    }),
  ).toMatchObject({ ok: true, value: { completed: true } });
  expect(InventoryService.prototype.context).toHaveBeenLastCalledWith(
    ctx.tenantId,
    'configure',
  );
  expect(SqlOperationsRepository.prototype.materialise).toHaveBeenCalledWith(
    ctx,
    id(2),
    value.pending!.receipt.commandId,
  );
  expect(execute).not.toHaveBeenCalled();
  vi.mocked(InventoryService.prototype.context).mockRejectedValueOnce(
    new InventoryError('DENIED'),
  );
  expect(await request('repair', { incidentId: id(2) })).toMatchObject({
    ok: false,
    code: 'DENIED',
  });
  expect(SqlOperationsRepository.prototype.materialise).toHaveBeenCalledTimes(
    1,
  );
});

it('repair keeps missing, uncertain, leased and clean-noop states distinct without resetting anything', async () => {
  vi.mocked(SqlOperationsRepository.prototype.load).mockResolvedValueOnce(null);
  expect(await request('repair', { incidentId: id(2) })).toMatchObject({
    ok: false,
    code: 'NOT_READY',
  });
  for (const until of [
    '2026-01-01T00:00:00.000Z',
    '2099-01-01T00:00:00.000Z',
  ]) {
    vi.mocked(SqlOperationsRepository.prototype.load).mockResolvedValueOnce({
      ...aggregate(true),
      lease: { token: id(99), until },
    });
    expect(await request('repair', { incidentId: id(2) })).toMatchObject({
      ok: false,
      code: 'REPAIR_REQUIRED',
    });
  }
  expect(SqlOperationsRepository.prototype.materialise).not.toHaveBeenCalled();
  expect(await request('repair', { incidentId: id(2) })).toMatchObject({
    ok: true,
    value: { completed: true },
  });
  vi.mocked(SqlOperationsRepository.prototype.load).mockResolvedValue(
    aggregate(true),
  );
  vi.mocked(
    SqlOperationsRepository.prototype.materialise,
  ).mockResolvedValueOnce(false);
  expect(await request('repair', { incidentId: id(2) })).toMatchObject({
    ok: true,
    value: { completed: false },
  });
});

it('masks arbitrary exceptions in resolver results and structured logs', async () => {
  vi.mocked(SqlOperationsRepository.prototype.load).mockRejectedValueOnce(
    new Error(
      'Bearer SYNTHETIC-PRIVATE-DIAGNOSTIC synthetic-installation account=private',
    ),
  );
  const response = await request('overview', { incidentId: id(2) });
  expect(response).toMatchObject({
    ok: false,
    code: 'UNAVAILABLE',
    correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
  });
  expect(JSON.stringify(response)).not.toContain('SYNTHETIC-PRIVATE');
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
    'SYNTHETIC-PRIVATE',
  );
  expect(console.error).toHaveBeenCalledWith(
    expect.stringContaining('processing.failed'),
  );
  vi.mocked(SqlOperationsRepository.prototype.load).mockResolvedValueOnce(
    aggregate(true),
  );
  vi.mocked(
    SqlOperationsRepository.prototype.materialise,
  ).mockRejectedValueOnce(new OperationError('REPAIR_REQUIRED'));
  expect(await request('repair', { incidentId: id(2) })).toMatchObject({
    ok: false,
    code: 'REPAIR_REQUIRED',
  });
});
