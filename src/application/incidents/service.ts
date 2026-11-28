import type { TenantContext } from '../ports/tenant-context';
import { object, text, utc, uuid } from '../../domain/inventory/model';
import {
  IncidentError,
  type Incident,
  type IncidentEvidence,
} from '../../domain/incidents/model';
import { determineImpact } from '../../domain/incidents/impact';
import { selectSla } from '../../domain/incidents/sla';
import type { IncidentDependencies } from './ports';

export type EnrichmentResult =
  | { readonly kind: 'awaiting_problem' }
  | {
      readonly kind: 'incident';
      readonly incident: Incident;
      readonly recoveryObservedAt: string | null;
      readonly updateCount: number;
      readonly conflictingEvidenceCount?: number;
    };
function evidence(input: unknown): IncidentEvidence {
  const value = object(input),
    event = object(value.event);
  const externalEventId = text(event.externalEventId, 64),
    problemEventId = text(event.problemEventId, 64);
  if (
    !/^[1-9]\d{0,63}$/.test(externalEventId) ||
    !/^[1-9]\d{0,63}$/.test(problemEventId) ||
    !['problem', 'recovery', 'update'].includes(event.kind as string)
  )
    throw new IncidentError('INVALID');
  return {
    inboxId: uuid(value.inboxId),
    sourceId: uuid(value.sourceId),
    correlationId: uuid(value.correlationId),
    receivedAt: utc(value.receivedAt),
    uplinkId: uuid(value.uplinkId),
    siteId: uuid(value.siteId),
    event: {
      externalEventId,
      problemEventId,
      resourceId: text(event.resourceId, 128),
      kind: event.kind as IncidentEvidence['event']['kind'],
      occurredAt: utc(event.occurredAt),
      severity: text(event.severity, 32),
    },
  };
}
function boundIncident(
  ctx: TenantContext,
  sourceId: string,
  problemEventId: string,
  incident: Incident,
): Incident {
  if (
    incident.installationId !== ctx.installationId ||
    incident.tenantId !== ctx.tenantId ||
    incident.sourceId !== sourceId ||
    incident.problemEventId !== problemEventId
  )
    throw new IncidentError('DENIED');
  uuid(incident.id);
  uuid(incident.correlationId);
  utc(incident.occurredAt);
  utc(incident.createdAt);
  return incident;
}
/** Called only with server-derived, authorised context; no tenant/actor from client payload. */
export class IncidentService {
  constructor(private readonly deps: IncidentDependencies) {}
  async process(ctx: TenantContext, input: unknown): Promise<EnrichmentResult> {
    text(ctx.installationId, 255);
    uuid(ctx.tenantId);
    const command = object(input);
    if (Object.keys(command).some((key) => key !== 'inboxId'))
      throw new IncidentError('INVALID');
    const inboxId = uuid(command.inboxId);
    const raw = await this.deps.repository.inbox(ctx, inboxId);
    if (!raw) throw new IncidentError('NOT_READY');
    const current = evidence(raw);
    if (
      current.inboxId !== inboxId ||
      (ctx.actor.kind === 'monitoring-source' &&
        ctx.actor.sourceId !== current.sourceId)
    )
      throw new IncidentError('DENIED');
    // This durable operation precedes enrichment so recovery-before-problem survives retries.
    await this.deps.repository.recordEvidence(ctx, current);
    let incident = await this.deps.repository.find(
      ctx,
      current.sourceId,
      current.event.problemEventId,
    );
    if (!incident && current.event.kind !== 'problem')
      return { kind: 'awaiting_problem' };
    if (!incident) {
      const inventory = await this.deps.inventory.load(ctx, current.uplinkId);
      const impact = determineImpact(
        ctx.tenantId,
        current.uplinkId,
        current.event.occurredAt,
        inventory,
      );
      if (impact.siteId !== current.siteId) throw new IncidentError('DENIED');
      const sla = selectSla(
        ctx.tenantId,
        current.event.occurredAt,
        current.event.severity,
        impact,
        await this.deps.inventory.policies(ctx),
      );
      const candidate: Incident = Object.freeze({
        id: uuid(this.deps.id()),
        installationId: ctx.installationId,
        tenantId: ctx.tenantId,
        sourceId: current.sourceId,
        problemEventId: current.event.problemEventId,
        correlationId: uuid(this.deps.id()),
        createdAt: utc(this.deps.now()),
        occurredAt: current.event.occurredAt,
        impact,
        sla,
        state: sla.kind === 'selected' ? 'new' : 'manual_triage',
        version: 1,
      });
      incident = await this.deps.repository.createIfAbsent(ctx, candidate);
    }
    boundIncident(
      ctx,
      current.sourceId,
      current.event.problemEventId,
      incident,
    );
    const entries = await this.deps.repository.evidence(
      ctx,
      current.sourceId,
      current.event.problemEventId,
    );
    if (!Array.isArray(entries) || entries.length > 1000)
      throw new IncidentError('NOT_READY');
    const savedEntries = entries.map(evidence);
    for (const saved of savedEntries) {
      if (
        saved.sourceId !== current.sourceId ||
        saved.event.problemEventId !== current.event.problemEventId
      )
        throw new IncidentError('DENIED');
    }
    // Snapshot mapping and original problem evidence jointly establish authority.
    // A later source mapping or another alias must not recover a different resource.
    const originals = savedEntries.filter(
      (saved) =>
        saved.event.kind === 'problem' &&
        saved.event.externalEventId === incident.problemEventId &&
        saved.event.occurredAt === incident.occurredAt &&
        saved.siteId === incident.impact.siteId &&
        saved.uplinkId === incident.impact.uplinkId,
    );
    if (originals.length !== 1)
      throw new IncidentError(originals.length ? 'CONFLICT' : 'NOT_READY');
    const original = originals[0]!;
    const sameResource = (item: IncidentEvidence): boolean =>
      item.siteId === incident.impact.siteId &&
      item.uplinkId === incident.impact.uplinkId &&
      item.event.resourceId === original.event.resourceId;
    if (!sameResource(current)) throw new IncidentError('CONFLICT');
    let recoveryObservedAt: string | null = null;
    let conflictingEvidenceCount = 0;
    const updates = new Set<string>();
    for (const saved of savedEntries) {
      if (!sameResource(saved)) {
        conflictingEvidenceCount++;
        continue;
      }
      if (
        saved.event.kind === 'recovery' &&
        saved.event.occurredAt >= incident.occurredAt &&
        (recoveryObservedAt === null ||
          saved.event.occurredAt < recoveryObservedAt)
      )
        recoveryObservedAt = saved.event.occurredAt;
      if (saved.event.kind === 'update')
        updates.add(saved.event.externalEventId);
    }
    // No evidence kind changes operational state, start time or immutable SLA snapshot.
    return {
      kind: 'incident',
      incident,
      recoveryObservedAt,
      updateCount: updates.size,
      ...(conflictingEvidenceCount ? { conflictingEvidenceCount } : {}),
    };
  }
}
