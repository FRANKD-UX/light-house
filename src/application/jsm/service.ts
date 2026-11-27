import { integer, uuid, utc } from '../../domain/inventory/model';
import type { TenantContext } from '../ports/tenant-context';
import {
  JsmError,
  type JsmDependencies,
  type JsmIntent,
  type JsmIssue,
} from './contracts';
import { bound, configuration, request } from './validation';
export interface JsmResult {
  readonly state:
    'pending' | 'retry_wait' | 'ambiguous' | 'manual_review' | 'linked';
  readonly intentId: string;
  readonly issue: JsmIssue | null;
}
/** Does not authorise caller-supplied tenant IDs. Call only with a trusted runtime context. */
export class JsmCreationService {
  constructor(private readonly deps: JsmDependencies) {}
  async configure(
    ctx: TenantContext,
    input: unknown,
    expected: unknown,
  ): Promise<void> {
    if (ctx.actor.kind !== 'atlassian-user') throw new JsmError('DENIED');
    await this.deps.authoriseConfiguration(ctx);
    const config = configuration(ctx, input);
    const version = integer(expected, 2147483646, 0);
    if (config.version !== version + 1) throw new JsmError('CONFLICT');
    if (!(await this.deps.gateway.verifyConfiguration(config)))
      throw new JsmError('NOT_READY');
    if (!(await this.deps.repository.saveConfiguration(ctx, config, version)))
      throw new JsmError('CONFLICT');
  }
  async create(ctx: TenantContext, incidentId: unknown): Promise<JsmResult> {
    const id = uuid(incidentId);
    const incident = await this.deps.repository.incident(ctx, id);
    const rawConfig = await this.deps.repository.configuration(ctx);
    if (!incident || !rawConfig) throw new JsmError('NOT_READY');
    bound(ctx, incident);
    const config = configuration(ctx, rawConfig);
    const intentId = uuid(this.deps.id());
    const marker = `light-house-${intentId}`;
    const existing = await this.deps.repository.ensure(ctx, {
      installationId: ctx.installationId,
      tenantId: ctx.tenantId,
      id: intentId,
      incidentId: id,
      marker,
      configuration: config,
      request: request(config, incident, marker),
      state: 'prepared',
      version: 1,
      attempts: 0,
      reconciliations: 0,
      dueAt: null,
      leaseUntil: null,
      issue: null,
      reason: null,
    });
    bound(ctx, existing);
    bound(ctx, existing.configuration);
    if (existing.incidentId !== id) throw new JsmError('DENIED');
    const result = (
      state: JsmResult['state'],
      issue = existing.issue,
    ): JsmResult => ({ state, intentId: existing.id, issue });
    if (existing.state === 'linked' || existing.state === 'manual_review')
      return result(existing.state);
    const now = utc(this.deps.now());
    if (
      (existing.leaseUntil && existing.leaseUntil > now) ||
      (existing.dueAt && existing.dueAt > now)
    )
      return result(existing.state === 'retry_wait' ? 'retry_wait' : 'pending');
    const mode =
      existing.state === 'prepared' || existing.state === 'retry_wait'
        ? existing.attempts < 3
          ? 'create'
          : 'reconcile'
        : 'reconcile';
    const token = uuid(this.deps.id());
    const until = new Date(Date.parse(now) + 60_000).toISOString();
    const claimed = await this.deps.repository.claim(
      ctx,
      existing.id,
      existing.version,
      token,
      now,
      until,
      mode,
    );
    if (!claimed) return result('pending');
    bound(ctx, claimed);
    bound(ctx, claimed.configuration);
    if (claimed.id !== existing.id || claimed.incidentId !== id)
      throw new JsmError('DENIED');
    if (mode === 'reconcile') return this.reconcile(ctx, claimed, token);
    let outcome;
    try {
      if (!(await this.deps.gateway.verifyConfiguration(claimed.configuration)))
        return this.finish(
          ctx,
          claimed,
          token,
          'manual_review',
          null,
          null,
          'CONFIGURATION',
        );
      outcome = await this.deps.gateway.create(
        claimed.configuration,
        claimed.request,
      );
    } catch {
      outcome = { kind: 'AMBIGUOUS' } as const;
    }
    if (outcome.kind === 'created')
      return this.finish(
        ctx,
        claimed,
        token,
        'linked',
        outcome.issue,
        null,
        null,
      );
    if (outcome.kind === 'RATE_LIMITED') {
      if (claimed.attempts >= 3)
        return this.finish(
          ctx,
          claimed,
          token,
          'manual_review',
          null,
          null,
          'RATE_LIMITED',
        );
      const seconds = integer(outcome.retryAfterSeconds, 3600, 1);
      const due = new Date(
        Date.parse(utc(this.deps.now())) + seconds * 1000,
      ).toISOString();
      return this.finish(
        ctx,
        claimed,
        token,
        'retry_wait',
        null,
        due,
        'RATE_LIMITED',
      );
    }
    return this.finish(
      ctx,
      claimed,
      token,
      outcome.kind === 'CONFIGURATION' ? 'manual_review' : 'ambiguous',
      null,
      null,
      outcome.kind,
    );
  }
  private async reconcile(
    ctx: TenantContext,
    row: JsmIntent,
    token: string,
  ): Promise<JsmResult> {
    let found;
    try {
      found = await this.deps.gateway.find(row.configuration, row.marker);
    } catch {
      found = { complete: false, issues: [] };
    }
    if (found.complete && found.issues.length === 1)
      return this.finish(
        ctx,
        row,
        token,
        'linked',
        found.issues[0]!,
        null,
        null,
      );
    // A zero-result search cannot prove that an earlier POST failed; never recreate.
    return this.finish(
      ctx,
      row,
      token,
      found.issues.length > 1 || row.reconciliations >= 3
        ? 'manual_review'
        : 'ambiguous',
      null,
      null,
      'AMBIGUOUS',
    );
  }
  private async finish(
    ctx: TenantContext,
    row: JsmIntent,
    token: string,
    state: 'retry_wait' | 'ambiguous' | 'linked' | 'manual_review',
    issue: JsmIssue | null,
    dueAt: string | null,
    reason: 'CONFIGURATION' | 'RATE_LIMITED' | 'AMBIGUOUS' | null,
  ): Promise<JsmResult> {
    const saved = await this.deps.repository.settle(ctx, row.id, token, {
      state,
      issue,
      dueAt,
      reason,
    });
    return {
      state: saved ? state : 'pending',
      intentId: row.id,
      issue: saved ? issue : null,
    };
  }
}
