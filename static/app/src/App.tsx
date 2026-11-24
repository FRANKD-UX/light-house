import { useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';
import { APPLICATION_METADATA } from '../../../src/domain/value-objects/application-metadata';
import type { ApplicationStatus } from '../../../src/application/use-cases/get-status';
export function App() {
  const [status, setStatus] = useState<
    'checking' | 'available' | 'unavailable'
  >('checking');
  useEffect(() => {
    let active = true;
    void invoke<ApplicationStatus>('getStatus')
      .then(() => {
        if (active) setStatus('available');
      })
      .catch(() => {
        if (active) setStatus('unavailable');
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <main>
      <p className="eyebrow">ISP incident orchestration</p>
      <h1>{APPLICATION_METADATA.name}</h1>
      <p>{APPLICATION_METADATA.stage}</p>
      <section aria-labelledby="foundation">
        <h2 id="foundation">Engineering foundation</h2>
        <p>
          This application is in development. Monitoring, inventory, SLA
          policies and Jira Service Management orchestration are not connected.
        </p>
        <p role="status">
          {status === 'checking'
            ? 'Checking backend availability…'
            : status === 'available'
              ? 'Backend status resolver is available.'
              : 'Backend status is unavailable. Open this application in Jira after Forge installation.'}
        </p>
      </section>
    </main>
  );
}
