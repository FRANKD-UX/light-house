// @vitest-environment jsdom
// Mocked Bridge/rendered local UI only; no Atlassian browser or native acceptance.
import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { invoke } from '@forge/bridge';
import { Incidents } from '../../static/app/src/Incidents';
import { incidentRecovery } from '../../static/app/src/incident-contract';
vi.mock('@forge/bridge', () => ({ invoke: vi.fn() }));
const tenantId = randomUUID(),
  correlationId = randomUUID();
const response = (value: unknown) => ({ ok: true, value, correlationId });
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
async function admin(role: 'admin' | 'viewer' = 'admin') {
  vi.mocked(invoke).mockResolvedValueOnce(
    response({ tenants: [{ tenantId, name: 'Synthetic ISP', role }] }),
  );
  render(<Incidents />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Load incident tenants' }),
  );
  await screen.findByRole('option', { name: `Synthetic ISP (${role})` });
  fireEvent.change(screen.getByLabelText('Incident tenant'), {
    target: { value: tenantId },
  });
}
it('renders each recovery outcome, clears stale results on failed requests and hides controls for viewers', async () => {
  await admin();
  const id = randomUUID();
  vi.mocked(invoke).mockResolvedValueOnce(
    response({
      examined: 1,
      next: null,
      results: [{ inboxId: id, status: 'failed', code: 'UNAVAILABLE' }],
    }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Scan up to 20 ready receipts' }),
  );
  await screen.findByText(`Receipt ${id}: failed (UNAVAILABLE).`);
  expect(invoke).toHaveBeenLastCalledWith('incidents', {
    action: 'recover',
    tenantId,
    after: '',
  });
  vi.mocked(invoke).mockRejectedValueOnce(new Error('private-network-error'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Scan up to 20 ready receipts' }),
  );
  await waitFor(() =>
    expect(screen.queryByLabelText('Receipt recovery outcomes')).toBeNull(),
  );
  expect(screen.queryByText(/private-network-error/)).toBeNull();
  cleanup();
  vi.resetAllMocks();
  await admin('viewer');
  expect(
    screen.queryByRole('button', { name: 'Scan up to 20 ready receipts' }),
  ).toBeNull();
});
it('advances only an explicitly returned recovery cursor and distinguishes empty success from malformed output', async () => {
  await admin();
  const ids = Array.from({ length: 20 }, () => randomUUID()).sort();
  vi.mocked(invoke).mockResolvedValueOnce(
    response({
      examined: 20,
      next: ids[19],
      results: ids.map((inboxId) => ({
        inboxId,
        status: 'awaiting_problem',
        incidentId: null,
      })),
    }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Scan up to 20 ready receipts' }),
  );
  await screen.findByText(/Recovery examined 20 ready receipts/);
  vi.mocked(invoke).mockResolvedValueOnce(
    response({ examined: 0, next: null, results: [] }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Next recovery page' }));
  await screen.findByText(/Recovery examined 0 ready receipts/);
  expect(invoke).toHaveBeenLastCalledWith('incidents', {
    action: 'recover',
    tenantId,
    after: ids[19],
  });
  vi.mocked(invoke).mockResolvedValueOnce(
    response({
      examined: 1,
      next: null,
      results: [{ inboxId: randomUUID(), status: 'linked', incidentId: null }],
    }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Scan up to 20 ready receipts' }),
  );
  await screen.findByText(
    'Incident response contract failed. No result accepted.',
  );
  expect(screen.queryByLabelText('Receipt recovery outcomes')).toBeNull();
});
it('projects a bounded fixed response and rejects mismatched counts, cursors, IDs and arbitrary categories', () => {
  const id = randomUUID(),
    incidentId = randomUUID();
  expect(
    incidentRecovery({
      examined: 1,
      next: null,
      results: [
        { inboxId: id, status: 'linked', incidentId, private: 'discard' },
      ],
    }),
  ).toEqual({
    examined: 1,
    next: null,
    results: [{ inboxId: id, status: 'linked', incidentId, code: null }],
  });
  const row = { inboxId: id, status: 'awaiting_problem', incidentId: null };
  for (const value of [
    null,
    { examined: 0, next: null, results: [row] },
    { examined: 1, next: id, results: [row] },
    { examined: 1, next: null, results: [{ ...row, status: 'private-code' }] },
    {
      examined: 1,
      next: null,
      results: [{ ...row, status: 'failed', code: 'private-error' }],
    },
    { examined: 2, next: null, results: [row, row] },
    { examined: 21, next: null, results: Array(21).fill(row) },
  ])
    expect(() => incidentRecovery(value)).toThrow();
});
