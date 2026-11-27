// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { randomUUID } from 'node:crypto';
import { Monitoring } from '../../static/app/src/Monitoring';
import {
  monitoringOverview,
  monitoringMutation,
  type MonitoringOverview,
} from '../../static/app/src/monitoring-contract';
vi.mock('@forge/bridge', () => ({ invoke: vi.fn() }));
import { invoke } from '@forge/bridge';
const call = vi.mocked(invoke);
const tenantId = randomUUID(),
  sourceId = randomUUID(),
  keyId = randomUUID();
const source = {
  id: sourceId,
  name: 'Synthetic source',
  sourceType: 'zabbix',
  status: 'active',
  version: 1,
  keyId,
  previousValidUntil: null,
};
const receipt = {
  id: randomUUID(),
  sourceId,
  correlationId: randomUUID(),
  duplicates: 3,
  externalEventId: '100',
  problemEventId: '100',
  kind: 'problem',
  resourceId: 'trigger:1',
  occurredAt: '2026-11-27T00:00:00.000Z',
  receivedAt: '2026-11-27T00:00:00.000Z',
  status: 'manual_triage',
  reason: 'UNKNOWN_MAPPING',
  attempts: 1,
  version: 3,
  uplinkId: null,
  siteId: null,
};
const snapshot = {
  sources: [source],
  receipts: [receipt],
  observations: [
    {
      correlationId: randomUUID(),
      sourceId,
      receivedAt: receipt.receivedAt,
      result: 'invalid',
    },
  ],
  next: null,
  sourceNext: null,
};
let current: MonitoringOverview = monitoringOverview(snapshot);
const envelope = (value: unknown) => ({
  ok: true,
  value,
  correlationId: randomUUID(),
});
beforeEach(() => {
  current = monitoringOverview(structuredClone(snapshot));
  call.mockReset();
  call.mockImplementation(async (name, input) => {
    if (name === 'inventory')
      return envelope({
        tenants: [{ tenantId, name: 'Lantern Fibre', role: 'admin' }],
      });
    const p = input as Record<string, unknown>;
    if (p.action === 'overview') return envelope(current);
    if (p.action === 'configure')
      return envelope({ sourceId, keyId, version: 2 });
    return envelope(
      (
        {
          migrate: { queued: true },
          revoke: { disabled: true },
          map: { saved: true },
          retry: { dispatched: true },
          recover: { examined: 1, dispatched: 1 },
          cleanup: { cleaned: 1 },
        } as Record<string, unknown>
      )[String(p.action)],
    );
  });
});
afterEach(cleanup);
async function click(name: string) {
  fireEvent.click(screen.getByRole('button', { name }));
  await waitFor(() =>
    expect(
      screen.getByRole('status', { name: 'Monitoring status' }).textContent,
    ).not.toContain('Loading monitoring'),
  );
}
async function choose() {
  await click('Load monitoring tenants');
  fireEvent.change(screen.getByLabelText('Monitoring tenant'), {
    target: { value: tenantId },
  });
}
async function load() {
  await click('Load monitoring');
}
it('demonstrates source configuration, rotation, mapping, revocation, receipt recovery and safe outcomes without revealing the secret', async () => {
  render(<Monitoring />);
  await choose();
  await load();
  expect(screen.getByText(/duplicates 3/)).toBeTruthy();
  expect(screen.getByText(/Check the v1 payload/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Source name'), {
    target: { value: 'Synthetic new' },
  });
  fireEvent.change(screen.getByLabelText('New source secret'), {
    target: { value: 'a'.repeat(43) },
  });
  await click('Create monitoring source');
  expect(
    (screen.getByLabelText('New source secret') as HTMLInputElement).value,
  ).toBe('');
  expect(document.body.textContent).not.toContain('a'.repeat(43));
  await load();
  fireEvent.change(screen.getByLabelText('Monitoring source'), {
    target: { value: sourceId },
  });
  fireEvent.change(screen.getByLabelText('Rotation overlap seconds'), {
    target: { value: '60' },
  });
  fireEvent.change(screen.getByLabelText('New source secret'), {
    target: { value: 'b'.repeat(43) },
  });
  await click('Rotate source credential');
  await load();
  fireEvent.change(screen.getByLabelText('External resource ID'), {
    target: { value: 'trigger:1' },
  });
  fireEvent.change(screen.getByLabelText('Same-tenant uplink ID'), {
    target: { value: randomUUID() },
  });
  await click('Add resource mapping');
  await load();
  await click('Retry receipt ' + receipt.id);
  await load();
  await click('Revoke monitoring source');
  await click('Recover up to 20 interrupted events');
  await click('Clean up to 20 inactive credentials');
  await click('Queue monitoring schema setup');
  expect(
    call.mock.calls
      .filter(([name]) => name === 'monitoring')
      .map(([, p]) => (p as Record<string, unknown>).action),
  ).toEqual(
    expect.arrayContaining([
      'configure',
      'map',
      'retry',
      'revoke',
      'recover',
      'cleanup',
      'migrate',
    ]),
  );
});
it('paginates safely and presents reason-specific triage with readonly viewer access', async () => {
  call.mockImplementationOnce(async () =>
    envelope({
      tenants: [{ tenantId, name: 'Lantern Fibre', role: 'viewer' }],
    }),
  );
  render(<Monitoring />);
  await choose();
  current = {
    ...snapshot,
    next: randomUUID(),
    sourceNext: randomUUID(),
    sources: [{ ...source, status: 'disabled', keyId: null }],
  } as MonitoringOverview;
  await load();
  expect(
    screen.queryByRole('button', { name: 'Queue monitoring schema setup' }),
  ).toBeNull();
  expect(screen.queryByText('New source secret')).toBeNull();
  await click('Next source page');
  await click('Next event page');
  for (const reason of ['RETRY_EXHAUSTED', 'SOURCE_DISABLED', null]) {
    current = {
      ...current,
      receipts: [{ ...receipt, reason }],
    } as MonitoringOverview;
    await load();
  }
  current = {
    sources: [],
    receipts: [],
    observations: [],
    next: null,
    sourceNext: null,
  };
  await load();
  expect(screen.getByText('No events on this page.')).toBeTruthy();
  expect(screen.getByText('No sources on this page.')).toBeTruthy();
});
it('discards stale data and exposes only fixed backend/Bridge failures; prevents duplicate operations while loading', async () => {
  render(<Monitoring />);
  await choose();
  await load();
  call.mockResolvedValueOnce({
    ok: false,
    code: 'CONFLICT',
    correlationId: randomUUID(),
    private: 'do-not-render',
  });
  await load();
  expect(document.body.textContent).toContain('Reload before retrying.');
  expect(document.body.textContent).not.toContain('do-not-render');
  expect(screen.queryByText(/duplicates 3/)).toBeNull();
  call.mockResolvedValueOnce({
    ok: false,
    code: 'NOT_READY',
    correlationId: randomUUID(),
  });
  await load();
  expect(document.body.textContent).toContain('schema setup');
  call.mockResolvedValueOnce({
    ok: false,
    code: 'DENIED',
    correlationId: randomUUID(),
  });
  await load();
  call.mockResolvedValueOnce(envelope({ sources: 'bad' }));
  await load();
  expect(document.body.textContent).toContain('response contract failed');
  call.mockRejectedValueOnce(new Error('private-secret'));
  await load();
  expect(document.body.textContent).not.toContain('private-secret');
  let finish: (v: unknown) => void = () => {};
  call.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Load monitoring' }));
  expect(
    (
      screen.getByRole('button', {
        name: 'Load monitoring',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  finish(envelope(snapshot));
  await waitFor(() => expect(screen.getByText(/duplicates 3/)).toBeTruthy());
  fireEvent.change(screen.getByLabelText('Monitoring tenant'), {
    target: { value: '' },
  });
  expect(screen.queryByText(/duplicates 3/)).toBeNull();
});
it('rejects malformed monitoring contracts and unknown mutation results', () => {
  expect(monitoringOverview(snapshot)).toEqual(snapshot);
  expect(() =>
    monitoringOverview({ ...snapshot, sources: new Array(51).fill(source) }),
  ).toThrow();
  expect(() =>
    monitoringOverview({
      ...snapshot,
      receipts: [{ ...receipt, status: 'forged' }],
    }),
  ).toThrow();
  expect(() =>
    monitoringOverview({
      ...snapshot,
      observations: [{ ...snapshot.observations[0], result: '<script>' }],
    }),
  ).toThrow();
  expect(() =>
    monitoringOverview({
      ...snapshot,
      receipts: [{ ...receipt, correlationId: 'bad' }],
    }),
  ).toThrow();
  expect(() => monitoringMutation('unknown', {})).toThrow('INVALID_RESPONSE');
  expect(
    monitoringOverview({
      ...snapshot,
      sources: [{ ...source, previousValidUntil: receipt.receivedAt }],
      receipts: [{ ...receipt, uplinkId: randomUUID(), siteId: randomUUID() }],
    }).receipts,
  ).toHaveLength(1);
});
