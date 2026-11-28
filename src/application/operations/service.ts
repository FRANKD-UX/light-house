import { integer, object, text, utc, uuid } from '../../domain/inventory/model';
import {
  transitionIncident,
  type WorkflowAction,
  type WorkflowActor,
} from '../../domain/incidents/workflow';
import type { TenantContext } from '../ports/tenant-context';
import {
  OperationError,
  type OperationAggregate,
  type OperationAudit,
  type OperationCommand,
  type OperationDependencies,
  type OperationFacts,
  type OperationKind,
  type OperationPending,
  type OperationResult,
  type GateRecord,
} from './contracts';
const kinds = [
  'initialise',
  'acknowledge',
  'triage',
  'start_work',
  'request_validation',
  'validate_restoration',
  'resolve',
  'close',
  'request_handoff',
  'accept_handoff',
  'reject_handoff',
  'return_to_noc',
  'request_return',
  'accept_return',
  'reject_return',
] as const;
export function operationCommand(input: unknown): OperationCommand {
  try {
    const v = object(input);
    if (
      Object.keys(v).some(
        (key) =>
          ![
            'commandId',
            'incidentId',
            'expected',
            'kind',
            'targetTeamId',
            'reason',
          ].includes(key),
      ) ||
      !kinds.includes(v.kind as (typeof kinds)[number])
    )
      throw new OperationError('INVALID');
    const command: OperationCommand = {
      commandId: uuid(v.commandId),
      incidentId: uuid(v.incidentId),
      expected: integer(v.expected, 2147483646, 0),
      kind: v.kind as (typeof kinds)[number],
      ...(v.kind === 'request_handoff'
        ? { targetTeamId: uuid(v.targetTeamId) }
        : {}),
    };
    if (v.kind !== 'request_handoff' && v.targetTeamId !== undefined)
      throw new OperationError('INVALID');
    if (v.kind === 'reject_handoff' || v.kind === 'reject_return')
      return { ...command, reason: text(v.reason, 300) };
    if (v.reason !== undefined) throw new OperationError('INVALID');
    return command;
  } catch {
    throw new OperationError('INVALID');
  }
}
function scope(
  ctx: TenantContext,
  value: { installationId: string; tenantId: string },
) {
  if (
    value.installationId !== ctx.installationId ||
    value.tenantId !== ctx.tenantId
  )
    throw new OperationError('DENIED');
}
function facts(input: OperationFacts, now: string): OperationFacts {
  integer(input.revision);
  if (input.recoveryObservedAt !== null && utc(input.recoveryObservedAt) > now)
    throw new OperationError('NOT_READY');
  return input;
}
const gateTemplates: Partial<Record<OperationKind, GateRecord['template']>> = {
  start_work: 'operational',
  request_handoff: 'operational',
  accept_handoff: 'operational',
  request_return: 'remediation',
  return_to_noc: 'remediation',
  accept_return: 'remediation',
  request_validation: 'remediation',
  validate_restoration: 'restoration',
  resolve: 'closure',
  close: 'closure',
};
const requiredFields: Record<GateRecord['template'], readonly string[]> = {
  operational: [
    'diagnosticFindings',
    'escalationJustification',
    'supportingEvidence',
    'receivingCapability',
    'accountableEngineer',
    'outstandingActions',
  ],
  remediation: ['workCompleted', 'supportingEvidence', 'outstandingActions'],
  restoration: [
    'restorationEvidence',
    'impactReassessed',
    'outstandingActions',
    'validatorRecorded',
  ],
  closure: [
    'closureEvidence',
    'outstandingActions',
    'nativePermissionConfirmed',
  ],
};
const booleanFields = new Set([
  'receivingCapability',
  'accountableEngineer',
  'impactReassessed',
  'validatorRecorded',
  'nativePermissionConfirmed',
]);
/** Projects operator attestations only. These fields never grant native Jira authority. */
export function parseGateFields(
  template: GateRecord['template'],
  input: unknown,
): Readonly<Record<string, string | true>> {
  try {
    const required = requiredFields[template];
    if (!required) throw new OperationError('INVALID');
    const raw = object(input);
    if (
      Object.keys(raw).length !== required.length ||
      Object.keys(raw).some((key) => !required.includes(key))
    )
      throw new OperationError('INVALID');
    return Object.freeze(
      Object.fromEntries(
        required.map((key) => {
          if (booleanFields.has(key)) {
            if (raw[key] !== true) throw new OperationError('NOT_READY');
            return [key, true] as const;
          }
          return [key, text(raw[key], 1000)] as const;
        }),
      ),
    );
  } catch (error) {
    if (error instanceof OperationError) throw error;
    throw new OperationError('INVALID');
  }
}
/** Operator contexts must be constructed/authorised server-side. No client actor, ownership or gate flag is accepted. */
export class OperationService {
  constructor(private readonly deps: OperationDependencies) {}
  async recordChecklist(
    ctx: TenantContext,
    input: unknown,
  ): Promise<{ gateId: string; validUntil: string }> {
    let raw: Record<string, unknown>;
    try {
      raw = object(input);
    } catch {
      throw new OperationError('INVALID');
    }
    if (
      Object.keys(raw).some(
        (key) => !['incidentId', 'kind', 'expected', 'fields'].includes(key),
      )
    )
      throw new OperationError('INVALID');
    const incidentId = uuid(raw.incidentId),
      expected = integer(raw.expected);
    const kind = kinds.find((kind) => kind === raw.kind);
    if (!kind || kind === 'initialise' || !gateTemplates[kind])
      throw new OperationError('INVALID');
    if (ctx.actor.kind !== 'atlassian-user') throw new OperationError('DENIED');
    const actor = await this.deps.authorise(ctx, {
      incidentId,
      commandId: uuid(this.deps.id()),
      expected,
      kind,
    });
    this.actor(ctx, actor);
    const current = await this.deps.repository.load(ctx, incidentId);
    if (!current) throw new OperationError('NOT_READY');
    this.aggregate(ctx, current, incidentId);
    if (actor.nocTeamId !== current.nocTeamId)
      throw new OperationError('CONFLICT');
    if (current.pending) throw new OperationError('REPAIR_REQUIRED');
    if (current.lease || current.incident.version !== expected)
      throw new OperationError('CONFLICT');
    if (kind === 'accept_handoff') {
      if (actor.teamId !== current.incident.pendingHandoff?.targetTeamId)
        throw new OperationError('DENIED');
    } else if (kind === 'accept_return') {
      if (actor.teamId !== current.nocTeamId || !current.incident.pendingReturn)
        throw new OperationError('DENIED');
    } else if (
      actor.teamId !== current.incident.ownerTeamId ||
      (current.incident.ownerAssigneeId !== null &&
        actor.assigneeId !== current.incident.ownerAssigneeId)
    )
      throw new OperationError('DENIED');
    const now = utc(this.deps.now());
    const currentFacts = facts(
      await this.deps.repository.facts(ctx, incidentId),
      now,
    );
    const template = gateTemplates[kind]!;
    const record: GateRecord = {
      installationId: ctx.installationId,
      tenantId: ctx.tenantId,
      incidentId,
      id: uuid(this.deps.id()),
      template,
      templateVersion: 1,
      incidentVersion: expected,
      factsVersion: currentFacts.revision,
      evaluatedAt: now,
      validUntil: new Date(Date.parse(now) + 300_000).toISOString(),
      fields: parseGateFields(template, raw.fields),
    };
    if (!(await this.deps.repository.saveGate(ctx, record)))
      throw new OperationError('CONFLICT');
    return { gateId: record.id, validUntil: record.validUntil };
  }
  async execute(ctx: TenantContext, input: unknown): Promise<OperationResult> {
    const command = operationCommand(input);
    if (ctx.actor.kind !== 'atlassian-user') throw new OperationError('DENIED');
    const actor = await this.deps.authorise(ctx, command);
    this.actor(ctx, actor);
    const now = utc(this.deps.now());
    const fingerprint = this.deps.digest(
      JSON.stringify([
        ctx.installationId,
        ctx.tenantId,
        ctx.actor.accountId,
        actor.teamId,
        command,
      ]),
    );
    if (!/^[0-9a-f]{64}$/.test(fingerprint))
      throw new OperationError('INVALID');
    const receipt = await this.deps.repository.receipt(
      ctx,
      command.incidentId,
      command.commandId,
    );
    if (receipt) {
      if (
        receipt.commandId !== command.commandId ||
        receipt.result.incidentId !== command.incidentId
      )
        throw new OperationError('DENIED');
      if (receipt.fingerprint !== fingerprint)
        throw new OperationError('CONFLICT');
      return receipt.result;
    }
    const current = await this.deps.repository.load(ctx, command.incidentId);
    if (current) {
      this.aggregate(ctx, current, command.incidentId);
      if (actor.nocTeamId !== current.nocTeamId)
        throw new OperationError('CONFLICT');
      if (current.pending) {
        if (current.pending.receipt.commandId !== command.commandId)
          throw new OperationError('REPAIR_REQUIRED');
        if (current.pending.receipt.fingerprint !== fingerprint)
          throw new OperationError('CONFLICT');
        return this.materialise(ctx, command.incidentId, current.pending);
      }
      if (current.lease && utc(current.lease.until) > now)
        throw new OperationError('CONFLICT');
      // Expired unexplained leases require bounded repair; they never authorise a new mutation.
      if (current.lease) throw new OperationError('REPAIR_REQUIRED');
    }
    if (command.kind === 'initialise')
      return this.initialise(ctx, command, actor, current, fingerprint, now);
    if (!current) throw new OperationError('NOT_READY');
    if (command.expected !== current.incident.version)
      throw new OperationError('CONFLICT');
    const currentFacts = facts(
      await this.deps.repository.facts(ctx, command.incidentId),
      now,
    );
    const gate = await this.gate(ctx, current, command.kind, currentFacts, now);
    let at = now;
    let nativeIntentId: string | null = null;
    if (command.kind === 'resolve' || command.kind === 'close') {
      if (
        !current.validation ||
        current.validation.factsVersion !== currentFacts.revision ||
        utc(current.validation.validUntil) <= now ||
        current.incident.restorationValidatedAt !==
          current.validation.validatedAt
      )
        throw new OperationError('CONFLICT');
      const native = await this.deps.repository.nativeConfirmation(
        ctx,
        command.incidentId,
        command.kind,
      );
      if (!native) throw new OperationError('NOT_READY');
      scope(ctx, native);
      nativeIntentId = uuid(native.intentId);
      if (
        native.incidentId !== command.incidentId ||
        native.operation !== command.kind ||
        native.expectedVersion !== command.expected ||
        native.gateId !== gate?.id ||
        typeof native.issueId !== 'string' ||
        !/^[1-9][0-9]{0,19}$/.test(native.issueId)
      )
        throw new OperationError('CONFLICT');
      at = utc(native.confirmedAt);
      if (
        at > now ||
        at < current.validation.validatedAt ||
        at < gate!.evaluatedAt ||
        (current.incident.resolvedAt !== null &&
          at < current.incident.resolvedAt)
      )
        throw new OperationError('CONFLICT');
    }
    const action: WorkflowAction =
      command.kind === 'request_handoff'
        ? { kind: 'request_handoff', targetTeamId: command.targetTeamId! }
        : { kind: command.kind };
    const next = transitionIncident(
      {
        ...current.incident,
        recoveryObservedAt: currentFacts.recoveryObservedAt,
      },
      actor,
      command.expected,
      action,
      at,
      true,
    );
    const validation =
      command.kind === 'validate_restoration'
        ? {
            gateId: gate!.id,
            factsVersion: currentFacts.revision,
            validatedAt: at,
            validUntil: gate!.validUntil,
          }
        : command.kind === 'resolve' || command.kind === 'close'
          ? current.validation
          : null;
    const pending = this.pending(
      ctx,
      command,
      fingerprint,
      actor,
      current.incident,
      next,
      now,
      gate?.id ?? null,
      nativeIntentId,
      currentFacts.revision,
    );
    const updated: OperationAggregate = {
      ...current,
      incident: next,
      factsVersion: currentFacts.revision,
      validation,
      pending,
      lease: null,
    };
    if (!(await this.deps.repository.save(ctx, command.expected, updated)))
      throw new OperationError('CONFLICT');
    return this.materialise(ctx, command.incidentId, pending);
  }
  private actor(ctx: TenantContext, actor: WorkflowActor) {
    if (
      actor.tenantId !== ctx.tenantId ||
      (actor.role !== 'operator' && actor.role !== 'admin')
    )
      throw new OperationError('DENIED');
    uuid(actor.teamId);
    uuid(actor.nocTeamId);
    uuid(actor.assigneeId);
  }
  private aggregate(
    ctx: TenantContext,
    aggregate: OperationAggregate,
    id: string,
  ) {
    scope(ctx, aggregate);
    if (
      aggregate.incident.tenantId !== ctx.tenantId ||
      aggregate.incident.id !== id
    )
      throw new OperationError('DENIED');
    uuid(aggregate.nocTeamId);
    const pending = aggregate.pending;
    if (pending) {
      const receipt = pending.receipt,
        result = receipt.result,
        audit = pending.audit;
      uuid(receipt.commandId);
      if (
        !/^[0-9a-f]{64}$/.test(receipt.fingerprint) ||
        audit.commandId !== receipt.commandId ||
        result.incidentId !== id ||
        result.version !== aggregate.incident.version ||
        result.ownerTeamId !== aggregate.incident.ownerTeamId ||
        result.ownerAssigneeId !== aggregate.incident.ownerAssigneeId ||
        result.state !== aggregate.incident.state ||
        result.correlationId !== audit.correlationId ||
        result.pendingMaterialisation !== false ||
        audit.toOwner !== result.ownerTeamId ||
        audit.toAssigneeId !== result.ownerAssigneeId ||
        audit.toState !== result.state ||
        audit.factsVersion !== aggregate.factsVersion
      )
        throw new OperationError('INVALID');
    }
  }
  private async gate(
    ctx: TenantContext,
    current: OperationAggregate,
    kind: OperationKind,
    currentFacts: OperationFacts,
    now: string,
  ): Promise<GateRecord | null> {
    const template = gateTemplates[kind];
    if (!template) return null;
    const record = await this.deps.repository.gate(ctx, current, kind);
    if (!record) throw new OperationError('NOT_READY');
    scope(ctx, record);
    uuid(record.id);
    if (
      record.incidentId !== current.incident.id ||
      record.template !== template ||
      record.templateVersion !== 1 ||
      record.incidentVersion !== current.incident.version ||
      record.factsVersion !== currentFacts.revision ||
      utc(record.evaluatedAt) > now ||
      utc(record.validUntil) <= now
    )
      throw new OperationError('CONFLICT');
    parseGateFields(template, record.fields);
    return record;
  }
  private async initialise(
    ctx: TenantContext,
    command: OperationCommand,
    actor: WorkflowActor,
    current: OperationAggregate | null,
    fingerprint: string,
    now: string,
  ) {
    if (current || command.expected !== 0) throw new OperationError('CONFLICT');
    if (actor.teamId !== actor.nocTeamId) throw new OperationError('DENIED');
    const incident = await this.deps.repository.enriched(
      ctx,
      command.incidentId,
    );
    if (!incident || incident.sla.kind !== 'selected')
      throw new OperationError('NOT_READY');
    scope(ctx, incident);
    if (incident.id !== command.incidentId || incident.occurredAt > now)
      throw new OperationError('DENIED');
    const currentFacts = facts(
      await this.deps.repository.facts(ctx, command.incidentId),
      now,
    );
    const operation = {
      id: incident.id,
      tenantId: ctx.tenantId,
      state: 'new' as const,
      version: 1,
      ownerTeamId: actor.nocTeamId,
      ownerAssigneeId: null,
      sla: incident.sla.snapshot,
      pendingHandoff: null,
      pendingReturn: null,
      recoveryObservedAt: currentFacts.recoveryObservedAt,
      restorationValidatedAt: null,
      resolvedAt: null,
    };
    const pending = this.pending(
      ctx,
      command,
      fingerprint,
      actor,
      operation,
      operation,
      now,
      null,
      null,
      currentFacts.revision,
    );
    const inserted = await this.deps.repository.initialise(ctx, {
      installationId: ctx.installationId,
      tenantId: ctx.tenantId,
      nocTeamId: actor.nocTeamId,
      incident: operation,
      factsVersion: currentFacts.revision,
      validation: null,
      pending,
      lease: null,
    });
    this.aggregate(ctx, inserted, command.incidentId);
    if (
      inserted.pending?.receipt.commandId !== command.commandId ||
      inserted.pending.receipt.fingerprint !== fingerprint
    )
      throw new OperationError('CONFLICT');
    return this.materialise(ctx, command.incidentId, inserted.pending);
  }
  private pending(
    ctx: TenantContext,
    command: OperationCommand,
    fingerprint: string,
    actor: WorkflowActor,
    before: OperationAggregate['incident'],
    after: OperationAggregate['incident'],
    now: string,
    gateId: string | null,
    nativeIntentId: string | null,
    factsVersion: number,
  ): OperationPending {
    if (ctx.actor.kind !== 'atlassian-user') throw new OperationError('DENIED');
    const correlationId = uuid(this.deps.id());
    const result: OperationResult = {
      incidentId: after.id,
      version: after.version,
      state: after.state,
      ownerTeamId: after.ownerTeamId,
      ownerAssigneeId: after.ownerAssigneeId,
      correlationId,
      pendingMaterialisation: false,
    };
    const audit: OperationAudit = {
      correlationId,
      commandId: command.commandId,
      at: now,
      accountId: text(ctx.actor.accountId, 255),
      assigneeId: actor.assigneeId,
      teamId: actor.teamId,
      action: command.kind,
      fromState: before.state,
      toState: after.state,
      fromOwner: before.ownerTeamId,
      toOwner: after.ownerTeamId,
      fromAssigneeId: before.ownerAssigneeId,
      toAssigneeId: after.ownerAssigneeId,
      reason: command.reason ?? null,
      gateId,
      targetTeamId:
        command.targetTeamId ??
        before.pendingHandoff?.targetTeamId ??
        ([
          'request_return',
          'return_to_noc',
          'accept_return',
          'reject_return',
        ].includes(command.kind)
          ? actor.nocTeamId
          : null),
      nativeIntentId,
      factsVersion,
      slaPolicyId: after.sla.policyId,
      slaStartedAt: after.sla.startedAt,
      slaDeadlineAt: after.sla.deadlineAt,
    };
    return {
      receipt: { commandId: command.commandId, fingerprint, result },
      audit,
    };
  }
  private async materialise(
    ctx: TenantContext,
    incidentId: string,
    pending: OperationPending,
  ): Promise<OperationResult> {
    let complete = false;
    try {
      complete = await this.deps.repository.materialise(
        ctx,
        incidentId,
        pending.receipt.commandId,
      );
    } catch {
      /* Original durable envelope remains for bounded explicit repair. */
    }
    return { ...pending.receipt.result, pendingMaterialisation: !complete };
  }
}
