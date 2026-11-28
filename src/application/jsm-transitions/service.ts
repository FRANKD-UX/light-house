import { integer, object, text, utc, uuid } from '../../domain/inventory/model';
import { identifier } from '../jsm/validation';
import type { TenantContext } from '../ports/tenant-context';
import {
  TransitionError,
  type EnforcementEvidence,
  type TransitionCommand,
  type TransitionDependencies,
  type TransitionIntent,
  type TransitionObservation,
  type TransitionPlan,
  type TransitionResult,
} from './contracts';

function command(input: unknown): TransitionCommand {
  try {
    const v = object(input);
    if (
      Object.keys(v).some(
        (key) => !['incidentId', 'operation', 'expectedVersion'].includes(key),
      ) ||
      (v.operation !== 'resolve' && v.operation !== 'close')
    )
      throw new TransitionError('INVALID');
    return {
      incidentId: uuid(v.incidentId),
      operation: v.operation,
      expectedVersion: integer(v.expectedVersion),
    };
  } catch {
    throw new TransitionError('INVALID');
  }
}
function plan(
  ctx: TenantContext,
  request: TransitionCommand,
  input: unknown,
): TransitionPlan {
  const v = object(input);
  if (
    ctx.actor.kind !== 'atlassian-user' ||
    v.installationId !== ctx.installationId ||
    v.tenantId !== ctx.tenantId ||
    v.accountId !== ctx.actor.accountId
  )
    throw new TransitionError('DENIED');
  if (
    v.incidentId !== request.incidentId ||
    v.operation !== request.operation ||
    v.expectedVersion !== request.expectedVersion
  )
    throw new TransitionError('CONFLICT');
  const result: TransitionPlan = {
    installationId: text(v.installationId, 255),
    tenantId: uuid(v.tenantId),
    accountId: text(v.accountId, 128),
    ...request,
    factsVersion: integer(v.factsVersion),
    gateId: uuid(v.gateId),
    mappingVersion: integer(v.mappingVersion),
    issueId: identifier(v.issueId),
    projectId: identifier(v.projectId),
    transitionId: identifier(v.transitionId),
    fromStatusId: identifier(v.fromStatusId),
    targetStatusId: identifier(v.targetStatusId),
    resolutionId: v.resolutionId === null ? null : identifier(v.resolutionId),
  };
  if (result.fromStatusId === result.targetStatusId)
    throw new TransitionError('INVALID');
  return result;
}
function enforcement(
  ctx: TenantContext,
  expected: TransitionPlan,
  input: EnforcementEvidence | null,
  now: string,
): string {
  if (!input) throw new TransitionError('NOT_READY');
  const v = object(input);
  if (
    v.installationId !== ctx.installationId ||
    v.tenantId !== ctx.tenantId ||
    v.projectId !== expected.projectId
  )
    throw new TransitionError('DENIED');
  if (
    v.kind !== 'native-bypass-enforcement' ||
    utc(v.verifiedAt) > now ||
    utc(v.validUntil) <= now
  )
    throw new TransitionError('NOT_READY');
  return uuid(v.reviewId);
}
function observation(
  expected: TransitionPlan,
  input: unknown,
  now: string,
): TransitionObservation {
  const v = object(input);
  if (
    v.issueId !== expected.issueId ||
    v.projectId !== expected.projectId ||
    v.causality !== 'postcondition-only'
  )
    throw new TransitionError('DENIED');
  const at = utc(v.observedAt);
  if (at > now) throw new TransitionError('INVALID');
  return {
    issueId: expected.issueId,
    projectId: expected.projectId,
    statusId: identifier(v.statusId),
    observedAt: at,
    causality: 'postcondition-only',
  };
}
function intent(
  ctx: TenantContext,
  request: TransitionCommand,
  input: TransitionIntent,
  expected: TransitionPlan,
  review: string,
  now: string,
): TransitionIntent {
  uuid(input.id);
  integer(input.version);
  integer(input.attempts, 1, 0);
  integer(input.reconciliations, 3, 0);
  if (
    ![
      'prepared',
      'sending',
      'reconciling',
      'ambiguous',
      'observed',
      'manual_review',
    ].includes(input.state) ||
    !['not-sent', 'accepted', 'unknown', 'rejected'].includes(
      input.postResponse,
    ) ||
    (input.reason !== null &&
      ![
        'PERMISSION',
        'CONFIGURATION',
        'RATE_LIMITED',
        'AMBIGUOUS',
        'POSTCONDITION_UNAVAILABLE',
      ].includes(input.reason))
  )
    throw new TransitionError('INVALID');
  const stored = plan(ctx, request, input.plan);
  if (
    JSON.stringify(stored) !== JSON.stringify(expected) ||
    input.enforcementReviewId !== review
  )
    throw new TransitionError('CONFLICT');
  if (input.leaseUntil !== null) utc(input.leaseUntil);
  const observed =
    input.observation === null
      ? null
      : observation(stored, input.observation, now);
  if (
    input.state === 'observed' &&
    observed?.statusId !== stored.targetStatusId
  )
    throw new TransitionError('INVALID');
  return { ...input, plan: stored, observation: observed };
}

