import { useRef, useState } from 'react';
import { invoke } from '@forge/bridge';
import {
  InventoryError,
  integer,
  object,
  text,
  uuid,
  type Role,
} from '../../../src/domain/inventory/model';
import type { OperationCommand } from '../../../src/application/operations/contracts';
import {
  BackendFailure,
  inventoryResponse,
  invocationFailure,
} from './invocation-error';
import {
  checklistResult,
  operationExecution,
  operationMutation,
  operationsOverview,
  type OperationsOverview,
  type PublicOperation,
} from './operations-contract';
type Kind = OperationCommand['kind'];
const labels: Record<Kind, string> = {
  initialise: 'Initialise NOC ownership',
  assign: 'Reassign accountable engineer',
  acknowledge: 'Acknowledge incident',
  triage: 'Start NOC triage',
  start_work: 'Start direct work',
  request_handoff: 'Request departmental handoff',
  accept_handoff: 'Accept handoff',
  reject_handoff: 'Reject handoff',
  request_return: 'Request return to NOC',
  return_to_noc: 'Request return to NOC',
  accept_return: 'Accept return to NOC',
  reject_return: 'Reject return',
  request_validation: 'Request restoration validation',
  validate_restoration: 'Record restoration validation',
  resolve: 'Resolve incident',
  close: 'Close incident',
};
const operational = [
  'diagnosticFindings',
  'escalationJustification',
  'supportingEvidence',
  'receivingCapability',
  'accountableEngineer',
  'outstandingActions',
];
const remediation = [
  'workCompleted',
  'supportingEvidence',
  'outstandingActions',
];
const restoration = [
  'restorationEvidence',
  'impactReassessed',
  'outstandingActions',
  'validatorRecorded',
];
const checklists: Partial<Record<Kind, readonly string[]>> = {
  start_work: operational,
  request_handoff: operational,
  accept_handoff: operational,
  request_return: remediation,
  accept_return: remediation,
  request_validation: remediation,
  validate_restoration: restoration,
};
const fieldLabels: Record<string, string> = {
  diagnosticFindings: 'Diagnostic findings',
  escalationJustification: 'Escalation or direct-work justification',
  supportingEvidence: 'Reviewed supporting evidence',
  receivingCapability: 'Receiving team capability reviewed',
  accountableEngineer: 'Accountable engineer confirmed',
  outstandingActions: 'Outstanding action completion or approved disposition',
  workCompleted: 'Remediation completed',
  restorationEvidence: 'Restoration evidence',
  impactReassessed: 'Service and customer impact reassessed',
  validatorRecorded: 'I record this restoration validation',
};
const flags = new Set([
  'receivingCapability',
  'accountableEngineer',
  'impactReassessed',
  'validatorRecorded',
]);
function actions(operation: PublicOperation | null): Kind[] {
  if (!operation) return ['initialise'];
  if (operation.pendingHandoff) return ['accept_handoff', 'reject_handoff'];
  if (operation.pendingReturn) return ['accept_return', 'reject_return'];
  switch (operation.state) {
    case 'new':
      return ['acknowledge'];
    case 'acknowledged':
      return ['triage', 'assign'];
    case 'triage':
      return ['start_work', 'assign'];
    case 'in_progress':
      return operation.ownerTeamId === operation.nocTeamId
        ? ['request_validation', 'request_handoff', 'assign']
        : ['request_return', 'request_handoff', 'assign'];
    case 'restoration_validation':
      return ['validate_restoration', 'assign'];
    default:
      return [];
  }
}
function decoded<T>(read: () => T): T {
  try {
    return read();
  } catch (error) {
    if (error instanceof BackendFailure) throw error;
    throw new Error('INVALID_RESPONSE', { cause: error });
  }
}
export function Operations({
  tenantId,
  incidentId,
  role,
}: {
  tenantId: string;
  incidentId: string;
  role: Role;
}) {
  const [overview, setOverview] = useState<OperationsOverview>(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('Operational state not loaded.'),
    [kind, setKind] = useState<Kind>('initialise');
  const [target, setTarget] = useState(''),
    [targetEngineer, setTargetEngineer] = useState(''),
    [reason, setReason] = useState(''),
    [fields, setFields] = useState<Record<string, string | boolean>>({}),
    [gate, setGate] = useState<{
      gateId: string;
      validUntil: string;
      kind: Kind;
      version: number;
      factsVersion: number;
    }>();
  const [noc, setNoc] = useState(''),
    [configExpected, setConfigExpected] = useState('0'),
    [savedCommand, setSavedCommand] = useState<OperationCommand | null>(null);
  const lock = useRef(false);
  const minimumVersion = useRef(0);
  const canOperate = role === 'operator' || role === 'admin';
  const current = overview?.operation;
  async function request(action: string, extra: Record<string, unknown> = {}) {
    uuid(tenantId);
    uuid(incidentId);
    const response: unknown = await invoke('operations', {
      action,
      tenantId,
      ...extra,
    });
    return decoded(() => {
      const envelope = object(response);
      return {
        value: inventoryResponse(response),
        correlationId: uuid(envelope.correlationId),
      };
    });
  }
  async function run(work: () => Promise<string>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setOverview(undefined);
    setMessage('Loading operational state…');
    try {
      setMessage(await work());
    } catch (error) {
      setMessage(
        error instanceof BackendFailure
          ? `Operations ${error.code}. ${error.code === 'CONFLICT' ? 'Reload and reconcile before retrying.' : error.code === 'REPAIR_REQUIRED' ? 'A saved command requires projection repair.' : 'Check membership, configuration and persisted state.'} Correlation ID: ${error.correlationId ?? 'unavailable'}.`
          : error instanceof Error && error.message === 'INVALID_RESPONSE'
            ? 'Operational response contract failed. No result accepted.'
            : error instanceof InventoryError
              ? 'Operational input invalid. Check the fields before retrying.'
              : invocationFailure(error),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function load() {
    const response = await request('overview', { incidentId });
    const value = decoded(() => operationsOverview(response.value, incidentId));
    if ((value.operation?.version ?? 0) < minimumVersion.current)
      throw new Error('INVALID_RESPONSE');
    minimumVersion.current = Math.max(
      minimumVersion.current,
      value.operation?.version ?? 0,
    );
    setOverview(value);
    if (!savedCommand) {
      const available = actions(value.operation);
      const selected = available.includes(kind)
        ? kind
        : (available[0] ?? 'initialise');
      setKind(selected);
      if (
        gate &&
        (gate.kind !== selected ||
          gate.version !== value.operation?.version ||
          gate.factsVersion !== value.operation?.factsVersion ||
          Date.parse(gate.validUntil) <= Date.now())
      )
        setGate(undefined);
      if (selected !== kind) setFields({});
    }
    setNoc(value.configuration?.nocTeamId ?? '');
    setConfigExpected(String(value.configuration?.version ?? 0));
    return `Operational state loaded. Correlation ID: ${response.correlationId}.`;
  }
  async function send(command: OperationCommand) {
    setSavedCommand(command);
    const response = await request('execute', { command });
    const value = decoded(() => operationExecution(response.value, incidentId));
    if (value.version !== command.expected + 1)
      throw new Error('INVALID_RESPONSE');
    minimumVersion.current = Math.max(minimumVersion.current, value.version);
    if (!value.pendingMaterialisation) setSavedCommand(null);
    setGate(undefined);
    return `Command ${command.commandId}: ${value.state}, version ${value.version}. ${value.pendingMaterialisation ? 'Saved projections remain pending; reload and retain this command ID.' : 'Saved command completed. Reload before another action.'} Correlation ID: ${value.correlationId}.`;
  }
  const available = overview ? actions(overview.operation) : [];
  const needsChecklist = checklists[kind];
  return (
    <section aria-labelledby={'operation-heading-' + incidentId}>
      <h4 id={'operation-heading-' + incidentId}>
        Operational ownership and restoration
      </h4>
      <p>
        Server checks active membership, mapped engineer and team ownership on
        every command. Handoff and return requests retain accountability until
        accepted. SLA deadlines continue unchanged.
      </p>
      <button disabled={busy} onClick={() => void run(load)}>
        Load operational state
      </button>
      <p role="status" aria-label="Operational status" aria-live="polite">
        {message}
      </p>
      {savedCommand && (
        <p>
          Retained command ID: {savedCommand.commandId}. Reload first, then
          retry this exact command to reconcile its outcome.
        </p>
      )}
      {overview && (
        <>
          {overview.configuration ? (
            <p>
              Configured NOC team: {overview.configuration.nocTeamId};
              configuration version {overview.configuration.version}.
            </p>
          ) : (
            <p>
              NOC configuration has not been returned. An administrator must
              configure an active same-tenant team.
            </p>
          )}
          {current ? (
            <>
              <dl>
                <dt>Operational stage</dt>
                <dd>{current.state}</dd>
                <dt>Accountable team</dt>
                <dd>{current.ownerTeamId}</dd>
                <dt>Accountable engineer</dt>
                <dd>{current.ownerAssigneeId ?? 'Awaiting acknowledgement'}</dd>
                <dt>Original NOC team</dt>
                <dd>{current.nocTeamId}</dd>
                <dt>Current revision / evidence revision</dt>
                <dd>
                  {current.version} / {current.factsVersion}
                </dd>
                <dt>Immutable SLA start / deadline UTC</dt>
                <dd>
                  {current.sla.startedAt} / {current.sla.deadlineAt}
                </dd>
                <dt>Monitoring recovery evidence UTC</dt>
                <dd>{current.recoveryObservedAt ?? 'Not observed'}</dd>
                <dt>Restoration validation UTC</dt>
                <dd>{current.restorationValidatedAt ?? 'Not validated'}</dd>
                <dt>Confirmed operational resolution UTC</dt>
                <dd>{current.resolvedAt ?? 'Not resolved'}</dd>
              </dl>
              {current.pendingHandoff && (
                <p>
                  Handoff pending to {current.pendingHandoff.targetTeamId} since{' '}
                  {current.pendingHandoff.requestedAt}. Current team and
                  engineer remain accountable until acceptance.
                </p>
              )}
              {current.pendingReturn && (
                <p>
                  Return pending from {current.pendingReturn.fromTeamId} since{' '}
                  {current.pendingReturn.requestedAt}. The department retains
                  ownership until NOC acceptance; rejection keeps work with the
                  department.
                </p>
              )}
              {current.pendingMaterialisation && (
                <p>
                  Command projections are pending. Further transitions are
                  blocked until saved evidence is reconciled.
                </p>
              )}
              {overview.configuration &&
                overview.configuration.nocTeamId !== current.nocTeamId && (
                  <p>
                    NOC configuration changed. This incident retains its
                    original NOC; reviewed reconciliation is required.
                  </p>
                )}
            </>
          ) : (
            <p>
              No operational aggregate returned. A selected-SLA incident can be
              initialised under the configured NOC.
            </p>
          )}
          {canOperate && (
            <fieldset disabled={busy}>
              <legend>Guarded operational commands</legend>
              {savedCommand ? (
                <button onClick={() => void run(() => send(savedCommand))}>
                  Retry exact saved command
                </button>
              ) : (
                <>
                  {available.length > 0 ? (
                    <>
                      <label>
                        Operational action
                        <select
                          value={kind}
                          onChange={(e) => {
                            setKind(e.target.value as Kind);
                            setFields({});
                            setGate(undefined);
                            setReason('');
                            setTarget('');
                            setTargetEngineer('');
                          }}
                        >
                          {available.map((action) => (
                            <option key={action} value={action}>
                              {labels[action]}
                            </option>
                          ))}
                        </select>
                      </label>
                      {kind === 'request_handoff' && (
                        <label>
                          Receiving team ID
                          <input
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                          />
                        </label>
                      )}
                      {kind === 'assign' && (
                        <>
                          <label>
                            New accountable engineer ID
                            <input
                              value={targetEngineer}
                              onChange={(e) =>
                                setTargetEngineer(e.target.value)
                              }
                            />
                          </label>
                          <p>
                            Requires the accountable team's lead or an
                            administrator. The engineer must be an active member
                            of the same team. Reassignment preserves state and
                            SLA, and invalidates prior restoration validation.
                          </p>
                        </>
                      )}
                      {(kind === 'assign' ||
                        kind === 'reject_handoff' ||
                        kind === 'reject_return') && (
                        <label>
                          {kind === 'assign'
                            ? 'Reassignment reason'
                            : 'Rejection reason'}
                          <input
                            maxLength={300}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                          />
                        </label>
                      )}
                      {needsChecklist && (
                        <fieldset>
                          <legend>Required checklist for {labels[kind]}</legend>
                          <p>
                            Record reviewed facts and dispositions. These
                            attestations do not grant Jira permissions. The
                            server binds the checklist to the current incident
                            and evidence revisions with a proposed five-minute
                            lifetime.
                          </p>
                          {needsChecklist.map((key) => (
                            <label key={key}>
                              {fieldLabels[key]}
                              {flags.has(key) ? (
                                <input
                                  type="checkbox"
                                  checked={fields[key] === true}
                                  onChange={(e) =>
                                    setFields({
                                      ...fields,
                                      [key]: e.target.checked,
                                    })
                                  }
                                />
                              ) : (
                                <input
                                  maxLength={1000}
                                  value={
                                    typeof fields[key] === 'string'
                                      ? fields[key]
                                      : ''
                                  }
                                  onChange={(e) =>
                                    setFields({
                                      ...fields,
                                      [key]: e.target.value,
                                    })
                                  }
                                />
                              )}
                            </label>
                          ))}
                          <button
                            disabled={
                              !current || current.pendingMaterialisation
                            }
                            onClick={() =>
                              void run(async () => {
                                if (!current)
                                  throw new Error('INVALID_RESPONSE');
                                const projected: Record<string, string | true> =
                                  {};
                                for (const key of needsChecklist) {
                                  if (flags.has(key)) {
                                    if (fields[key] !== true)
                                      throw new InventoryError('INVALID');
                                    projected[key] = true;
                                  } else
                                    projected[key] = text(fields[key], 1000);
                                }
                                const response = await request('checklist', {
                                  checklist: {
                                    incidentId,
                                    kind,
                                    expected: current.version,
                                    fields: projected,
                                  },
                                });
                                const value = decoded(() =>
                                  checklistResult(response.value),
                                );
                                setGate({
                                  ...value,
                                  kind,
                                  version: current.version,
                                  factsVersion: current.factsVersion,
                                });
                                return `Checklist recorded: ${value.gateId}; valid until ${value.validUntil}. Reload before executing the guarded command.`;
                              })
                            }
                          >
                            Record operational checklist
                          </button>
                        </fieldset>
                      )}
                      <button
                        disabled={
                          !overview.configuration ||
                          Boolean(current?.pendingMaterialisation) ||
                          (Boolean(needsChecklist) && !gate) ||
                          kind === 'resolve' ||
                          kind === 'close'
                        }
                        onClick={() =>
                          void run(() => {
                            const command: OperationCommand = {
                              commandId: globalThis.crypto.randomUUID(),
                              incidentId,
                              expected: current?.version ?? 0,
                              kind,
                              ...(kind === 'assign'
                                ? { targetAssigneeId: uuid(targetEngineer) }
                                : {}),
                              ...(kind === 'request_handoff'
                                ? { targetTeamId: uuid(target) }
                                : {}),
                              ...(kind === 'assign' ||
                              kind === 'reject_handoff' ||
                              kind === 'reject_return'
                                ? { reason: text(reason, 300) }
                                : {}),
                            };
                            return send(command);
                          })
                        }
                      >
                        Execute operational action
                      </button>
                    </>
                  ) : (
                    <p>
                      No further local transition is available in this stage.
                    </p>
                  )}
                </>
              )}
            </fieldset>
          )}
          {role === 'admin' && current?.pendingMaterialisation && (
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const response = await request('repair', { incidentId });
                  return `${decoded(() => operationMutation('repair', response.value))} Correlation ID: ${response.correlationId}.`;
                })
              }
            >
              Repair saved command projections
            </button>
          )}
        </>
      )}
      {gate && (
        <p>
          Recorded checklist {gate.gateId}; expires UTC {gate.validUntil}. A
          revision or evidence change requires a new checklist.
        </p>
      )}
      {role === 'admin' && (
        <fieldset disabled={busy}>
          <legend>NOC configuration</legend>
          <label>
            NOC team ID
            <input value={noc} onChange={(e) => setNoc(e.target.value)} />
          </label>
          <label>
            Expected NOC configuration version
            <input
              type="number"
              min="0"
              value={configExpected}
              onChange={(e) => setConfigExpected(e.target.value)}
            />
          </label>
          <button
            onClick={() =>
              void run(async () => {
                if (configExpected === '') throw new InventoryError('INVALID');
                const expected = integer(Number(configExpected), 2147483646, 0);
                const response = await request('configure', {
                  configuration: {
                    nocTeamId: uuid(noc),
                    version: expected + 1,
                  },
                  expected,
                });
                return `${decoded(() => operationMutation('configure', response.value))} Correlation ID: ${response.correlationId}.`;
              })
            }
          >
            Save NOC configuration
          </button>
        </fieldset>
      )}
      <button disabled>Resolve through confirmed Jira transition</button>
      <button disabled>Close through confirmed Jira transition</button>
      <p>
        Native Jira transition confirmation is not available in this artifact.
        Monitoring recovery and checklist submission cannot resolve or close an
        incident.
      </p>
    </section>
  );
}
