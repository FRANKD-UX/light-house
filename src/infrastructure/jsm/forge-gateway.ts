import api, { route, type Route } from '@forge/api';
import type {
  JsmConfiguration,
  JsmCreateOutcome,
  JsmGateway,
  JsmIssue,
  JsmRequest,
} from '../../application/jsm/contracts';
import { identifier } from '../../application/jsm/validation';
import { object } from '../../domain/inventory/model';
export interface JiraResponse {
  readonly status: number;
  readonly headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}
export type JiraRequest = (
  path: Route,
  options: {
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    body?: string;
  },
) => Promise<JiraResponse>;
const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};
function issue(input: unknown): JsmIssue {
  const value = object(input);
  const id = identifier(value.issueId ?? value.id);
  const key = value.issueKey ?? value.key;
  if (
    typeof key !== 'string' ||
    !/^[A-Z][A-Z0-9_]{0,29}-[1-9][0-9]{0,19}$/.test(key)
  )
    throw new Error('INVALID_RESPONSE');
  return { id, key };
}
/** Supported Forge app authentication; no standalone credentials or remote origin. Not registered until reviewed. */
export class ForgeJsmGateway implements JsmGateway {
  constructor(
    private readonly request: JiraRequest = (path, options) =>
      api.asApp().requestJira(path, options),
  ) {}
  async verifyConfiguration(config: JsmConfiguration): Promise<boolean> {
    try {
      const desk = await this.request(
        route`/rest/servicedeskapi/servicedesk/${config.serviceDeskId}`,
        { method: 'GET', headers },
      );
      if (
        desk.status !== 200 ||
        object(await desk.json()).projectId !== config.projectId
      )
        return false;
      const metadata = await this.request(
        route`/rest/servicedeskapi/servicedesk/${config.serviceDeskId}/requesttype/${config.requestTypeId}/field`,
        { method: 'GET', headers },
      );
      if (metadata.status !== 200) return false;
      const fields = object(await metadata.json()).requestTypeFields;
      if (!Array.isArray(fields) || fields.length > 100) return false;
      const supplied = new Set([
        'summary',
        'description',
        'priority',
        ...Object.values(config.fields),
      ]);
      const available = new Set<string>();
      for (const raw of fields) {
        const field = object(raw);
        if (
          typeof field.fieldId !== 'string' ||
          typeof field.required !== 'boolean'
        )
          return false;
        if (field.required && !supplied.has(field.fieldId)) return false;
        const schema = object(field.jiraSchema);
        const expected =
          field.fieldId === 'priority'
            ? 'priority'
            : field.fieldId === config.fields.deadline ||
                field.fieldId === config.fields.warning
              ? 'datetime'
              : 'string';
        if (supplied.has(field.fieldId)) {
          if (schema.type !== expected) return false;
          // Enumerated string fields cannot be used as arbitrary marker/policy fields.
          if (
            expected === 'string' &&
            Array.isArray(field.validValues) &&
            field.validValues.length
          )
            return false;
          available.add(field.fieldId);
        }
      }
      return [...supplied].every((field) => available.has(field));
    } catch {
      return false;
    }
  }
  async create(
    config: JsmConfiguration,
    body: JsmRequest,
  ): Promise<JsmCreateOutcome> {
    try {
      if (
        body.serviceDeskId !== config.serviceDeskId ||
        body.requestTypeId !== config.requestTypeId
      )
        return { kind: 'CONFIGURATION' };
      const response = await this.request(route`/rest/servicedeskapi/request`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (response.status === 429) {
        const retry = response.headers.get('Retry-After');
        // Invalid/unbounded server delay must not cause an early retry.
        if (
          !retry ||
          !/^[0-9]{1,4}$/.test(retry) ||
          Number(retry) < 1 ||
          Number(retry) > 3600
        )
          return { kind: 'CONFIGURATION' };
        return { kind: 'RATE_LIMITED', retryAfterSeconds: Number(retry) };
      }
      if ([400, 401, 403, 404, 422].includes(response.status))
        return { kind: 'CONFIGURATION' };
      if (response.status !== 201) return { kind: 'AMBIGUOUS' };
      const value = object(await response.json());
      if (
        value.serviceDeskId !== config.serviceDeskId ||
        value.requestTypeId !== config.requestTypeId
      )
        return { kind: 'AMBIGUOUS' };
      return { kind: 'created', issue: issue(value) };
    } catch {
      return { kind: 'AMBIGUOUS' };
    }
  }
  async find(
    config: JsmConfiguration,
    marker: string,
  ): Promise<{ complete: boolean; issues: JsmIssue[] }> {
    try {
      if (
        !/^light-house-[0-9a-f-]{36}$/.test(marker) ||
        !/^customfield_[1-9][0-9]{0,19}$/.test(config.fields.marker)
      )
        return { complete: false, issues: [] };
      identifier(config.projectId);
      const fieldNumber = config.fields.marker.slice('customfield_'.length);
      const response = await this.request(route`/rest/api/3/search/jql`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jql: `project = ${config.projectId} AND cf[${fieldNumber}] ~ "${marker}"`,
          fields: ['project', config.fields.marker],
          maxResults: 2,
        }),
      });
      if (response.status !== 200) return { complete: false, issues: [] };
      const data = object(await response.json());
      if (
        data.isLast !== true ||
        !Array.isArray(data.issues) ||
        data.issues.length > 2
      )
        return { complete: false, issues: [] };
      const results: JsmIssue[] = [];
      for (const raw of data.issues) {
        const candidate = object(raw);
        const fields = object(candidate.fields);
        if (
          object(fields.project).id !== config.projectId ||
          fields[config.fields.marker] !== marker
        )
          return { complete: false, issues: [] };
        const identity = issue(candidate);
        const request = await this.request(
          route`/rest/servicedeskapi/request/${identity.id}`,
          { method: 'GET', headers },
        );
        if (request.status !== 200) return { complete: false, issues: [] };
        const value = object(await request.json());
        if (
          value.serviceDeskId !== config.serviceDeskId ||
          value.requestTypeId !== config.requestTypeId ||
          issue(value).id !== identity.id
        )
          return { complete: false, issues: [] };
        results.push(identity);
      }
      if (new Set(results.map((x) => x.id)).size !== results.length)
        return { complete: false, issues: [] };
      return { complete: true, issues: results };
    } catch {
      return { complete: false, issues: [] };
    }
  }
}
