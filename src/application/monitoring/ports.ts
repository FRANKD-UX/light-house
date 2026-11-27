import type { TenantContext } from '../ports/tenant-context';
import type {
  CredentialReference,
  InboxRecord,
  MonitoringSource,
  MonitoringObservation,
  ResourceMapping,
  SecretBinding,
  SourceCredential,
  TriageReason,
  InboxState,
} from '../../domain/monitoring/model';
export interface MonitoringRepository {
  observe(
    ctx: TenantContext,
    observation: MonitoringObservation,
  ): Promise<void>;
  observations(ctx: TenantContext): Promise<MonitoringObservation[]>;
  duplicate(ctx: TenantContext, id: string): Promise<void>;
  recoverable(ctx: TenantContext, now: string): Promise<{ id: string }[]>;
  staleCredentials(
    ctx: TenantContext,
    now: string,
  ): Promise<CredentialReference[]>;
  removeReference(ctx: TenantContext, id: string): Promise<void>;
  ready(installationId: string): Promise<boolean>;
  sources(ctx: TenantContext, after?: string): Promise<MonitoringSource[]>;
  source(ctx: TenantContext, id: string): Promise<MonitoringSource | null>;
  createSource(ctx: TenantContext, source: MonitoringSource): Promise<void>;
  credential(reference: CredentialReference): Promise<void>;
  lookupCredential(
    installationId: string,
    keyId: string,
    now: string,
  ): Promise<SourceCredential | null>;
  rotate(
    ctx: TenantContext,
    sourceId: string,
    expected: number,
    keyId: string,
    previousUntil: string,
    now: string,
  ): Promise<boolean>;
  disable(
    ctx: TenantContext,
    sourceId: string,
    expected: number,
    now: string,
  ): Promise<boolean>;
  references(
    ctx: TenantContext,
    sourceId: string,
  ): Promise<CredentialReference[]>;
  admit(
    ctx: TenantContext,
    sourceId: string,
    keyId: string,
    now: string,
  ): Promise<boolean>;
  putInbox(ctx: TenantContext, record: InboxRecord): Promise<InboxRecord>;
  inbox(ctx: TenantContext, id: string): Promise<InboxRecord | null>;
  listInbox(ctx: TenantContext, after: string): Promise<InboxRecord[]>;
  reserveDispatch(
    ctx: TenantContext,
    id: string,
    now: string,
  ): Promise<boolean>;
  markQueued(ctx: TenantContext, id: string, now: string): Promise<void>;
  claim(
    ctx: TenantContext,
    id: string,
    token: string,
    now: string,
    until: string,
  ): Promise<boolean>;
  finish(
    ctx: TenantContext,
    id: string,
    token: string,
    state: InboxState,
    reason: TriageReason,
    uplinkId: string | null,
    siteId: string | null,
    now: string,
  ): Promise<boolean>;
  mappings(ctx: TenantContext, sourceId: string): Promise<ResourceMapping[]>;
  map(ctx: TenantContext, mapping: ResourceMapping): Promise<void>;
  resolve(
    ctx: TenantContext,
    sourceId: string,
    resourceId: string,
  ): Promise<{ uplinkId: string; siteId: string } | 'inactive' | null>;
}
export interface MonitoringSecrets {
  put(ref: string, value: SecretBinding): Promise<void>;
  get(ref: string): Promise<unknown>;
  remove(ref: string): Promise<void>;
}
export interface MonitoringCrypto {
  digest(value: string): string;
  equalSecret(expected: string, actual: string): boolean;
}
export interface MonitoringQueue {
  push(ctx: TenantContext, inboxId: string): Promise<void>;
}
export interface MonitoringDependencies {
  repository: MonitoringRepository;
  secrets: MonitoringSecrets;
  crypto: MonitoringCrypto;
  queue: MonitoringQueue;
  now(): string;
  id(): string;
  authorise(
    tenantId: unknown,
    permission: 'read' | 'configure',
  ): Promise<TenantContext>;
}
