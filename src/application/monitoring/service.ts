import {
  InventoryError,
  integer,
  object,
  text,
  utc,
  uuid,
} from '../../domain/inventory/model';
import type {
  InboxRecord,
  IntakeEvent,
  MonitoringSource,
  IngressOutput,
  PublicReceipt,
  PublicSource,
  SecretBinding,
  MonitoringObservation,
} from '../../domain/monitoring/model';
import type { MonitoringDependencies } from './ports';
import type { TenantContext } from '../ports/tenant-context';
import type { MonitoringAdapter } from '../ports/monitoring-adapter';

function header(headers: unknown, name: string): string {
  const found = Object.entries(object(headers)).filter(
    ([key]) => key.toLowerCase() === name,
  );
  if (found.length !== 1) throw new InventoryError('DENIED');
  const value = found[0]![1];
  if (
    !Array.isArray(value) ||
    value.length !== 1 ||
    typeof value[0] !== 'string'
  )
    throw new InventoryError('DENIED');
  return value[0];
}
function secret(value: unknown): string {
  const token = text(value, 128);
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(token))
    throw new InventoryError('INVALID');
  return token;
}
function binding(
  value: unknown,
  installationId: string,
  tenantId: string,
  sourceId: string,
  keyId: string,
): SecretBinding {
  const v = object(value);
  if (
    v.installationId !== installationId ||
    v.tenantId !== tenantId ||
    v.sourceId !== sourceId ||
    v.keyId !== keyId
  )
    throw new InventoryError('DENIED');
  return {
    secret: secret(v.secret),
    installationId,
    tenantId,
    sourceId,
    keyId,
  };
}
export class MonitoringService {
  constructor(
    readonly deps: MonitoringDependencies,
    readonly installationId: string,
    readonly adapter: MonitoringAdapter,
  ) {}
  async receive(input: unknown, correlationId: string): Promise<IngressOutput> {
    let authenticated: { ctx: TenantContext; sourceId: string } | undefined;
    const result = await this.intake(input, correlationId, (ctx, sourceId) => {
      authenticated = { ctx, sourceId };
    });
    if (authenticated) {
      try {
        await this.deps.repository.observe(authenticated.ctx, {
          correlationId,
          sourceId: authenticated.sourceId,
          receivedAt: this.deps.now(),
          result,
        });
      } catch {
        return 'unavailable';
      } // Durable inbox remains replay-safe if diagnostic persistence failed.
    }
    return result;
  }
  private async intake(
    input: unknown,
    correlationId: string,
    authenticated: (ctx: TenantContext, sourceId: string) => void,
  ): Promise<IngressOutput> {
    try {
      const request = object(input);
      if (request.method !== 'POST') return 'method';
      if (request.userPath && request.userPath !== '/') return 'invalid';
      if (
        request.queryParameters &&
        Object.keys(object(request.queryParameters)).length
      )
        return 'invalid';
      if (typeof request.body !== 'string') return 'invalid';
      if (new TextEncoder().encode(request.body).length > 65_536)
        return 'too_large';
      let keyId: string, token: string;
      try {
        keyId = uuid(header(request.headers, 'x-light-house-key-id'));
        const auth = header(request.headers, 'authorization');
        if (!auth.startsWith('Bearer ')) return 'unauthorised';
        token = secret(auth.slice(7));
      } catch {
        return 'unauthorised';
      }
      const now = this.deps.now();
      const ref = await this.deps.repository.lookupCredential(
        this.installationId,
        keyId,
        now,
      );
      if (!ref) return 'unauthorised';
      let stored: SecretBinding;
      const material = await this.deps.secrets.get(ref.secret_ref);
      try {
        stored = binding(
          material,
          this.installationId,
          ref.tenant_id,
          ref.source_id,
          keyId,
        );
      } catch {
        return 'unauthorised';
      }
      if (!this.deps.crypto.equalSecret(stored.secret, token))
        return 'unauthorised';
      if (!(await this.deps.repository.ready(this.installationId)))
        return 'unavailable';
      const ctx: TenantContext = {
        installationId: this.installationId,
        tenantId: ref.tenant_id,
        actor: { kind: 'monitoring-source', sourceId: ref.source_id },
      };
      if (!(await this.deps.repository.admit(ctx, ref.source_id, keyId, now)))
        return 'rate_limited';
      authenticated(ctx, ref.source_id);
      let sent: string;
      try {
        sent = utc(header(request.headers, 'x-light-house-sent-at'));
      } catch {
        return 'invalid';
      }
      const age = Date.parse(now) - Date.parse(sent);
      if (age > 300_000 || age < -60_000) return 'invalid';
      let contentType: string;
      try {
        contentType = header(request.headers, 'content-type');
      } catch {
        return 'invalid';
      }
      if (!/^application\/json(?:;\s*charset=utf-8)?$/i.test(contentType))
        return 'invalid';
      let payload: unknown;
      try {
        payload = JSON.parse(request.body);
      } catch {
        return 'invalid';
      }
      const normal = this.adapter.validateAndNormalise(
        payload,
        ctx,
        correlationId,
      );
      if (!normal.ok) return 'invalid';
      const event = normal.value;
      const eventAge = Date.parse(now) - Date.parse(event.occurredAt);
      if (eventAge < -60_000 || eventAge > 7 * 86_400_000) return 'invalid';
      const eventJson = JSON.stringify(event);
      const row: InboxRecord = {
        id: this.deps.id(),
        tenant_id: ctx.tenantId,
        installation_id: ctx.installationId,
        source_id: ref.source_id,
        correlation_id: correlationId,
        duplicate_count: 0,
        dedupe_key: this.deps.crypto.digest(
          JSON.stringify([
            ctx.tenantId,
            ref.source_id,
            event.externalEventId,
            event.kind,
          ]),
        ),
        fingerprint: this.deps.crypto.digest(eventJson),
        event_json: eventJson,
        status: 'received',
        reason: 'DISPATCH_PENDING',
        received_at: now,
        updated_at: now,
        attempts: 0,
        dispatches: 0,
        version: 1,
        lease_token: null,
        lease_until: null,
        uplink_id: null,
        site_id: null,
      };
      const saved = await this.deps.repository.putInbox(ctx, row);
      if (saved.fingerprint !== row.fingerprint) return 'conflict';
      if (saved.id !== row.id)
        await this.deps.repository.duplicate(ctx, saved.id);
      if (
        saved.status === 'ready' ||
        saved.status === 'manual_triage' ||
        (saved.status === 'processing' &&
          saved.lease_until !== null &&
          saved.lease_until > now)
      )
        return 'accepted';
      return (await this.dispatch(ctx, saved.id)) ? 'accepted' : 'unavailable';
    } catch (error) {
      return error instanceof InventoryError && error.code === 'CONFLICT'
        ? 'conflict'
        : 'unavailable';
    }
  }
  async dispatch(ctx: TenantContext, id: string): Promise<boolean> {
    const reserved = await this.deps.repository.reserveDispatch(
      ctx,
      id,
      this.deps.now(),
    );
    if (!reserved) {
      const row = await this.deps.repository.inbox(ctx, id);
      return (
        row?.status === 'queued' ||
        row?.status === 'processing' ||
        row?.status === 'ready' ||
        row?.status === 'manual_triage'
      );
    }
    try {
      await this.deps.queue.push(ctx, id);
      await this.deps.repository.markQueued(ctx, id, this.deps.now());
      return true;
    } catch {
      return false;
    } // Durable received row remains visible; no false successful dispatch.
  }
  async process(ctx: TenantContext, inboxId: string): Promise<void | 'busy'> {
    const row = await this.deps.repository.inbox(ctx, inboxId);
    if (!row || row.status === 'ready' || row.status === 'manual_triage')
      return;
    const token = this.deps.id();
    const now = this.deps.now();
    if (
      !(await this.deps.repository.claim(
        ctx,
        inboxId,
        token,
        now,
        new Date(Date.parse(now) + 60_000).toISOString(),
      ))
    )
      return 'busy' as const;
    try {
      const source = await this.deps.repository.source(ctx, row.source_id);
      if (!source || source.status !== 'active') {
        await this.deps.repository.finish(
          ctx,
          inboxId,
          token,
          'manual_triage',
          'SOURCE_DISABLED',
          null,
          null,
          this.deps.now(),
        );
        return;
      }
      const event = object(JSON.parse(row.event_json));
      const resolved = await this.deps.repository.resolve(
        ctx,
        row.source_id,
        text(event.resourceId, 128),
      );
      await this.deps.repository.finish(
        ctx,
        inboxId,
        token,
        resolved && resolved !== 'inactive' ? 'ready' : 'manual_triage',
        resolved === 'inactive'
          ? 'INACTIVE_RESOURCE'
          : resolved
            ? null
            : 'UNKNOWN_MAPPING',
        resolved && resolved !== 'inactive' ? resolved.uplinkId : null,
        resolved && resolved !== 'inactive' ? resolved.siteId : null,
        this.deps.now(),
      );
    } catch {
      await this.deps.repository.finish(
        ctx,
        inboxId,
        token,
        row.attempts + 1 >= 5 ? 'manual_triage' : 'retry_required',
        row.attempts + 1 >= 5 ? 'RETRY_EXHAUSTED' : 'PROCESSING_FAILED',
        null,
        null,
        this.deps.now(),
      );
      throw new InventoryError('UNAVAILABLE');
    }
  }
  async configure(input: unknown) {
    const data = object(input);
    const ctx = await this.deps.authorise(data.tenantId, 'configure');
    if (!(await this.deps.repository.ready(this.installationId)))
      throw new InventoryError('NOT_READY');
    const now = this.deps.now();
    const supplied = secret(data.secret);
    const sourceId =
      data.sourceId === undefined ? this.deps.id() : uuid(data.sourceId);
    const old =
      data.sourceId === undefined
        ? null
        : await this.deps.repository.source(ctx, sourceId);
    if (data.sourceId !== undefined && !old)
      throw new InventoryError('NOT_FOUND');
    const expected = old ? integer(data.expected) : 0;
    if (old && (old.version !== expected || old.status !== 'active'))
      throw new InventoryError('CONFLICT');
    if (old?.previous_key_id && old.previous_until && old.previous_until > now)
      throw new InventoryError('CONFLICT');
    const overlap = old ? integer(data.overlapSeconds, 86_400, 0) : 0;
    const sourceName = old?.name ?? text(data.name, 80);
    const keyId = this.deps.id();
    const ref = `light-house:source:${this.deps.crypto.digest(ctx.installationId).slice(0, 16)}:${ctx.tenantId}:${sourceId}:${keyId}`;
    // Material is never in SQL, public results or logs. Unlinked partial refs cannot authenticate.
    await this.deps.repository.credential({
      id: keyId,
      tenant_id: ctx.tenantId,
      installation_id: ctx.installationId,
      source_id: sourceId,
      secret_ref: ref,
      created_at: now,
    });
    await this.deps.secrets.put(ref, {
      secret: supplied,
      installationId: ctx.installationId,
      tenantId: ctx.tenantId,
      sourceId,
      keyId,
    });

    if (old) {
      if (
        !(await this.deps.repository.rotate(
          ctx,
          sourceId,
          expected,
          keyId,
          new Date(Date.parse(now) + overlap * 1000).toISOString(),
          now,
        ))
      )
        throw new InventoryError('CONFLICT');
      for (const prior of await this.deps.repository.references(ctx, sourceId))
        if (prior.id !== old.current_key_id && prior.id !== keyId)
          await this.deps.secrets.remove(prior.secret_ref);
    } else {
      await this.deps.repository.createSource(ctx, {
        id: sourceId,
        tenant_id: ctx.tenantId,
        installation_id: ctx.installationId,
        name: sourceName,
        source_type: 'zabbix',
        status: 'active',
        version: 1,
        current_key_id: keyId,
        previous_key_id: null,
        previous_until: null,
      });
    }
    return { sourceId, keyId, version: expected + 1 };
  }
  async revoke(input: unknown) {
    const data = object(input);
    const ctx = await this.deps.authorise(data.tenantId, 'configure');
    const id = uuid(data.sourceId);
    const old = await this.deps.repository.source(ctx, id);
    if (!old) throw new InventoryError('NOT_FOUND');
    if (
      old.status === 'active' &&
      !(await this.deps.repository.disable(
        ctx,
        id,
        integer(data.expected),
        this.deps.now(),
      ))
    )
      throw new InventoryError('CONFLICT');
    for (const ref of await this.deps.repository.references(ctx, id))
      await this.deps.secrets.remove(ref.secret_ref);
    return { disabled: true };
  }
  async map(input: unknown) {
    const data = object(input);
    const ctx = await this.deps.authorise(data.tenantId, 'configure');
    const sourceId = uuid(data.sourceId);
    if (!(await this.deps.repository.source(ctx, sourceId)))
      throw new InventoryError('NOT_FOUND');
    await this.deps.repository.map(ctx, {
      id: this.deps.id(),
      source_id: sourceId,
      external_resource_id: text(data.externalResourceId, 128),
      uplink_id: uuid(data.uplinkId),
      version: 1,
    });
    return { saved: true };
  }
  async retry(input: unknown) {
    const data = object(input);
    const ctx = await this.deps.authorise(data.tenantId, 'configure');
    const id = uuid(data.inboxId);
    const row = await this.deps.repository.inbox(ctx, id);
    if (!row) throw new InventoryError('NOT_FOUND');
    if (row.reason === 'RETRY_EXHAUSTED') throw new InventoryError('CONFLICT');
    if (!(await this.dispatch(ctx, id)))
      throw new InventoryError('UNAVAILABLE');
    return { dispatched: true };
  }
  async recover(input: unknown) {
    const data = object(input);
    const ctx = await this.deps.authorise(data.tenantId, 'configure');
    if (!(await this.deps.repository.ready(this.installationId)))
      throw new InventoryError('NOT_READY');
    const rows = await this.deps.repository.recoverable(ctx, this.deps.now());
    let dispatched = 0;
    for (const row of rows) if (await this.dispatch(ctx, row.id)) dispatched++;
    return { examined: rows.length, dispatched };
  }
  async cleanup(input: unknown) {
    const data = object(input);
    const ctx = await this.deps.authorise(data.tenantId, 'configure');
    const refs = await this.deps.repository.staleCredentials(
      ctx,
      this.deps.now(),
    );
    for (const ref of refs) {
      await this.deps.secrets.remove(ref.secret_ref);
      await this.deps.repository.removeReference(ctx, ref.id);
    }
    return { cleaned: refs.length };
  }
  async overview(input: unknown): Promise<{
    sources: PublicSource[];
    sourceNext: string | null;
    observations: MonitoringObservation[];
    receipts: PublicReceipt[];
    next: string | null;
  }> {
    const data = object(input);
    const ctx = await this.deps.authorise(data.tenantId, 'read');
    if (!(await this.deps.repository.ready(this.installationId)))
      throw new InventoryError('NOT_READY');
    const after =
      data.after === undefined || data.after === '' ? '' : uuid(data.after);
    const rows = await this.deps.repository.listInbox(ctx, after);
    const receipts = rows.slice(0, 20).map((row) => {
      const e = object(JSON.parse(row.event_json));
      return {
        correlationId: row.correlation_id,
        duplicates: row.duplicate_count,
        id: row.id,
        sourceId: row.source_id,
        externalEventId: text(e.externalEventId, 32),
        problemEventId: text(e.problemEventId, 32),
        kind: e.kind as IntakeEvent['kind'],
        resourceId: text(e.resourceId, 128),
        occurredAt: utc(e.occurredAt),
        receivedAt: row.received_at,
        status: row.status,
        reason: row.reason,
        attempts: row.attempts,
        version: row.version,
        uplinkId: row.uplink_id,
        siteId: row.site_id,
      };
    });
    const sourceAfter =
      data.sourceAfter === undefined || data.sourceAfter === ''
        ? ''
        : uuid(data.sourceAfter);
    const sources = await this.deps.repository.sources(ctx, sourceAfter);
    return {
      observations: await this.deps.repository.observations(ctx),
      sourceNext: sources.length > 50 ? sources[49]!.id : null,
      sources: sources.slice(0, 50).map((s: MonitoringSource) => ({
        id: s.id,
        name: s.name,
        sourceType: s.source_type,
        status: s.status,
        version: s.version,
        keyId: s.current_key_id,
        previousValidUntil: s.previous_until,
      })),
      receipts,
      next: rows.length > 20 ? receipts.at(-1)!.id : null,
    };
  }
}
