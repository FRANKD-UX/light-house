import { useEffect, useState } from 'react';
import { slaStatus } from '../../../src/domain/incidents/sla';
import type {
  PublicIncident,
  PublicOperationSummary,
} from './incident-contract';
export function useNocClock(): string {
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const timer = globalThis.setInterval(
      () => setNow(new Date().toISOString()),
      30_000,
    );
    return () => globalThis.clearInterval(timer);
  }, []);
  return now;
}
export type DisplaySla =
  'on-track' | 'warning' | 'breached' | 'blocked' | 'time-unverified';
export function incidentSlaStatus(
  incident: PublicIncident,
  operation: PublicOperationSummary | undefined,
  now: string,
): DisplaySla {
  if (incident.sla.kind !== 'selected') return 'blocked';
  if (
    now < incident.sla.snapshot.startedAt ||
    (operation?.resolvedAt &&
      (operation.resolvedAt > now ||
        operation.resolvedAt < incident.sla.snapshot.startedAt))
  )
    return 'time-unverified';
  return slaStatus(incident.sla.snapshot, now, operation?.resolvedAt ?? null);
}
const stageLabels = {
  new: 'Awaiting acknowledgement',
  acknowledged: 'Acknowledged',
  triage: 'NOC triage',
  in_progress: 'In progress',
  restoration_validation: 'Restoration validation',
  resolved: 'Resolved',
  closed: 'Closed',
};
export function NocBoard({
  incidents,
  operations,
  operationsReady,
  selectedId,
  onSelect,
  now,
  busy = false,
}: {
  incidents: readonly PublicIncident[];
  operations: readonly PublicOperationSummary[];
  operationsReady: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  now: string;
  busy?: boolean;
}) {
  const [stage, setStage] = useState('all'),
    [slaFilter, setSlaFilter] = useState('all'),
    [query, setQuery] = useState('');
  const summaries = new Map(
    operationsReady ? operations.map((op) => [op.incidentId, op]) : [],
  );
  const rows = incidents.map((incident) => {
    const operation = summaries.get(incident.id);
    return {
      incident,
      operation,
      stage:
        operation?.state ??
        (operationsReady ? 'not-initialised' : 'unverified'),
      sla: incidentSlaStatus(incident, operation, now),
    };
  });
  const visible = rows.filter(
    (row) =>
      (stage === 'all' || row.stage === stage) &&
      (slaFilter === 'all' || row.sla === slaFilter) &&
      (!query ||
        `${row.incident.id} ${row.incident.problemEventId}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())),
  );
  const confirmed = new Set(
      incidents.flatMap((i) => i.impact.affectedCustomerIds),
    ),
    potential = new Set(
      incidents.flatMap((i) => i.impact.potentiallyAffectedCustomerIds),
    );
  const count = (status: DisplaySla) =>
    rows.filter((row) => row.sla === status).length;
  return (
    <section aria-labelledby="noc-board-heading">
      <h3 id="noc-board-heading" tabIndex={-1}>
        NOC incident board
      </h3>
      <p>
        Current loaded page only. Filters do not search other pages. SLA display
        updates locally every 30 seconds; data changes require an explicit
        reload.
      </p>
      <dl aria-label="Current page totals">
        <dt>Incidents on this loaded page</dt>
        <dd>{incidents.length}</dd>
        <dt>Distinct confirmed customers on this page</dt>
        <dd>{confirmed.size}</dd>
        <dt>
          Potentially affected customers on this page (includes confirmed)
        </dt>
        <dd>{potential.size}</dd>
        <dt>Unknown impact incidents on this page</dt>
        <dd>
          {incidents.filter((i) => i.impact.confidence === 'unknown').length}
        </dd>
        <dt>SLA on track / warning / breached on this page</dt>
        <dd>
          {count('on-track')} / {count('warning')} / {count('breached')}
        </dd>
        <dt>SLA blocked / local time unverified on this page</dt>
        <dd>
          {count('blocked')} / {count('time-unverified')}
        </dd>
      </dl>
      {!operationsReady && (
        <p>
          Operational state is not verified for this page. Creation snapshots do
          not establish current ownership or stage.
        </p>
      )}
      <fieldset disabled={busy}>
        <legend>Filter this page</legend>
        <label>
          Operational stage filter
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="all">All returned stages</option>
            {Object.entries(stageLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
            <option value="not-initialised">Not initialised</option>
            <option value="unverified">Operational state unverified</option>
          </select>
        </label>
        <label>
          SLA filter
          <select
            value={slaFilter}
            onChange={(e) => setSlaFilter(e.target.value)}
          >
            <option value="all">All SLA states</option>
            {(
              [
                'on-track',
                'warning',
                'breached',
                'blocked',
                'time-unverified',
              ] as const
            ).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          Incident or source problem ID
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={80}
          />
        </label>
      </fieldset>
      <p role="status" aria-label="Board filtered count">
        Showing {visible.length} of {incidents.length} incidents on this loaded
        page.
      </p>
      {incidents.length === 0 ? (
        <p>No incidents returned for this page.</p>
      ) : visible.length === 0 ? (
        <p>
          No incidents match these local filters. Other pages have not been
          searched.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table aria-label="Current page incident board">
            <caption>Read-only incident overview as of {now} UTC</caption>
            <thead>
              <tr>
                <th scope="col">Incident</th>
                <th scope="col">Current stage and ownership</th>
                <th scope="col">Customer impact</th>
                <th scope="col">Operational SLA</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ incident, operation, sla }) => (
                <tr key={incident.id}>
                  <td>
                    <button
                      id={'incident-select-' + incident.id}
                      disabled={busy}
                      aria-expanded={selectedId === incident.id}
                      aria-controls="incident-workspace"
                      onClick={() => onSelect(incident.id)}
                    >
                      Open incident {incident.id}
                    </button>
                    <p>Source problem {incident.problemEventId}</p>
                    <p>Creation snapshot: {incident.state}</p>
                  </td>
                  <td>
                    {operation ? (
                      <>
                        <strong>{stageLabels[operation.state]}</strong>
                        <p>Team {operation.ownerTeamId}</p>
                        <p>
                          Engineer{' '}
                          {operation.ownerAssigneeId ??
                            'Awaiting acknowledgement'}
                        </p>
                        {operation.pendingHandoff && (
                          <p>Handoff pending; ownership retained.</p>
                        )}
                        {operation.pendingReturn && (
                          <p>Return pending; department retains ownership.</p>
                        )}
                        {operation.pendingMaterialisation && (
                          <p>
                            Saved command projections require reconciliation.
                          </p>
                        )}
                      </>
                    ) : (
                      <p>
                        {operationsReady
                          ? 'Not initialised'
                          : 'Operational state not verified'}
                      </p>
                    )}
                  </td>
                  <td>
                    <p>
                      {incident.impact.confidence}: {incident.impact.reason}
                    </p>
                    <p>
                      Confirmed customers:{' '}
                      {incident.impact.affectedCustomerIds.length}; potentially
                      affected:{' '}
                      {incident.impact.potentiallyAffectedCustomerIds.length}.
                    </p>
                    <p>
                      Affected services:{' '}
                      {incident.impact.affectedServiceIds.length}; potentially
                      affected:{' '}
                      {incident.impact.potentiallyAffectedServiceIds.length}.
                    </p>
                  </td>
                  <td>
                    {incident.sla.kind === 'selected' ? (
                      <>
                        <strong>
                          {incident.sla.snapshot.priority} — {sla}
                        </strong>
                        <p>Deadline UTC {incident.sla.snapshot.deadlineAt}</p>
                        {operation?.resolvedAt ? (
                          <p>
                            Clock evaluated at confirmed resolution{' '}
                            {operation.resolvedAt}.
                          </p>
                        ) : (
                          <p>Resolution is not confirmed in this overview.</p>
                        )}
                      </>
                    ) : (
                      <p>
                        Manual triage: {incident.sla.reason}. Original outage
                        time retained.
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