/** Independent local component. Does not produce a causal NativeConfirmation or enable guarded closure. */
export class NativeTransitionService {
  constructor(private readonly deps: TransitionDependencies) {}
  async execute(ctx: TenantContext, input: unknown): Promise<TransitionResult> {
    const requested = command(input);
    if (ctx.actor.kind !== 'atlassian-user')
      throw new TransitionError('DENIED');
    try {
      const checked = await this.deps.preflight(ctx, requested);
      const checkedAt = utc(this.deps.now()),
        mapped = plan(ctx, requested, checked.plan);
      const review = enforcement(ctx, mapped, checked.enforcement, checkedAt);
      const saved = await this.deps.repository.ensure(ctx, {
        id: uuid(this.deps.id()),
        plan: mapped,
        enforcementReviewId: review,
        state: 'prepared',
        version: 1,
        attempts: 0,
        reconciliations: 0,
        leaseUntil: null,
        reason: null,
        postResponse: 'not-sent',
        observation: null,
      });
      // Persistence may advance server time; a claim must not predate its insert.
      const now = utc(this.deps.now());
      if (now < checkedAt) throw new TransitionError('CONFLICT');
      enforcement(ctx, mapped, checked.enforcement, now);
      const existing = intent(ctx, requested, saved, mapped, review, now);
      const result = (
        state: TransitionResult['state'],
        observed: TransitionObservation | null = null,
      ): TransitionResult => ({
        intentId: existing.id,
        state,
        observation: observed,
        nativeConfirmationAvailable: false,
      });
      if (existing.state === 'observed' || existing.state === 'manual_review')
        return result(existing.state, existing.observation);
      if (existing.leaseUntil !== null && existing.leaseUntil > now)
        return result('pending');
      const mode = existing.state === 'prepared' ? 'send' : 'reconcile';
      if (
        (mode === 'send' && existing.attempts !== 0) ||
        (mode === 'reconcile' && existing.reconciliations >= 3)
      )
        throw new TransitionError('CONFLICT');
      const token = uuid(this.deps.id()),
        until = new Date(Date.parse(now) + 60_000).toISOString();
      const raw = await this.deps.repository.claim(
        ctx,
        existing.id,
        existing.version,
        token,
        now,
        until,
        mode,
      );
      if (!raw) return result('pending');
      const claimed = intent(ctx, requested, raw, mapped, review, now);
      if (
        claimed.id !== existing.id ||
        claimed.version !== existing.version + 1 ||
        claimed.leaseUntil !== until ||
        claimed.state !== (mode === 'send' ? 'sending' : 'reconciling') ||
        claimed.attempts !== existing.attempts + (mode === 'send' ? 1 : 0) ||
        claimed.reconciliations !==
          existing.reconciliations + (mode === 'reconcile' ? 1 : 0)
      )
        throw new TransitionError('CONFLICT');
      let response =
        claimed.postResponse === 'not-sent' &&
        (mode === 'send' || existing.state === 'sending')
          ? ('unknown' as const)
          : claimed.postResponse;
      if (mode === 'send') {
        let eligible = false;
        try {
          eligible = await this.deps.gateway.eligible(claimed.plan);
        } catch {
          /* No POST attempted. */
        }
        if (!eligible)
          return await this.finish(
            ctx,
            claimed,
            token,
            'manual_review',
            'CONFIGURATION',
            'not-sent',
            null,
          );
        // Eligibility can be slow. Recheck trusted facts/gates/identity and the live lease
        // immediately before POST; this still is not remote Jira atomic enforcement.
        const sendAt = utc(this.deps.now());
        const refreshed = await this.deps.preflight(ctx, requested);
        const freshPlan = plan(ctx, requested, refreshed.plan);
        const freshReview = enforcement(
          ctx,
          freshPlan,
          refreshed.enforcement,
          utc(this.deps.now()),
        );
        if (
          JSON.stringify(freshPlan) !== JSON.stringify(claimed.plan) ||
          freshReview !== claimed.enforcementReviewId ||
          sendAt >= until ||
          utc(this.deps.now()) >= until
        )
          throw new TransitionError('CONFLICT');
        let sent;
        try {
          sent = await this.deps.gateway.post(claimed.plan);
        } catch {
          sent = { kind: 'ambiguous' } as const;
        }
        if (sent.kind === 'rejected') {
          if (
            !['PERMISSION', 'CONFIGURATION', 'RATE_LIMITED'].includes(
              sent.reason,
            )
          )
            throw new TransitionError('INVALID');
          return await this.finish(
            ctx,
            claimed,
            token,
            'manual_review',
            sent.reason,
            'rejected',
            null,
          );
        }
        if (sent.kind !== 'accepted' && sent.kind !== 'ambiguous')
          throw new TransitionError('INVALID');
        response = sent.kind === 'accepted' ? 'accepted' : 'unknown';
      }
      let observed: TransitionObservation | null = null;
      try {
        const found = await this.deps.gateway.observe(claimed.plan);
        if (found !== null)
          observed = observation(claimed.plan, found, utc(this.deps.now()));
      } catch {
        /* Unknown/untrusted observation cannot confirm a postcondition. */
      }
      if (observed?.statusId === claimed.plan.targetStatusId)
        return await this.finish(
          ctx,
          claimed,
          token,
          'observed',
          null,
          response,
          observed,
        );
      return await this.finish(
        ctx,
        claimed,
        token,
        claimed.reconciliations >= 3 ? 'manual_review' : 'ambiguous',
        response === 'unknown' ? 'AMBIGUOUS' : 'POSTCONDITION_UNAVAILABLE',
        response,
        null,
      );
    } catch (error) {
      if (error instanceof TransitionError) throw error;
      throw new TransitionError('UNAVAILABLE');
    }
  }
  private async finish(
    ctx: TenantContext,
    current: TransitionIntent,
    token: string,
    state: 'ambiguous' | 'observed' | 'manual_review',
    reason: TransitionIntent['reason'],
    response: TransitionIntent['postResponse'],
    observed: TransitionObservation | null,
  ): Promise<TransitionResult> {
    const saved = await this.deps.repository.settle(ctx, current.id, token, {
      state,
      reason,
      postResponse: response,
      observation: observed,
    });
    return {
      intentId: current.id,
      state: saved ? state : 'pending',
      observation: saved ? observed : null,
      nativeConfirmationAvailable: false,
    };
  }
}
