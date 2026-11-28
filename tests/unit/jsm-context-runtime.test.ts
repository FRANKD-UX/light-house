// Mocked Forge runtime boundary only, never native issue-context or permission acceptance.
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@forge/api', () => ({
  getAppContext: vi.fn(),
  default: { asUser: vi.fn() },
  route: vi.fn(),
}));
vi.mock('../../src/infrastructure/sql/driver', () => ({
  forgeSql: { rows: vi.fn(), write: vi.fn() },
}));
import { createEmbeddedRequest } from '../../src/forge/jsm-context/boundary';
import type { JsmContextResult } from '../../src/application/jsm-context/contracts';
const runtime = () => ({
  environmentType: 'DEVELOPMENT',
  moduleKey: 'light-house-incident-context',
  installationAri: { toString: () => 'synthetic-installation' },
});
const context = () => ({
  accountId: 'synthetic-reader',
  extension: {
    type: 'jira:issueContext',
    issue: { id: '10000' },
    project: { id: '20000' },
  },
});
beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
it('accepts only a selector-free read using server identities and bounded module compatibility', async () => {
  const lookup = vi.fn(async (): Promise<JsmContextResult> => ({
    kind: 'unavailable',
    reason: 'NOT_AVAILABLE',
  }));
  for (const moduleKey of [
    'light-house-incident-context',
    'issue-context-resolver',
  ]) {
    const response = await createEmbeddedRequest({
      runtime: () => ({ ...runtime(), moduleKey }),
      lookup,
    })(context(), { action: 'read' });
    expect(response).toMatchObject({
      ok: true,
      value: { kind: 'unavailable', reason: 'NOT_AVAILABLE' },
    });
    expect(response.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  }
  expect(lookup).toHaveBeenCalledWith(
    {
      installationId: 'synthetic-installation',
      accountId: 'synthetic-reader',
      projectId: '20000',
    },
    '10000',
  );
  expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain(
    'synthetic-reader',
  );
});
it('rejects client identity/tenant/issue selectors, wrong modules and production before lookup', async () => {
  const lookup = vi.fn(async (): Promise<JsmContextResult> => ({
    kind: 'unavailable',
    reason: 'NOT_AVAILABLE',
  }));
  const request = createEmbeddedRequest({ runtime, lookup });
  for (const input of [
    { action: 'read', tenantId: 'private' },
    { action: 'read', issueId: '10001' },
    { action: 'read', accountId: 'other' },
    { action: 'write' },
    {},
  ])
    expect(await request(context(), input)).toMatchObject({
      ok: false,
      code: 'DENIED',
    });
  for (const modified of [
    { ...runtime(), environmentType: 'PRODUCTION' },
    { ...runtime(), moduleKey: 'status-resolver' },
  ])
    expect(
      await createEmbeddedRequest({ runtime: () => modified, lookup })(
        context(),
        { action: 'read' },
      ),
    ).toMatchObject({ ok: false, code: 'DENIED' });
  expect(
    await request(
      {
        ...context(),
        extension: { ...context().extension, type: 'jira:globalPage' },
      },
      { action: 'read' },
    ),
  ).toMatchObject({ ok: false, code: 'DENIED' });
  expect(lookup).not.toHaveBeenCalled();
});
it('masks unsupported server contexts, failures and private exception contents', async () => {
  const lookup = vi.fn(async (): Promise<JsmContextResult> => {
    throw new Error('private issue payload');
  });
  const request = createEmbeddedRequest({ runtime, lookup });
  for (const ctx of [
    {},
    { accountId: '', extension: context().extension },
    {
      ...context(),
      extension: { ...context().extension, issue: { id: '../myself' } },
    },
    context(),
  ]) {
    const response = await request(ctx, { action: 'read' });
    expect(response).toMatchObject({ ok: false, code: 'UNAVAILABLE' });
    expect(JSON.stringify(response)).not.toContain('private');
  }
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
    'private issue payload',
  );
});
