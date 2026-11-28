import api, { route } from '@forge/api';
import type {
  TransitionGateway,
  TransitionObservation,
  TransitionPlan,
} from '../../application/jsm-transitions/contracts';
import { identifier } from '../../application/jsm/validation';
import { object, text, utc } from '../../domain/inventory/model';
import type { JiraRequest } from './forge-gateway';
const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};
function identifiers(plan: TransitionPlan): void {
  for (const id of [
    plan.issueId,
    plan.projectId,
    plan.transitionId,
    plan.fromStatusId,
    plan.targetStatusId,
  ])
    identifier(id);
  if (plan.resolutionId !== null) identifier(plan.resolutionId);
  text(plan.accountId, 128);
}
/** Interactive resolver only: trusted preflight binds plan.accountId to the server principal.
 * asUser() uses that current resolver user; never queue, impersonate or fall back to asApp.
 * No /myself read: it needs read:jira-user, outside the reviewed manifest scopes.
 */
export class ForgeJiraTransitionsGateway implements TransitionGateway {
  constructor(
    private readonly request: JiraRequest = (path, options) =>
      api.asUser().requestJira(path, options),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}
  private async issue(
    plan: TransitionPlan,
  ): Promise<TransitionObservation | null> {
    const response = await this.request(
      route`/rest/api/3/issue/${plan.issueId}?fields=status,project`,
      { method: 'GET', headers },
    );
    if (response.status !== 200) return null;
    const value = object(await response.json()),
      fields = object(value.fields);
    if (
      value.id !== plan.issueId ||
      object(fields.project).id !== plan.projectId
    )
      return null;
    return {
      issueId: plan.issueId,
      projectId: plan.projectId,
      statusId: identifier(object(fields.status).id),
      observedAt: utc(this.now()),
      causality: 'postcondition-only',
    };
  }
  async eligible(plan: TransitionPlan): Promise<boolean> {
    try {
      identifiers(plan);
      const issue = await this.issue(plan);
      if (!issue || issue.statusId !== plan.fromStatusId) return false;
      const response = await this.request(
        route`/rest/api/3/issue/${plan.issueId}/transitions?expand=transitions.fields`,
        { method: 'GET', headers },
      );
      if (response.status !== 200) return false;
      const values = object(await response.json()).transitions;
      if (!Array.isArray(values) || values.length > 100) return false;
      const matches = values
        .map(object)
        .filter((value) => value.id === plan.transitionId);
      if (matches.length !== 1) return false;
      const transition = matches[0]!;
      if (
        transition.isAvailable === false ||
        object(transition.to).id !== plan.targetStatusId
      )
        return false;
      if (transition.fields === undefined)
        return transition.hasScreen !== true && plan.resolutionId === null;
      const fields = object(transition.fields);
      if (Object.keys(fields).length > 100) return false;
      for (const [key, raw] of Object.entries(fields)) {
        const field = object(raw);
        if (typeof field.required !== 'boolean') return false;
        if (
          field.required &&
          (key !== 'resolution' || plan.resolutionId === null)
        )
          return false;
      }
      if (plan.resolutionId === null) return true;
      const resolution = object(fields.resolution),
        schema = object(resolution.schema);
      if (
        schema.type !== 'resolution' ||
        !Array.isArray(resolution.allowedValues) ||
        resolution.allowedValues.length > 1000
      )
        return false;
      return (
        resolution.allowedValues
          .map(object)
          .filter((value) => value.id === plan.resolutionId).length === 1
      );
    } catch {
      return false;
    }
  }
  async post(plan: TransitionPlan): ReturnType<TransitionGateway['post']> {
    try {
      identifiers(plan);
      const response = await this.request(
        route`/rest/api/3/issue/${plan.issueId}/transitions`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            transition: { id: plan.transitionId },
            ...(plan.resolutionId !== null
              ? { fields: { resolution: { id: plan.resolutionId } } }
              : {}),
          }),
        },
      );
      if (response.status === 204) return { kind: 'accepted' };
      if (response.status === 429)
        return { kind: 'rejected', reason: 'RATE_LIMITED' };
      if (response.status === 401 || response.status === 403)
        return { kind: 'rejected', reason: 'PERMISSION' };
      if ([400, 404, 409, 422].includes(response.status))
        return { kind: 'rejected', reason: 'CONFIGURATION' };
      return { kind: 'ambiguous' };
    } catch {
      return { kind: 'ambiguous' };
    }
  }
  async observe(plan: TransitionPlan): Promise<TransitionObservation | null> {
    try {
      identifiers(plan);
      return await this.issue(plan);
    } catch {
      return null;
    }
  }
}
