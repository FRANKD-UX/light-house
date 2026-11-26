// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@forge/bridge', () => ({ invoke }));
import { Inventory } from '../../static/app/src/Inventory';
import { demoPolicy } from '../../src/application/inventory/fixtures';
import {
  inventoryValue,
  validateInventoryList,
} from '../../static/app/src/inventory-contract';
import type { InventoryRecord } from '../../src/domain/inventory/model';
const tenantId = randomUUID();
const record: InventoryRecord = {
  id: randomUUID(),
  tenant_id: tenantId,
  status: 'active',
  version: 1,
  created_at: '2026-11-26T00:00:00.000Z',
  updated_at: '2026-11-26T00:00:00.000Z',
  fixture_key: null,
  pending: null,
  fields: { code: 'hill', display_name: 'Hill POP' },
};
const overview = {
  ready: true,
  development: true,
  canBootstrap: true,
  tenants: [{ tenantId, name: 'Lantern Fibre', role: 'admin', version: 2 }],
};
let listRows: InventoryRecord[] = [];
let next: string | null = null;
let seedNext: number | null = 4;
function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
async function click(name: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}
async function load() {
  await click('Load tenants and schema status');
  change('Authorised ISP', tenantId);
}
beforeEach(() => {
  listRows = [];
  next = null;
  seedNext = 4;
  invoke.mockImplementation(
    async (_name: string, payload: { action: string }) => ({
      ok: true,
      value:
        payload.action === 'overview'
          ? overview
          : payload.action === 'list'
            ? { rows: listRows, next }
            : payload.action === 'seed'
              ? { next: seedNext }
              : {},
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
describe('inventory Custom UI (mock Bridge, no installed runtime evidence)', () => {
  it('starts empty, waits for explicit actions and presents loading and sanitized errors', async () => {
    render(<Inventory />);
    expect(invoke).not.toHaveBeenCalled();
    expect(screen.getByText('Inventory not loaded.')).toBeTruthy();
    let resolve!: (value: unknown) => void;
    invoke.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Load tenants and schema status' }),
    );
    expect(screen.getByText('Loading inventory…')).toBeTruthy();
    expect(
      (
        screen.getByRole('button', {
          name: 'Load tenants and schema status',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await act(async () => {
      resolve({
        ok: true,
        value: {
          ...overview,
          ready: false,
          schemaStatus: 'failed',
          tenants: [],
        },
      });
    });
    expect(screen.getByText('Schema: failed')).toBeTruthy();
    for (const [code, expected] of [
      ['CONFLICT', 'Conflict:'],
      ['INVALID', 'Validation failed'],
      ['REPAIR_REQUIRED', 'Repair required'],
      ['DENIED', 'Access denied'],
      ['RAW_PRIVATE', 'Inventory unavailable'],
    ]) {
      invoke.mockResolvedValueOnce({ ok: false, code });
      await click('Load tenants and schema status');
      expect(screen.getByText(new RegExp(expected!))).toBeTruthy();
    }
    invoke.mockRejectedValueOnce('private token');
    await click('Load tenants and schema status');
    expect(document.body.textContent).not.toContain('private token');
    invoke.mockResolvedValueOnce({ ok: false });
    await click('Load tenants and schema status');
    expect(screen.getByText(/Inventory unavailable/)).toBeTruthy();
  });
  it('shows an empty membership state without inventing access or infrastructure', async () => {
    invoke.mockResolvedValueOnce({
      ok: true,
      value: {
        ready: true,
        canBootstrap: false,
        development: false,
        tenants: [],
      },
    });
    render(<Inventory />);
    await click('Load tenants and schema status');
    expect(screen.getByText(/No authorised ISP memberships/)).toBeTruthy();
    expect(screen.queryByText('Queue development migration')).toBeNull();
  });
  it('bootstraps, migrates and seeds bounded batches without polling', async () => {
    render(<Inventory />);
    await load();
    await click('Queue development migration');
    expect(screen.getByText(/Migration queued/)).toBeTruthy();
    change('Demonstration ISP', 'beacon-transit');
    await click('Bootstrap selected ISP');
    expect(invoke).toHaveBeenCalledWith(
      'inventory',
      expect.objectContaining({
        action: 'bootstrap',
        slug: 'beacon-transit',
        name: 'Beacon Transit',
      }),
    );
    change('Demonstration ISP', 'lantern-fibre');
    await click('Bootstrap selected ISP');
    expect(invoke).toHaveBeenCalledWith(
      'inventory',
      expect.objectContaining({ name: 'Lantern Fibre' }),
    );
    await click(/Seed next batch/);
    expect(
      screen.getByRole('button', { name: /Seed next batch \(4/ }),
    ).toBeTruthy();
    seedNext = null;
    await click(/Seed next batch/);
    expect(
      screen.getByRole('button', { name: /Seed next batch \(0/ }),
    ).toBeTruthy();
  });
  it('lists pages, edits with expected version, repairs and clears tenant state', async () => {
    listRows = [{ ...record, pending: 'repair-required' }];
    next = record.id;
    render(<Inventory />);
    await load();
    await click('Load inventory');
    expect(screen.getByText('Hill POP', { exact: false })).toBeTruthy();
    await click('Next page');
    expect(invoke).toHaveBeenCalledWith(
      'inventory',
      expect.objectContaining({ after: record.id }),
    );
    await click('Repair');
    await click('Edit');
    change('display_name', 'Renamed synthetic POP');
    change('Lifecycle', 'maintenance');
    await act(async () => {
      fireEvent.submit(
        screen.getByRole('button', { name: 'Save record' }).closest('form')!,
      );
    });
    expect(invoke).toHaveBeenCalledWith(
      'inventory',
      expect.objectContaining({
        action: 'save',
        id: record.id,
        expected: 1,
        status: 'maintenance',
        fields: { code: 'hill', display_name: 'Renamed synthetic POP' },
      }),
    );
    await click('New record');
    change('code', 'other');
    change('display_name', 'Other');
    change('display_name', '');
    await act(async () => {
      fireEvent.submit(
        screen.getByRole('button', { name: 'Save record' }).closest('form')!,
      );
    });
    expect(invoke).toHaveBeenCalledWith(
      'inventory',
      expect.objectContaining({
        action: 'save',
        fields: { code: 'other', display_name: null },
      }),
    );
    change('Authorised ISP', '');
    expect(screen.queryByRole('table')).toBeNull();
  });
  it('handles reference, choice, numeric and optional inputs and publishes an immutable policy', async () => {
    render(<Inventory />);
    await load();
    change('Inventory type', 'uplinks');
    change('site_id', randomUUID());
    change('carrier_id', randomUUID());
    change('code', 'link');
    change('role', 'backup');
    change('capacity_mbps', '1000');
    change('protected_uplink_id (optional)', record.id);
    await act(async () => {
      fireEvent.submit(
        screen.getByRole('button', { name: 'Save record' }).closest('form')!,
      );
    });
    expect(invoke).toHaveBeenCalledWith(
      'inventory',
      expect.objectContaining({
        fields: expect.objectContaining({
          capacity_mbps: 1000,
          role: 'backup',
        }),
      }),
    );
    change('Inventory type', 'sla_policy_versions');
    listRows = [
      { ...record, status: 'draft', fields: demoPolicy(randomUUID()) },
    ];
    await click('Load inventory');
    await click('Edit');
    change('Expected tier version', '2');
    await click('Publish new immutable demonstration policy');
    expect(invoke).toHaveBeenCalledWith(
      'inventory',
      expect.objectContaining({ action: 'publish', expectedTierVersion: 2 }),
    );
  });
  it('grants and revokes independent ISP access with explicit expected versions', async () => {
    render(<Inventory />);
    await load();
    change('Atlassian account ID', 'consenting-test-user');
    change('Access role', 'operator');
    await act(async () => {
      fireEvent.submit(
        screen
          .getByRole('button', { name: 'Save access grant' })
          .closest('form')!,
      );
    });
    expect(invoke).toHaveBeenCalledWith(
      'inventory',
      expect.objectContaining({
        action: 'grant',
        role: 'operator',
        expected: null,
        expiresAt: null,
      }),
    );
    change('Expected grant version (empty for new grant)', '1');
    change('Grant lifecycle', 'revoked');
    await act(async () => {
      fireEvent.submit(
        screen
          .getByRole('button', { name: 'Save access grant' })
          .closest('form')!,
      );
    });
    expect(invoke).toHaveBeenCalledWith(
      'inventory',
      expect.objectContaining({ status: 'revoked', expected: 1 }),
    );
  });
  it('submits ISP lifecycle configuration and creates an explicit repair probe', async () => {
    render(<Inventory />);
    await load();
    await click('Create synthetic partial-write repair probe');
    await click('Repair pending ISP mutation');
    change('ISP name', 'Renamed synthetic ISP');
    change('Expected ISP version', '2');
    change('ISP lifecycle', 'suspended');
    await act(async () => {
      fireEvent.submit(
        screen
          .getByRole('button', { name: 'Save ISP configuration' })
          .closest('form')!,
      );
    });
    expect(invoke).toHaveBeenCalledWith(
      'inventory',
      expect.objectContaining({
        action: 'configureTenant',
        name: 'Renamed synthetic ISP',
        expected: 2,
        status: 'suspended',
      }),
    );
  });
  it('hides mutation controls for viewers and rejects malformed list responses', async () => {
    invoke.mockResolvedValueOnce({
      ok: true,
      value: {
        ...overview,
        canBootstrap: false,
        development: false,
        tenants: [{ tenantId, name: 'Viewer ISP', role: 'viewer', version: 2 }],
      },
    });
    render(<Inventory />);
    await load();
    expect(screen.queryByText('Save record')).toBeNull();
    listRows = [{ ...record, fields: { invalid: 'bad' } }];
    await click('Load inventory');
    expect(screen.getByText(/Validation failed/)).toBeTruthy();
  });
});
describe('inventory response contract', () => {
  it('rejects malformed envelopes and lists before rendering', () => {
    for (const input of [
      null,
      [],
      { ready: true, development: true, canBootstrap: true, tenants: {} },
      { ...overview, tenants: Array(51).fill({}) },
    ])
      expect(() => inventoryValue('overview', input)).toThrow();
    for (const input of [
      { rows: null, next: null },
      { rows: Array(51).fill(record), next: null },
      { rows: [{ ...record, pending: 'raw secret' }], next: null },
      { rows: [], next: 'bad-id' },
    ])
      expect(() => inventoryValue('list', input)).toThrow();
    expect(
      inventoryValue('list', { rows: [record], next: record.id }),
    ).toBeTruthy();
    validateInventoryList('sites', { rows: [record] });
  });
});
