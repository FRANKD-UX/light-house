import { useEffect, useRef, useState } from 'react';
import { invoke } from '@forge/bridge';
import {
  object,
  InventoryError,
  role,
  text,
  uuid,
  type Role,
} from '../../../src/domain/inventory/model';
import { NocBoard, incidentSlaStatus, useNocClock } from './NocBoard';
import { Operations } from './Operations';
import type { Priority } from '../../../src/domain/incidents/model';
import {
  BackendFailure,
  inventoryResponse,
  invocationFailure,
} from './invocation-error';
import {
  incidentMutation,
  incidentOverview,
  incidentPolicy,
  incidentRecovery,
  type IncidentOverview,
  type IncidentRecovery,
} from './incident-contract';
const priorities: readonly Priority[] = ['P1', 'P2', 'P3'];
function decoded<T>(read: () => T): T {
  try {
    return read();
  } catch (error) {
    if (error instanceof BackendFailure) throw error;
    throw new Error('INVALID_RESPONSE', { cause: error });
  }
}
export function Incidents() {
  const [tenants, setTenants] = useState<
      { id: string; name: string; role: Role }[]
    >([]),
    [tenant, setTenant] = useState(''),
    [memberRole, setRole] = useState<Role>('viewer');
  const [overview, setOverview] = useState<IncidentOverview>(),
    [selectedId, setSelected] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('Incidents not loaded.');
  const lock = useRef(false);
  const [recovery, setRecovery] = useState<IncidentRecovery>();
  const [inboxId, setInbox] = useState(''),
    [tierId, setTier] = useState(''),
    [from, setFrom] = useState(''),
    [until, setUntil] = useState(''),
    [policyVersion, setPolicyVersion] = useState('1'),
    [unknownImpact, setUnknownImpact] = useState('manual-review');
  const [severity, setSeverity] = useState<Record<string, string>>({}),
    [targets, setTargets] = useState<Record<string, string>>({});
  const [jsm, setJsm] = useState<Record<string, string>>({});
  const selected = overview?.incidents.find((i) => i.id === selectedId);
  const workspace = useRef<HTMLHeadingElement>(null);
  const now = useNocClock();
  const selectedOperation = overview?.operations.find(
    (op) => op.incidentId === selectedId,
  );
  useEffect(() => {
    if (selectedId && selected) workspace.current?.focus();
  }, [selectedId, selected]);
  async function run(work: () => Promise<string | void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setOverview(undefined);
    setMessage('Loading incidents…');
    try {
      setMessage((await work()) ?? 'Incidents loaded.');
    } catch (error) {
      setMessage(
        error instanceof BackendFailure
          ? `Incidents ${error.code}. ${error.code === 'CONFLICT' ? 'Reload before retrying.' : error.code === 'NOT_READY' ? 'Complete authorised incident schema and configuration setup.' : 'Check permissions and persisted state before retrying.'} Correlation ID: ${error.correlationId ?? 'unavailable'}.`
          : error instanceof Error && error.message === 'INVALID_RESPONSE'
            ? 'Incident response contract failed. No result accepted.'
            : error instanceof InventoryError
              ? 'Incident input invalid. Check fields before retrying.'
              : invocationFailure(error),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function request(action: string, extra: Record<string, unknown> = {}) {
    const response: unknown = await invoke('incidents', {
      action,
      tenantId: tenant,
      ...extra,
    });
    return decoded(() => {
      const envelope = object(response);
      uuid(envelope.correlationId);
      return {
        value: inventoryResponse(response),
        correlationId: uuid(envelope.correlationId),
      };
    });
  }
  async function load(after = '') {
    const r = await request('overview', { after });
    setOverview(decoded(() => incidentOverview(r.value, tenant)));
    return `Incidents loaded. Correlation ID: ${r.correlationId}.`;
  }
  async function mutate(action: string, extra: Record<string, unknown> = {}) {
    const r = await request(action, extra);
    return `${decoded(() => incidentMutation(action, r.value, tenant))} Correlation ID: ${r.correlationId}.`;
  }
  async function recover(after = '') {
    setRecovery(undefined);
    const response = await request('recover', { after });
    const result = decoded(() => incidentRecovery(response.value));
    setRecovery(result);
    return `Recovery examined ${result.examined} ready receipts. Inspect each outcome. Correlation ID: ${response.correlationId}.`;
  }
  const jsmLink = overview?.jsmLinks.find(
    (link) => link.incidentId === selectedId,
  );
  return (
    <section aria-labelledby="incidents-heading">
      <h2 id="incidents-heading">Incident workspace</h2>
      <p>
        Enriched monitoring incidents and immutable operational SLA snapshots.
        Monitoring recovery is evidence; restoration validation and guarded
        closure remain separate.
      </p>
      <button
        disabled={busy}
        onClick={() =>
          void run(async () => {
            setTenant('');
            setRole('viewer');
            setTenants([]);
            setSelected('');
            setRecovery(undefined);
            const response: unknown = await invoke('inventory', {
              action: 'overview',
            });
            decoded(() => {
              const value = object(inventoryResponse(response));
              if (!Array.isArray(value.tenants))
                throw new Error('INVALID_RESPONSE');
              setTenants(
                value.tenants.map((input: unknown) => {
                  const t = object(input);
                  return {
                    id: uuid(t.tenantId),
                    name: text(t.name),
                    role: role(t.role),
                  };
                }),
              );
              setTenant('');
              setRole('viewer');
              setSelected('');
            });
            return 'Choose an authorised incident tenant.';
          })
        }
      >
        Load incident tenants
      </button>
      <label>
        Incident tenant
        <select
          disabled={busy}
          value={tenant}
          onChange={(e) => {
            setTenant(e.target.value);
            setRole(
              tenants.find((t) => t.id === e.target.value)?.role ?? 'viewer',
            );
            setOverview(undefined);
            setSelected('');
            setInbox('');
            setRecovery(undefined);
            setTier('');
            setFrom('');
            setUntil('');
            setPolicyVersion('1');
            setUnknownImpact('manual-review');
            setSeverity({});
            setTargets({});
            setJsm({});
            setMessage('Load incidents for the selected tenant.');
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
        Load incidents
      </button>
      <p role="status" aria-label="Incident status" aria-live="polite">
        {message}
      </p>
      {tenant && memberRole === 'admin' && (
        <fieldset disabled={busy}>
          <legend>Incident administration</legend>
          <p>
            Schema setup adds incident and JSM persistence after monitoring v002
            readiness. Queued work must complete before reads succeed. Hosted
            writes require the approved target, usage and pending-state
            prerequisites.
          </p>
          <button onClick={() => void run(() => mutate('migrate'))}>
            Queue incident schema setup
          </button>
          <p>
            Scan stored ready receipts to resume enrichment and Jira creation.
            Existing incidents and SLA decisions are retained. Configuration
            gaps and individual failures remain visible; this does not poll.
          </p>
          <button onClick={() => void run(() => recover())}>
            Scan up to 20 ready receipts
          </button>
          <button
            disabled={!recovery?.next}
            onClick={() => void run(() => recover(recovery!.next!))}
          >
            Next recovery page
          </button>
          {recovery && (
            <ul aria-label="Receipt recovery outcomes">
              {recovery.results.map((row) => (
                <li key={row.inboxId}>
                  Receipt {row.inboxId}: {row.status}
                  {row.code ? ` (${row.code})` : ''}
                  {row.incidentId ? `; incident ${row.incidentId}` : ''}.
                </li>
              ))}
            </ul>
          )}
          <label>
            Ready monitoring receipt ID
            <input value={inboxId} onChange={(e) => setInbox(e.target.value)} />
          </label>
          <button
            disabled={!inboxId}
            onClick={() =>
              void run(() => mutate('process', { inboxId: uuid(inboxId) }))
            }
          >
            Enrich monitoring receipt
          </button>
          <details>
            <summary>Publish operational SLA policy</summary>
            <p>
              Configure each ISP explicitly. This is a proposed elapsed UTC
              clock, separate from native JSM calendars. Published policies do
              not rewrite historical incident deadlines. Times use
              YYYY-MM-DDTHH:mm:ss.sssZ.
            </p>
            <label>
              SLA tier ID
              <input value={tierId} onChange={(e) => setTier(e.target.value)} />
            </label>
            <label>
              Policy version
              <input
                type="number"
                min="1"
                value={policyVersion}
                onChange={(e) => setPolicyVersion(e.target.value)}
              />
            </label>
            <label>
              Effective from UTC
              <input value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              Effective until UTC (optional)
              <input value={until} onChange={(e) => setUntil(e.target.value)} />
            </label>
            <label>
              Unknown impact policy
              <select
                value={unknownImpact}
                onChange={(e) => setUnknownImpact(e.target.value)}
              >
                <option value="manual-review">Manual review</option>
                {priorities.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            {[0, 1, 2, 3, 4, 5].map((s) => (
              <label key={s}>
                Severity {s} priority
                <select
                  value={severity[String(s)] ?? ''}
                  onChange={(e) =>
                    setSeverity({ ...severity, [s]: e.target.value })
                  }
                >
                  <option value="">Unmapped — manual triage</option>
                  {priorities.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {priorities.map((p) => (
              <fieldset key={p}>
                <legend>{p} target</legend>
                <label>
                  {p} deadline seconds
                  <input
                    type="number"
                    min="1"
                    value={targets[p + 'duration'] ?? ''}
                    onChange={(e) =>
                      setTargets({
                        ...targets,
                        [p + 'duration']: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  {p} warning seconds after start
                  <input
                    type="number"
                    min="0"
                    value={targets[p + 'warning'] ?? ''}
                    onChange={(e) =>
                      setTargets({
                        ...targets,
                        [p + 'warning']: e.target.value,
                      })
                    }
                  />
                </label>
              </fieldset>
            ))}
            <button
              onClick={() =>
                void run(async () => {
                  if (
                    priorities.some(
                      (p) =>
                        !targets[p + 'duration'] ||
                        targets[p + 'warning'] === undefined ||
                        targets[p + 'warning'] === '',
                    )
                  )
                    throw new Error('INVALID_RESPONSE');
                  const target = (p: Priority) => ({
                    durationSeconds: Number(targets[p + 'duration']),
                    warningSeconds: Number(targets[p + 'warning']),
                  });
                  const policy = incidentPolicy(
                    {
                      id: globalThis.crypto.randomUUID(),
                      tenantId: tenant,
                      tierId,
                      version: Number(policyVersion),
                      status: 'published',
                      effectiveFrom: from,
                      effectiveUntil: until || null,
                      clock: 'elapsed-utc',
                      severityMap: Object.fromEntries(
                        Object.entries(severity).filter(([, value]) => value),
                      ),
                      unknownImpact,
                      targets: {
                        P1: target('P1'),
                        P2: target('P2'),
                        P3: target('P3'),
                      },
                    },
                    tenant,
                  );
                  return mutate('publishPolicy', {
                    policy,
                    expected: policy.version - 1,
                  });
                })
              }
            >
              Publish operational policy
            </button>
          </details>
          <details>
            <summary>Configure Jira Service Management</summary>
            <p>
              Use reviewed synthetic service desk/request type and explicit
              field mappings. Existing Jira permissions and request metadata are
              checked server-side; this form does not grant permissions or
              create a request.
            </p>
            {[
              'Project ID',
              'Service desk ID',
              'Request type ID',
              'Marker field ID',
              'Deadline field ID',
              'Warning field ID',
              'Policy field ID',
              'P1 priority ID',
              'P2 priority ID',
              'P3 priority ID',
              'Expected configuration version',
            ].map((label) => (
              <label key={label}>
                {label}
                <input
                  value={jsm[label] ?? ''}
                  onChange={(e) => setJsm({ ...jsm, [label]: e.target.value })}
                />
              </label>
            ))}
            <button
              onClick={() =>
                void run(() => {
                  const expected = Number(
                    jsm['Expected configuration version'],
                  );
                  if (
                    !Number.isSafeInteger(expected) ||
                    expected < 0 ||
                    jsm['Expected configuration version'] === ''
                  )
                    throw new Error('INVALID_RESPONSE');
                  return mutate('configureJsm', {
                    configuration: {
                      version: expected + 1,
                      projectId: jsm['Project ID'],
                      serviceDeskId: jsm['Service desk ID'],
                      requestTypeId: jsm['Request type ID'],
                      fields: {
                        marker: jsm['Marker field ID'],
                        deadline: jsm['Deadline field ID'],
                        warning: jsm['Warning field ID'],
                        policy: jsm['Policy field ID'],
                      },
                      priorityIds: {
                        P1: jsm['P1 priority ID'],
                        P2: jsm['P2 priority ID'],
                        P3: jsm['P3 priority ID'],
                      },
                    },
                    expected,
                  });
                })
              }
            >
              Save JSM configuration
            </button>
          </details>
        </fieldset>
      )}
      {overview && (
        <>
          <p>
            Displayed incidents: {overview.incidents.length}. Operational
            policies: {overview.policies.length}. Counts describe this page.
          </p>
          <details>
            <summary>Published operational policies</summary>
            {overview.policies.length === 0 ? (
              <p>No operational policies returned.</p>
            ) : (
              <ul aria-label="Operational policies">
                {overview.policies.map((policy) => (
                  <li key={policy.id}>
                    Policy {policy.id}; tier {policy.tierId}; version{' '}
                    {policy.version}; effective {policy.effectiveFrom} until{' '}
                    {policy.effectiveUntil ?? 'no end'}; unknown impact{' '}
                    {policy.unknownImpact}.{' '}
                    {priorities
                      .map(
                        (priority) =>
                          `${priority}: deadline ${policy.targets[priority].durationSeconds}s / warning ${policy.targets[priority].warningSeconds}s`,
                      )
                      .join('; ')}
                    . Severity map:{' '}
                    {Object.entries(policy.severityMap)
                      .map(
                        ([severity, priority]) => `${severity} → ${priority}`,
                      )
                      .join(', ') || 'unmapped'}
                    .
                  </li>
                ))}
              </ul>
            )}
          </details>
          <NocBoard
            incidents={overview.incidents}
            operations={overview.operations}
            operationsReady={overview.operationsReady}
            selectedId={selectedId}
            onSelect={setSelected}
            now={now}
            busy={busy}
          />
          <button
            disabled={busy || !overview.next}
            onClick={() => void run(() => load(overview.next!))}
          >
            Next incident page
          </button>
          {selected && (
            <article id="incident-workspace" aria-labelledby="incident-detail">
              <h3 id="incident-detail" tabIndex={-1} ref={workspace}>
                Incident {selected.id}
              </h3>
              <button
                onClick={() => {
                  setSelected('');
                  (
                    document.getElementById('incident-select-' + selected.id) ??
                    document.getElementById('noc-board-heading')
                  )?.focus();
                }}
              >
                Collapse incident workspace
              </button>
              <dl>
                <dt>Creation snapshot</dt>
                <dd>{selected.state}</dd>
                <dt>Current operational stage</dt>
                <dd>
                  {selectedOperation?.state ??
                    (overview.operationsReady
                      ? 'Not initialised'
                      : 'Operational state not verified')}
                </dd>
                <dt>Current accountable team / engineer</dt>
                <dd>
                  {selectedOperation
                    ? `${selectedOperation.ownerTeamId} / ${selectedOperation.ownerAssigneeId ?? 'Awaiting acknowledgement'}`
                    : 'Not returned'}
                </dd>
                <dt>Source problem</dt>
                <dd>{selected.problemEventId}</dd>
                <dt>Original occurrence UTC</dt>
                <dd>{selected.occurredAt}</dd>
                <dt>Site / uplink / carrier</dt>
                <dd>
                  {selected.impact.siteId} / {selected.impact.uplinkId} /{' '}
                  {selected.impact.carrierId}
                </dd>
                <dt>Impact</dt>
                <dd>
                  {selected.impact.confidence}: {selected.impact.reason};{' '}
                  {selected.impact.affectedCustomerIds.length} confirmed
                  customers, {selected.impact.affectedServiceIds.length}{' '}
                  affected services,{' '}
                  {selected.impact.protectedServiceIds.length} protected
                  services, {selected.impact.uncertainServiceIds.length}{' '}
                  uncertain services;{' '}
                  {selected.impact.potentiallyAffectedCustomerIds.length}{' '}
                  potentially affected customers and{' '}
                  {selected.impact.potentiallyAffectedServiceIds.length}{' '}
                  potentially affected services
                </dd>
                <dt>JSM integration</dt>
                <dd>
                  {jsmLink
                    ? `${jsmLink.state}${jsmLink.issueKey ? `: ${jsmLink.issueKey}` : ' — identity not confirmed'}`
                    : 'No mapped JSM identity returned.'}
                </dd>
                <dt>Correlation ID</dt>
                <dd>{selected.correlationId}</dd>
              </dl>
              {selected.sla.kind === 'selected' ? (
                <dl>
                  <dt>Priority</dt>
                  <dd>{selected.sla.snapshot.priority}</dd>
                  <dt>Operational clock</dt>
                  <dd>Elapsed UTC; {selected.sla.snapshot.reason}</dd>
                  <dt>Policy snapshot</dt>
                  <dd>
                    {selected.sla.snapshot.policyId} version{' '}
                    {selected.sla.snapshot.policyVersion}
                  </dd>
                  <dt>SLA start UTC</dt>
                  <dd>{selected.sla.snapshot.startedAt}</dd>
                  <dt>Warning UTC</dt>
                  <dd>{selected.sla.snapshot.warningAt}</dd>
                  <dt>Deadline UTC</dt>
                  <dd>{selected.sla.snapshot.deadlineAt}</dd>
                  <dt>SLA status at {now}</dt>
                  <dd>
                    {overview.operationsReady
                      ? incidentSlaStatus(selected, selectedOperation, now)
                      : 'Operational SLA unverified'}
                    {selectedOperation?.resolvedAt
                      ? ` (confirmed resolution UTC ${selectedOperation.resolvedAt})`
                      : ' (resolution not confirmed in this overview)'}
                  </dd>
                </dl>
              ) : (
                <p>
                  Manual triage required: {selected.sla.reason}. Original outage
                  time is retained.
                </p>
              )}
              {memberRole === 'admin' && (
                <button
                  disabled={busy || selected.sla.kind !== 'selected'}
                  onClick={() =>
                    void run(() =>
                      mutate('createJsm', { incidentId: selected.id }),
                    )
                  }
                >
                  Create or reconcile JSM incident
                </button>
              )}
              <p>
                Changing ownership must preserve this SLA snapshot. Native JSM
                metrics and delivery are separate acceptance requirements.
              </p>
              <Operations
                key={`${tenant}:${selected.id}`}
                tenantId={tenant}
                incidentId={selected.id}
                role={memberRole}
              />
            </article>
          )}
        </>
      )}
    </section>
  );
}
