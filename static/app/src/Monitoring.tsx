import { useRef, useState } from 'react';
import { invoke } from '@forge/bridge';
import {
  object,
  text,
  uuid,
  role,
  type Role,
} from '../../../src/domain/inventory/model';
import {
  BackendFailure,
  inventoryResponse,
  invocationFailure,
} from './invocation-error';
import {
  monitoringOverview,
  monitoringMutation,
  type MonitoringOverview,
} from './monitoring-contract';
export function Monitoring() {
  const [tenants, setTenants] = useState<
    { id: string; name: string; role: Role }[]
  >([]);
  const [tenant, setTenant] = useState('');
  const [roleValue, setRole] = useState<Role>('viewer');
  const [overview, setOverview] = useState<MonitoringOverview>();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState('Monitoring not loaded.');
  const [name, setName] = useState('Synthetic Zabbix');
  const [token, setToken] = useState('');
  const [sourceId, setSource] = useState('');
  const [overlap, setOverlap] = useState('0');
  const [resource, setResource] = useState('');
  const [uplink, setUplink] = useState('');
  const [cursor, setCursor] = useState('');
  const [sourceCursor, setSourceCursor] = useState('');
  const selected = overview?.sources.find((s) => s.id === sourceId);
  async function run(work: () => Promise<string | void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage('Loading monitoring…');
    try {
      setMessage((await work()) ?? 'Monitoring loaded.');
    } catch (error) {
      setOverview(undefined);
      setMessage(
        error instanceof BackendFailure
          ? `Monitoring ${error.code}. ${error.code === 'CONFLICT' ? 'Reload before retrying.' : error.code === 'NOT_READY' ? 'An administrator must complete monitoring schema setup.' : 'Check permissions, fields and persisted receipts before retrying.'} Correlation ID: ${error.correlationId ?? 'unavailable'}.`
          : error instanceof Error && error.message === 'INVALID_RESPONSE'
            ? 'Monitoring response contract failed. No result accepted.'
            : invocationFailure(error),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function request(action: string, extra: Record<string, unknown> = {}) {
    const response: unknown = await invoke('monitoring', {
      action,
      tenantId: tenant,
      ...extra,
    });
    const envelope = object(response);
    uuid(envelope.correlationId);
    return {
      value: inventoryResponse(response),
      correlationId: uuid(envelope.correlationId),
    };
  }
  async function load(after = '', sourceAfter = '') {
    setOverview(undefined);
    const r = await request('overview', { after, sourceAfter });
    setOverview(monitoringOverview(r.value));
    setCursor(after);
    setSourceCursor(sourceAfter);
    return `Monitoring loaded. Correlation ID: ${r.correlationId}.`;
  }
  async function mutate(action: string, extra: Record<string, unknown> = {}) {
    const r = await request(action, extra);
    setOverview(undefined);
    return `${monitoringMutation(action, r.value)} Correlation ID: ${r.correlationId}.`;
  }
  return (
    <section aria-labelledby="monitoring-heading">
      <h2 id="monitoring-heading">Monitoring — automated Border Control</h2>
      <p>
        Synthetic development events. A ready event has passed intake and
        resource mapping; it has not created an incident or executed an SLA.
      </p>
      <button
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const response: unknown = await invoke('inventory', {
              action: 'overview',
            });
            const v = object(inventoryResponse(response));
            if (!Array.isArray(v.tenants)) throw new Error('INVALID_RESPONSE');
            setTenants(
              v.tenants.map((x: unknown) => {
                const t = object(x);
                return {
                  id: uuid(t.tenantId),
                  name: text(t.name),
                  role: role(t.role),
                };
              }),
            );
            setOverview(undefined);
            setTenant('');
            setSource('');
            setToken('');
            return 'Choose an authorised monitoring tenant.';
          })
        }
      >
        Load monitoring tenants
      </button>
      <label>
        Monitoring tenant
        <select
          disabled={busy}
          value={tenant}
          onChange={(e) => {
            setTenant(e.target.value);
            setRole(
              tenants.find((t) => t.id === e.target.value)?.role ?? 'viewer',
            );
            setOverview(undefined);
            setSource('');
            setToken('');
            setCursor('');
            setSourceCursor('');
            setMessage('Load monitoring for the selected tenant.');
          }}
        >
          <option value="">Select tenant</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.role})
            </option>
          ))}
        </select>
      </label>
      <button disabled={busy || !tenant} onClick={() => void run(() => load())}>
        Load monitoring
      </button>
      <p role="status" aria-label="Monitoring status" aria-live="polite">
        {message}
      </p>
      <p>
        Unknown mappings are quarantined for manual triage. Missing, wrong and
        revoked credentials are rejected before tenant attribution; those
        failures appear only in sanitised hosted logs. This view shows the
        latest 20 authenticated outcomes and a page of durable receipts.
      </p>
      {tenant && roleValue === 'admin' && (
        <fieldset disabled={busy}>
          <legend>Monitoring administration</legend>
          <button onClick={() => void run(() => mutate('migrate'))}>
            Queue monitoring schema setup
          </button>
          <button onClick={() => void run(() => mutate('recover'))}>
            Recover up to 20 interrupted events
          </button>
          <button onClick={() => void run(() => mutate('cleanup'))}>
            Clean up to 20 inactive credentials
          </button>
          <label>
            Monitoring source
            <select
              value={sourceId}
              onChange={(e) => {
                setSource(e.target.value);
                setToken('');
              }}
            >
              <option value="">Create new source</option>
              {overview?.sources.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name} ({s.status}, v{s.version})
                </option>
              ))}
            </select>
          </label>
          {!sourceId && (
            <label>
              Source name
              <input
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          <label>
            New source secret
            <input
              type="password"
              autoComplete="new-password"
              value={token}
              maxLength={128}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
          <p>
            Supply a privately generated random base64url secret of at least 32
            bytes. It is sent once to the backend secret store and never
            returned.
          </p>
          {sourceId && (
            <label>
              Rotation overlap seconds
              <input
                value={overlap}
                type="number"
                min="0"
                max="86400"
                onChange={(e) => setOverlap(e.target.value)}
              />
            </label>
          )}
          <button
            disabled={
              !token ||
              Boolean(sourceId && !selected) ||
              selected?.status === 'disabled'
            }
            onClick={() => {
              const supplied = token;
              setToken('');
              void run(() =>
                mutate(
                  'configure',
                  sourceId
                    ? {
                        sourceId,
                        expected: selected?.version,
                        secret: supplied,
                        overlapSeconds: Number(overlap),
                      }
                    : { name, secret: supplied },
                ),
              );
            }}
          >
            {sourceId ? 'Rotate source credential' : 'Create monitoring source'}
          </button>
          <button
            disabled={!selected || selected.status === 'disabled'}
            onClick={() =>
              void run(() =>
                mutate('revoke', { sourceId, expected: selected?.version }),
              )
            }
          >
            Revoke monitoring source
          </button>
          <label>
            External resource ID
            <input
              value={resource}
              maxLength={128}
              onChange={(e) => setResource(e.target.value)}
            />
          </label>
          <label>
            Same-tenant uplink ID
            <input value={uplink} onChange={(e) => setUplink(e.target.value)} />
          </label>
          <button
            disabled={
              !selected || selected.status !== 'active' || !resource || !uplink
            }
            onClick={() =>
              void run(() =>
                mutate('map', {
                  sourceId,
                  externalResourceId: resource,
                  uplinkId: uplink,
                }),
              )
            }
          >
            Add resource mapping
          </button>
        </fieldset>
      )}
      {overview && (
        <>
          <h3>Configured monitoring sources</h3>
          {!overview.sources.length && <p>No sources on this page.</p>}
          <ul>
            {overview.sources.map((s) => (
              <li key={s.id}>
                {s.name} — {s.status}, version {s.version}. Source {s.id}; key
                ID {s.keyId ?? 'none'}; previous key valid until{' '}
                {s.previousValidUntil ?? 'none'}.
              </li>
            ))}
          </ul>
          <button
            disabled={busy || !overview.sourceNext}
            onClick={() => void run(() => load(cursor, overview.sourceNext!))}
          >
            Next source page
          </button>
          <h3>Authenticated intake outcomes</h3>
          <ul>
            {overview.observations.map((o) => (
              <li key={o.correlationId}>
                {o.receivedAt}: {o.result}; source {o.sourceId}; correlation{' '}
                {o.correlationId}.{' '}
                {o.result === 'invalid'
                  ? 'Check the v1 payload, replay timestamps and event type.'
                  : o.result === 'conflict'
                    ? 'Existing event identity has different content; use the correct source event identity.'
                    : o.result === 'unavailable'
                      ? 'Inspect the durable receipt before bounded recovery.'
                      : ''}
              </li>
            ))}
          </ul>
          <h3>Received synthetic events</h3>
          {!overview.receipts.length && <p>No events on this page.</p>}
          <ul>
            {overview.receipts.map((r) => (
              <li key={r.id}>
                Event {r.externalEventId} ({r.kind}); resource {r.resourceId};
                occurred {r.occurredAt}; received {r.receivedAt}. Status{' '}
                {r.status}; reason {r.reason ?? 'none'}; attempts {r.attempts};
                duplicates {r.duplicates}. Receipt {r.id}; correlation{' '}
                {r.correlationId}.{' '}
                {r.reason === 'UNKNOWN_MAPPING'
                  ? 'Add a same-tenant mapping, then retry this receipt.'
                  : r.reason === 'RETRY_EXHAUSTED'
                    ? 'Retry limit reached. Investigate before any separately reviewed recovery.'
                    : r.reason === 'SOURCE_DISABLED'
                      ? 'Source is disabled; review source authorisation.'
                      : ''}
                {roleValue === 'admin' &&
                  r.status !== 'ready' &&
                  r.reason !== 'RETRY_EXHAUSTED' && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(() => mutate('retry', { inboxId: r.id }))
                      }
                    >
                      Retry receipt {r.id}
                    </button>
                  )}
              </li>
            ))}
          </ul>
          <button
            disabled={busy || !overview.next}
            onClick={() => void run(() => load(overview.next!, sourceCursor))}
          >
            Next event page
          </button>
        </>
      )}
    </section>
  );
}
