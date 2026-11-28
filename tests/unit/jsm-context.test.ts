// Injected application-port tests only, not Jira/Forge native permission acceptance.
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { JsmContextService } from '../../src/application/jsm-context/service';
import type {
  IssueVisibilityVerifier,
  JsmContextLookup,
  JsmContextRepository,
  JsmContextSession,
} from '../../src/application/jsm-context/contracts';
import type { Incident } from '../../src/domain/incidents/model';
const at = '2026-11-28T00:00:00.000Z';
function fixture() {
  const session: JsmContextSession = {
    installationId: 'synthetic-installation',
    accountId: 'synthetic-reader',
    projectId: '100',
  };
  const tenantId = randomUUID(),
    incidentId = randomUUID();
  const incident: Incident = {
    id: incidentId,
    installationId: session.installationId,
    tenantId,
    sourceId: randomUUID(),
    problemEventId: '123',
    correlationId: randomUUID(),
    createdAt: at,
    occurredAt: at,
    state: 'new',
    version: 1,
    impact: {
      confidence: 'known',
      reason: 'COMPLETE',
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
  const linked: JsmContextLookup = {
    kind: 'linked',
    installationId: session.installationId,
    tenantId,
    incidentId,
    issueId: '10000',
    incident,
    operations: { readiness: 'ready', snapshot: null },
  };
  const permission = {
    mode: 'asUser',
    accountId: session.accountId,
    issueId: '10000',
    projectId: session.projectId,
    browseAllowed: true,
    issueSecurityAllowed: true,
  };
  const repository = {
      lookup: vi.fn<JsmContextRepository['lookup']>(async () => linked),
    },
    verifier = {
      verify: vi.fn<IssueVisibilityVerifier['verify']>(async () => permission),
    };
  return {
    session,
    linked,
    incident,
    permission,
    repository,
    verifier,
    service: new JsmContextService(repository, verifier),
  };
}
describe('read-only linked Jira incident use case', () => {
  it('verifies the exact asUser issue/project/account before lookup and projects away private fields at every level', async () => {
    const f = fixture();
    f.repository.lookup.mockResolvedValue({
      ...f.linked,
      incident: {
        ...f.incident,
        accountId: 'private-account',
        request: 'private-request',
        impact: { ...f.incident.impact, secret: 'private-impact' },
        sla: { ...f.incident.sla, secret: 'private-policy' },
      },
    });
    const result = await f.service.lookup(f.session, '10000');
    expect(f.verifier.verify).toHaveBeenCalledWith(f.session, '10000');
    expect(f.repository.lookup).toHaveBeenCalledWith(f.session, '10000');
    expect(f.verifier.verify.mock.invocationCallOrder[0]).toBeLessThan(
      f.repository.lookup.mock.invocationCallOrder[0]!,
    );
    expect(result).toMatchObject({
      kind: 'available',
      incident: { id: f.incident.id, tenantId: f.incident.tenantId },
      operations: { readiness: 'ready', summary: null },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /synthetic-installation|synthetic-reader|private-account|private-request|private-impact|private-policy/,
    );
  });
  it('fails closed on absent/negative/foreign/unsupported Jira visibility and never queries SQL', async () => {
    const f = fixture();
    for (const permission of [
      null,
      {},
      { ...f.permission, mode: 'asApp' },
      { ...f.permission, browseAllowed: false },
      { ...f.permission, issueSecurityAllowed: false },
      { ...f.permission, issueSecurityAllowed: 'true' },
      { ...f.permission, accountId: 'foreign' },
      { ...f.permission, issueId: '999' },
      { ...f.permission, projectId: '999' },
    ]) {
      f.verifier.verify.mockResolvedValueOnce(permission);
      expect(await f.service.lookup(f.session, '10000')).toEqual({
        kind: 'unavailable',
        reason: 'NOT_VISIBLE',
      });
    }
    f.verifier.verify.mockRejectedValueOnce(new Error('private API error'));
    expect(await f.service.lookup(f.session, '10000')).toEqual({
      kind: 'unavailable',
      reason: 'NOT_VISIBLE',
    });
    expect(f.repository.lookup).not.toHaveBeenCalled();
  });
  it('rejects unsafe/missing server context and client-shaped selectors without invoking either port', async () => {
    const f = fixture();
    for (const issue of [
      null,
      10000,
      '0',
      '-1',
      '10000 OR 1=1',
      { issueId: '10000', tenantId: f.incident.tenantId },
      '1'.repeat(21),
    ])
      expect(await f.service.lookup(f.session, issue)).toEqual({
        kind: 'unavailable',
        reason: 'INVALID_CONTEXT',
      });
    expect(
      await f.service.lookup({ ...f.session, projectId: 'ABC' }, '10000'),
    ).toEqual({ kind: 'unavailable', reason: 'INVALID_CONTEXT' });
    expect(
      await f.service.lookup({ ...f.session, accountId: '' }, '10000'),
    ).toEqual({ kind: 'unavailable', reason: 'INVALID_CONTEXT' });
    expect(f.verifier.verify).not.toHaveBeenCalled();
    expect(f.repository.lookup).not.toHaveBeenCalled();
  });
  it('preserves explicit unavailable/readiness states and sanitizes arbitrary repository errors', async () => {
    const f = fixture();
    for (const reason of ['NOT_AVAILABLE', 'NOT_READY'] as const) {
      f.repository.lookup.mockResolvedValueOnce({
        kind: 'unavailable',
        reason,
      });
      expect(await f.service.lookup(f.session, '10000')).toEqual({
        kind: 'unavailable',
        reason,
      });
    }
    f.repository.lookup.mockRejectedValueOnce(new Error('private SQL payload'));
    expect(await f.service.lookup(f.session, '10000')).toEqual({
      kind: 'unavailable',
      reason: 'UNAVAILABLE',
    });
    for (const readiness of ['not-ready', 'unavailable'] as const) {
      f.repository.lookup.mockResolvedValueOnce({
        ...f.linked,
        operations: { readiness, snapshot: null },
      });
      expect(await f.service.lookup(f.session, '10000')).toMatchObject({
        kind: 'available',
        operations: { readiness, summary: null },
      });
    }
  });
  it('rejects foreign/corrupt stored binding rather than projecting a partially trusted incident', async () => {
    const f = fixture();
    for (const corrupt of [
      { ...f.linked, installationId: 'foreign' },
      { ...f.linked, issueId: '999' },
      { ...f.linked, incident: { ...f.incident, id: randomUUID() } },
      { ...f.linked, incident: { ...f.incident, tenantId: randomUUID() } },
      { ...f.linked, incident: { ...f.incident, state: 'closed' } },
      { ...f.linked, incident: { ...f.incident, sla: { kind: 'unknown' } } },
    ]) {
      f.repository.lookup.mockResolvedValueOnce(corrupt as JsmContextLookup);
      expect(await f.service.lookup(f.session, '10000')).toEqual({
        kind: 'unavailable',
        reason: 'UNAVAILABLE',
      });
    }
  });
  it('returns a narrow current operation summary and excludes actor/audit/lease/intent material', async () => {
    const f = fixture();
    const team = randomUUID(),
      assignee = randomUUID();
    const snapshot = {
      installationId: f.session.installationId,
      tenantId: f.incident.tenantId,
      nocTeamId: team,
      incident: {
        id: f.incident.id,
        tenantId: f.incident.tenantId,
        state: 'in_progress',
        version: 4,
        ownerTeamId: team,
        ownerAssigneeId: assignee,
        pendingHandoff: null,
        pendingReturn: null,
        resolvedAt: null,
      },
      pending: {
        receipt: { commandId: randomUUID() },
        audit: { accountId: 'private-operator', reason: 'private-reason' },
      },
      lease: { token: 'private-lease' },
    };
    f.repository.lookup.mockResolvedValue({
      ...f.linked,
      operations: { readiness: 'ready', snapshot },
    });
    const result = await f.service.lookup(f.session, '10000');
    expect(result).toMatchObject({
      operations: {
        readiness: 'ready',
        summary: {
          state: 'in_progress',
          version: 4,
          ownerTeamId: team,
          ownerAssigneeId: assignee,
          pendingMaterialisation: true,
          pendingHandoff: false,
          pendingReturn: false,
        },
      },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /private-operator|private-reason|private-lease|commandId|accountId|installationId/,
    );
    f.repository.lookup.mockResolvedValue({
      ...f.linked,
      operations: { readiness: 'not-ready', snapshot },
    });
    expect(await f.service.lookup(f.session, '10000')).toEqual({
      kind: 'unavailable',
      reason: 'UNAVAILABLE',
    });
  });
  it('validates SLA arithmetic and projects the immutable selected snapshot', async () => {
    const f = fixture();
    const tier = randomUUID();
    const sla = {
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
        startedAt: at,
        durationSeconds: 60,
        warningSeconds: 45,
        warningAt: '2026-11-28T00:00:45.000Z',
        deadlineAt: '2026-11-28T00:01:00.000Z',
        rawPayload: 'private',
      },
    };
    f.repository.lookup.mockResolvedValueOnce({
      ...f.linked,
      incident: { ...f.incident, sla },
    });
    const result = await f.service.lookup(f.session, '10000');
    expect(result).toMatchObject({
      kind: 'available',
      incident: {
        sla: {
          snapshot: { priority: 'P1', deadlineAt: '2026-11-28T00:01:00.000Z' },
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain('rawPayload');
    f.repository.lookup.mockResolvedValueOnce({
      ...f.linked,
      incident: {
        ...f.incident,
        sla: { ...sla, snapshot: { ...sla.snapshot, durationSeconds: 61 } },
      },
    });
    expect(await f.service.lookup(f.session, '10000')).toEqual({
      kind: 'unavailable',
      reason: 'UNAVAILABLE',
    });
  });
});
