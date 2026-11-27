import type { TenantContext } from '../ports/tenant-context';
import type {
  Incident,
  IncidentEvidence,
  IncidentInventory,
  IncidentPolicy,
} from '../../domain/incidents/model';

export interface IncidentRepository {
  /** Tenant/install predicates and referenced source binding are mandatory. Only ready inbox rows. */
  inbox(ctx: TenantContext, inboxId: string): Promise<IncidentEvidence | null>;
  /** Unique (installation, tenant, source, externalEventId, kind); persist before processing. */
  recordEvidence(ctx: TenantContext, evidence: IncidentEvidence): Promise<void>;
  find(
    ctx: TenantContext,
    sourceId: string,
    problemEventId: string,
  ): Promise<Incident | null>;
  /** Atomic unique (installation, tenant, source, problemEventId). Return existing winner unchanged. */
  createIfAbsent(ctx: TenantContext, incident: Incident): Promise<Incident>;
  /** Durable recovery/update evidence is independent of incident creation and never stops the SLA. */
  evidence(
    ctx: TenantContext,
    sourceId: string,
    problemEventId: string,
  ): Promise<IncidentEvidence[]>;
}
export interface IncidentInventoryPort {
  /** Complete bounded same-tenant snapshot; fail closed if truncation/integrity is unknown. */
  load(ctx: TenantContext, uplinkId: string): Promise<IncidentInventory>;
  /** Explicit operational policies only; demonstration-only inventory maps are not operational maps. */
  policies(ctx: TenantContext): Promise<IncidentPolicy[]>;
}
export interface IncidentDependencies {
  repository: IncidentRepository;
  inventory: IncidentInventoryPort;
  now(): string;
  id(): string;
}
