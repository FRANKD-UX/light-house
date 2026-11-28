import { useRef, useState } from 'react';
import { invoke } from '@forge/bridge';
import {
  BackendFailure,
  inventoryResponse,
  invocationFailure,
} from './invocation-error';
import { object, uuid } from '../../../src/domain/inventory/model';
import { issueContextResult } from './issue-context-contract';
import { incidentSlaStatus, useNocClock } from './NocBoard';
import type { JsmContextResult } from '../../../src/application/jsm-context/contracts';
export function IssueContext() {
  const [result, setResult] = useState<JsmContextResult>(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('Linked incident not loaded.');
  const lock = useRef(false),
    now = useNocClock();
  async function load() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setResult(undefined);
    setMessage('Loading linked incident…');
    try {
      const response: unknown = await invoke('embeddedIncident', {
        action: 'read',
      });
      try {
        const correlationId = uuid(object(response).correlationId);
        setResult(issueContextResult(inventoryResponse(response)));
        setMessage(
          `Linked incident read completed. Correlation ID: ${correlationId}.`,
        );
      } catch (error) {
        if (error instanceof BackendFailure) throw error;
        throw new Error('INVALID_RESPONSE', { cause: error });
      }
    } catch (error) {
      setMessage(
        error instanceof BackendFailure
          ? `Linked incident backend ${error.code}. Correlation ID: ${error.correlationId ?? 'unavailable'}.`
          : error instanceof Error && error.message === 'INVALID_RESPONSE'
            ? 'Linked incident response contract failed. No result accepted.'
            : invocationFailure(error),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const current = result?.kind === 'available' ? result : undefined;
  return (
    <main>
      <h1>Light House</h1>
      <h2>Linked incident</h2>
      <button disabled={busy} onClick={() => void load()}>
        Load linked incident
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {result?.kind === 'unavailable' && (
        <p>
          Linked incident unavailable: {result.reason}. Jira visibility and
          Light House tenant access are both required.
        </p>
      )}
      {current && (
        <>
          <p>Incident {current.incident.id}</p>
          <dl>
            <dt>Creation snapshot</dt>
            <dd>{current.incident.state}</dd>
            <dt>Current operational stage</dt>
            <dd>
              {current.operations.summary?.state ??
                (current.operations.readiness === 'ready'
                  ? 'Not initialised'
                  : 'Operational state not verified')}
            </dd>
            <dt>Accountable team / engineer</dt>
            <dd>
              {current.operations.summary
                ? `${current.operations.summary.ownerTeamId} / ${current.operations.summary.ownerAssigneeId ?? 'Awaiting acknowledgement'}`
                : 'Not returned'}
            </dd>
            <dt>Customer impact</dt>
            <dd>
              {current.incident.impact.confidence};{' '}
              {current.incident.impact.affectedCustomerIds.length} confirmed /{' '}
              {current.incident.impact.potentiallyAffectedCustomerIds.length}{' '}
              potentially affected (includes confirmed)
            </dd>
            <dt>Impact assessment</dt>
            <dd>{current.incident.impact.reason}</dd>
          </dl>
          {current.incident.sla.kind === 'selected' ? (
            <dl>
              <dt>Priority</dt>
              <dd>{current.incident.sla.snapshot.priority}</dd>
              <dt>Warning UTC</dt>
              <dd>{current.incident.sla.snapshot.warningAt}</dd>
              <dt>Deadline UTC</dt>
              <dd>{current.incident.sla.snapshot.deadlineAt}</dd>
              <dt>Operational SLA at {now}</dt>
              <dd>
                {current.operations.readiness === 'ready'
                  ? incidentSlaStatus(
                      current.incident,
                      current.operations.summary ?? undefined,
                      now,
                    )
                  : 'Operational SLA unverified'}
              </dd>
            </dl>
          ) : (
            <p>
              Manual triage: {current.incident.sla.reason}. Original outage time
              retained.
            </p>
          )}
          {current.operations.summary?.pendingHandoff && (
            <p>Handoff pending; ownership retained.</p>
          )}
          {current.operations.summary?.pendingReturn && (
            <p>Return pending; department retains ownership.</p>
          )}
          {current.operations.summary?.pendingMaterialisation && (
            <p>Saved projections require reconciliation.</p>
          )}
          <p>
            This view is read-only. Use the Light House global workspace for
            authorised operational commands. Refresh explicitly to retrieve
            changes.
          </p>
        </>
      )}
    </main>
  );
}
