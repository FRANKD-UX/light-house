import type { TenantContext } from '../ports/tenant-context';
import type { IncidentEvidence } from '../../domain/incidents/model';
import { IncidentError } from '../../domain/incidents/model';
import { object, uuid } from '../../domain/inventory/model';
import type { EnrichmentResult } from '../incidents/service';
import type { JsmResult } from '../jsm/service';

export type PipelineStatus =
  | 'incident_schema_not_ready'
  | 'receipt_not_ready'
  | 'awaiting_problem'
  | 'manual_triage'
  | 'jsm_schema_not_ready'
  | 'configuration_required'
  | JsmResult['state'];
export interface PipelineResult {
  readonly inboxId: string;
  readonly status: PipelineStatus;
  readonly incidentId: string | null;
}
export interface RecoveryResult {
  readonly examined: number;
  readonly next: string | null;
  readonly results: readonly (
    | PipelineResult
    | {
        readonly inboxId: string;
        readonly status: 'failed';
        readonly code:
          'INVALID' | 'DENIED' | 'NOT_READY' | 'CONFLICT' | 'UNAVAILABLE';
      }
  )[];
}
export interface OrchestrationDependencies {
  ready(ctx: TenantContext): Promise<boolean>;
  inbox(ctx: TenantContext, id: string): Promise<IncidentEvidence | null>;
  /** Stored ready receipts, same installation/tenant, active source;21-row sentinel. */
  candidates(
    ctx: TenantContext,
    after: string,
  ): Promise<readonly { id: string }[]>;
  enrich(ctx: TenantContext, inboxId: string): Promise<EnrichmentResult>;
  jsmReady(ctx: TenantContext): Promise<boolean>;
  configured(ctx: TenantContext): Promise<boolean>;
  createJsm(ctx: TenantContext, incidentId: string): Promise<JsmResult>;
  authoriseRecovery(ctx: TenantContext): Promise<void>;
}
/** The durable inbox is the recovery ledger. Every batch is explicit and bounded. */
export class OrchestrationService {
  constructor(private readonly deps: OrchestrationDependencies) {}
  async process(ctx: TenantContext, input: unknown): Promise<PipelineResult> {
    const inboxId = uuid(input);
    const result = (
      status: PipelineStatus,
      incidentId: string | null = null,
    ): PipelineResult => ({ inboxId, status, incidentId });
    if (!(await this.deps.ready(ctx)))
      return result('incident_schema_not_ready');
    if (!(await this.deps.inbox(ctx, inboxId)))
      return result('receipt_not_ready');
    const enriched = await this.deps.enrich(ctx, inboxId);
    if (enriched.kind === 'awaiting_problem') return result('awaiting_problem');
    const incident = enriched.incident;
    if (
      incident.installationId !== ctx.installationId ||
      incident.tenantId !== ctx.tenantId
    )
      throw new IncidentError('DENIED');
    uuid(incident.id);
    if (incident.sla.kind !== 'selected')
      return result('manual_triage', incident.id);
    if (!(await this.deps.jsmReady(ctx)))
      return result('jsm_schema_not_ready', incident.id);
    if (!(await this.deps.configured(ctx)))
      return result('configuration_required', incident.id);
    const created = await this.deps.createJsm(ctx, incident.id);
    return result(created.state, incident.id);
  }
  async recover(ctx: TenantContext, input: unknown): Promise<RecoveryResult> {
    if (ctx.actor.kind !== 'atlassian-user') throw new IncidentError('DENIED');
    await this.deps.authoriseRecovery(ctx);
    const data = object(input);
    if (Object.keys(data).some((key) => key !== 'after'))
      throw new IncidentError('INVALID');
    const after =
      data.after === undefined || data.after === '' ? '' : uuid(data.after);
    if (!(await this.deps.ready(ctx))) throw new IncidentError('NOT_READY');
    const candidates = await this.deps.candidates(ctx, after);
    if (!Array.isArray(candidates) || candidates.length > 21)
      throw new IncidentError('INVALID');
    const ids = candidates.map((row) => uuid(object(row).id));
    if (ids.some((id, index) => id <= (ids[index - 1] ?? after)))
      throw new IncidentError('INVALID');
    const results: RecoveryResult['results'][number][] = [];
    for (const id of ids.slice(0, 20)) {
      try {
        results.push(await this.process(ctx, id));
      } catch (error) {
        // Arbitrary exception text is never a public result or diagnostic label.
        const code =
          error instanceof Error &&
          'code' in error &&
          [
            'INVALID',
            'DENIED',
            'NOT_READY',
            'CONFLICT',
            'UNAVAILABLE',
          ].includes(error.code as string)
            ? (error.code as
                'INVALID' | 'DENIED' | 'NOT_READY' | 'CONFLICT' | 'UNAVAILABLE')
            : 'UNAVAILABLE';
        results.push({ inboxId: id, status: 'failed', code });
      }
    }
    // Advance past attempted failures, which remain explicit in results and durable inbox.
    return {
      examined: results.length,
      next: ids.length > 20 ? ids[19]! : null,
      results,
    };
  }
}
