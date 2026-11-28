import api, { route } from '@forge/api';
import type {
  IssueVisibilityVerifier,
  JsmContextSession,
  VerifiedIssueVisibility,
} from '../../application/jsm-context/contracts';
import { identifier } from '../../application/jsm/validation';
import { object, text } from '../../domain/inventory/model';
import type { JiraRequest } from './forge-gateway';
/** Interactive resolver only. A successful exact asUser issue read enforces Browse + issue security. */
export class ForgeIssueVisibilityVerifier implements IssueVisibilityVerifier {
  constructor(
    private readonly request: JiraRequest = (path, options) =>
      api.asUser().requestJira(path, options),
  ) {}
  async verify(
    session: JsmContextSession,
    issueId: string,
  ): Promise<VerifiedIssueVisibility | null> {
    try {
      text(session.installationId, 255);
      text(session.accountId, 128);
      identifier(session.projectId);
      identifier(issueId);
      const options = {
        method: 'GET' as const,
        headers: { Accept: 'application/json' },
      };
      // The dedicated resolver derives accountId from Forge's authenticated principal.
      // asUser() uses that same interactive user; no extra read:jira-user lookup is needed.
      const response = await this.request(
        route`/rest/api/3/issue/${issueId}?fields=project`,
        options,
      );
      if (response.status !== 200) return null;
      const value = object(await response.json());
      if (
        value.id !== issueId ||
        object(object(value.fields).project).id !== session.projectId
      )
        return null;
      return {
        mode: 'asUser',
        accountId: session.accountId,
        issueId,
        projectId: session.projectId,
        browseAllowed: true,
        issueSecurityAllowed: true,
      };
    } catch {
      return null;
    }
  }
}
