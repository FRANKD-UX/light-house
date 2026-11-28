// Mocked transport tests, not native Jira permission or issue-context acceptance.
import { expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ request: vi.fn(), asUser: vi.fn() }));
vi.mock('@forge/api', () => ({
  default: {
    asUser: () => {
      sdk.asUser();
      return { requestJira: sdk.request };
    },
  },
  route: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce(
      (s, p, i) =>
        s +
        p +
        (i < values.length ? encodeURIComponent(String(values[i])) : ''),
      '',
    ),
}));
import { ForgeIssueVisibilityVerifier } from '../../src/infrastructure/jsm/context-gateway';
import type { JiraRequest } from '../../src/infrastructure/jsm/forge-gateway';
const session = {
  installationId: 'synthetic-installation',
  accountId: 'synthetic-user',
  projectId: '20000',
};
const response = (status: number, value: unknown) => ({
  status,
  headers: { get: () => null },
  json: vi.fn(async () => value),
});
const issue = { id: '10000', fields: { project: { id: '20000' } } };
it('uses only one GET read asUser and projects no raw issue data', async () => {
  sdk.request
    .mockReset()
    .mockResolvedValueOnce(response(200, { ...issue, description: 'private' }));
  sdk.asUser.mockClear();
  const result = await new ForgeIssueVisibilityVerifier().verify(
    session,
    '10000',
  );
  expect(result).toEqual({
    mode: 'asUser',
    accountId: session.accountId,
    issueId: '10000',
    projectId: session.projectId,
    browseAllowed: true,
    issueSecurityAllowed: true,
  });
  expect(sdk.asUser).toHaveBeenCalledTimes(1);
  expect(sdk.request.mock.calls.map((c) => [String(c[0]), c[1]])).toEqual([
    [
      '/rest/api/3/issue/10000?fields=project',
      { method: 'GET', headers: { Accept: 'application/json' } },
    ],
  ]);
});
it('requires a server-derived account before any issue read', async () => {
  const request = vi.fn<JiraRequest>();
  expect(
    await new ForgeIssueVisibilityVerifier(request).verify(
      { ...session, accountId: '' },
      '10000',
    ),
  ).toBeNull();
  expect(request).not.toHaveBeenCalled();
});
it('fails closed on Browse/security denial, issue/project drift, malformed JSON and transport failure', async () => {
  for (const value of [
    response(403, { private: 'denied' }),
    response(404, {}),
    response(200, { ...issue, id: '10001' }),
    response(200, { ...issue, fields: { project: { id: '20001' } } }),
    response(200, null),
    {
      ...response(200, {}),
      json: async () => {
        throw new Error('private');
      },
    },
  ]) {
    const request = vi.fn<JiraRequest>().mockResolvedValueOnce(value);
    expect(
      await new ForgeIssueVisibilityVerifier(request).verify(session, '10000'),
    ).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
  }
  const broken = vi.fn<JiraRequest>().mockRejectedValue(new Error('private'));
  expect(
    await new ForgeIssueVisibilityVerifier(broken).verify(session, '10000'),
  ).toBeNull();
});
it('rejects arbitrary paths and missing server context before any network call', async () => {
  const request = vi.fn<JiraRequest>();
  for (const id of ['../myself', '10000?expand=all', ''])
    expect(
      await new ForgeIssueVisibilityVerifier(request).verify(session, id),
    ).toBeNull();
  expect(
    await new ForgeIssueVisibilityVerifier(request).verify(
      { ...session, projectId: '../project' },
      '10000',
    ),
  ).toBeNull();
  expect(request).not.toHaveBeenCalled();
});
