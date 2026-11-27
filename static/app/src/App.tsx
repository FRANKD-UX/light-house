import { invocationFailure } from './invocation-error';
import { Inventory } from './Inventory';
import { Monitoring } from './Monitoring';
import { Incidents } from './Incidents';
import { useEffect, useRef, useState } from 'react';
import { invoke } from '@forge/bridge';
import { APPLICATION_METADATA } from '../../../src/domain/value-objects/application-metadata';
import { validateStatus, type StatusValidation } from './status-contract';

type HealthCheck =
  | { readonly phase: 'idle' | 'checking' }
  | { readonly phase: 'rejected'; readonly diagnostic: string }
  | { readonly phase: 'received'; readonly validation: StatusValidation };

export function App() {
  const [check, setCheck] = useState<HealthCheck>({ phase: 'idle' });
  const inFlight = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function checkHealth() {
    if (inFlight.current) return;
    inFlight.current = true;
    setCheck({ phase: 'checking' });
    try {
      const response: unknown = await invoke<unknown>('getStatus');
      if (mounted.current)
        setCheck({ phase: 'received', validation: validateStatus(response) });
    } catch (error) {
      if (mounted.current)
        setCheck({ phase: 'rejected', diagnostic: invocationFailure(error) });
    } finally {
      inFlight.current = false;
    }
  }

  const validation = check.phase === 'received' ? check.validation : undefined;
  const status = validation?.valid ? validation.status : undefined;
  const announcement =
    check.phase === 'idle'
      ? 'Health check not run.'
      : check.phase === 'checking'
        ? 'Checking runtime health…'
        : check.phase === 'rejected'
          ? `Health check failed: ${check.diagnostic}`
          : validation?.valid
            ? 'Health check passed: backend available and response contract valid.'
            : `Health check failed: invalid ${validation?.reason}. You can retry.`;

  return (
    <main>
      <p className="eyebrow">ISP incident orchestration</p>
      <h1>{APPLICATION_METADATA.name}</h1>
      <p>{APPLICATION_METADATA.stage}</p>
      <section aria-labelledby="foundation">
        <h2 id="foundation">Engineering foundation</h2>
        <p>
          This application is in development. Monitoring intake and inventory
          require explicit source and Forge SQL setup. SLA execution and Jira
          Service Management orchestration are not connected.
        </p>
        <button
          type="button"
          disabled={check.phase === 'checking'}
          onClick={() => {
            void checkHealth();
          }}
        >
          Run health check
        </button>
        <p
          role="status"
          aria-label="Foundation health"
          aria-live="polite"
          aria-atomic="true"
        >
          {announcement}
        </p>
        <dl>
          <dt>Forge Bridge invocation</dt>
          <dd>
            {check.phase === 'received'
              ? 'Resolved'
              : check.phase === 'rejected'
                ? 'Rejected'
                : check.phase === 'checking'
                  ? 'Pending'
                  : 'Not run'}
          </dd>
          <dt>Backend resolver availability</dt>
          <dd>{status ? 'available' : 'Not verified'}</dd>
          <dt>Runtime response contract</dt>
          <dd>
            {validation
              ? validation.valid
                ? 'Valid'
                : `Invalid: ${validation.reason}`
              : 'Not validated'}
          </dd>
          <dt>Application metadata returned by backend</dt>
          <dd>
            {status
              ? `${status.application.name} / ${status.application.repository} / ${status.application.version} / ${status.application.stage}`
              : 'Not validated'}
          </dd>
          <dt>Integration readiness</dt>
          <dd>{status ? status.integrations : 'Not validated'}</dd>
          <dt>Correlation ID</dt>
          <dd>
            {status
              ? `${status.correlationId} (valid UUIDv4)`
              : validation &&
                  !validation.valid &&
                  validation.reason === 'correlation ID'
                ? 'Invalid UUIDv4'
                : 'Not validated'}
          </dd>
        </dl>
      </section>
      <Inventory />
      <Monitoring />
      <Incidents />
    </main>
  );
}
