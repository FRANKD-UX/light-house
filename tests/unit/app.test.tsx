// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { APPLICATION_METADATA } from '../../src/domain/value-objects/application-metadata';
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@forge/bridge', () => ({ invoke }));
import { App } from '../../static/app/src/App';
const valid = {
  application: { ...APPLICATION_METADATA },
  backend: 'available',
  integrations: 'not-configured',
  correlationId: '12345678-1234-4234-8234-123456789abc',
};
const invalidResponses: [string, unknown][] = [
  ['null', null],
  ['array', []],
  ['string', 'private response'],
  ['undefined', undefined],
  ['missing properties', {}],
  ...Object.keys(valid).map((key): [string, unknown] => [
    `missing ${key}`,
    Object.fromEntries(Object.entries(valid).filter(([name]) => name !== key)),
  ]),
  ...Object.keys(APPLICATION_METADATA).map((key): [string, unknown] => [
    `invalid metadata ${key}`,
    { ...valid, application: { ...valid.application, [key]: 'private data' } },
  ]),
  ['null metadata', { ...valid, application: null }],
  ['array metadata', { ...valid, application: [] }],
  ['invalid backend', { ...valid, backend: 'unavailable' }],
  ['invalid integration', { ...valid, integrations: 'ready' }],
  ['invalid correlation', { ...valid, correlationId: 'private data' }],
  ['numeric correlation', { ...valid, correlationId: 42 }],
  [
    'invalid UUID version',
    { ...valid, correlationId: '12345678-1234-0234-8234-123456789abc' },
  ],
  [
    'invalid UUID variant',
    { ...valid, correlationId: '12345678-1234-4234-1234-123456789abc' },
  ],
];
function runCheck() {
  fireEvent.click(screen.getByRole('button', { name: 'Run health check' }));
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
describe('Light House diagnostics (mock Forge Bridge, not installed-runtime evidence)', () => {
  it('waits for a manual check, validates actual metadata and prevents overlapping requests', async () => {
    let resolve!: (value: unknown) => void;
    invoke.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Light House',
    );
    expect(invoke).not.toHaveBeenCalled();
    expect(
      screen.getByRole('status', { name: 'Foundation health' }).textContent,
    ).toBe('Health check not run.');
    runCheck();
    runCheck();
    expect(
      screen.getByRole('status', { name: 'Foundation health' }).textContent,
    ).toContain('Checking');
    expect(
      (
        screen.getByRole('button', {
          name: 'Run health check',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve({
        ...valid,
        secret: 'must-not-display',
        application: { ...valid.application, accountId: 'must-not-display' },
      });
    });
    expect(
      screen.getByRole('status', { name: 'Foundation health' }).textContent,
    ).toContain('Health check passed');
    expect(screen.getByText('Resolved')).toBeTruthy();
    expect(screen.getByText('available')).toBeTruthy();
    expect(screen.getByText('Valid')).toBeTruthy();
    expect(screen.getByText('not-configured')).toBeTruthy();
    expect(
      screen.getByText(`${valid.correlationId} (valid UUIDv4)`),
    ).toBeTruthy();
    expect(
      screen.getByText(/Light House \/ light-house \/ 0.1.0/),
    ).toBeTruthy();
    expect(screen.getByText(/orchestration are not connected/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('must-not-display');
    expect(invoke).toHaveBeenCalledWith('getStatus');
  });
  it.each(invalidResponses)(
    'fails closed for %s and allows a successful manual retry',
    async (_, response) => {
      invoke.mockResolvedValueOnce(response).mockResolvedValueOnce(valid);
      render(<App />);
      runCheck();
      await screen.findByText(/Health check failed: invalid/);
      expect(screen.queryByText('available')).toBeNull();
      expect(screen.queryByText('Valid')).toBeNull();
      expect(screen.queryByText('not-configured')).toBeNull();
      expect(document.body.textContent).not.toContain('private data');
      expect(screen.getByText('Not verified')).toBeTruthy();
      expect(screen.getByText('Resolved')).toBeTruthy();
      runCheck();
      await screen.findByText(/Health check passed/);
      expect(invoke).toHaveBeenCalledTimes(2);
    },
  );
  it('sanitises rejected invocations, clears previous success and permits retry', async () => {
    invoke
      .mockResolvedValueOnce(valid)
      .mockRejectedValueOnce(new Error('secret raw backend error'))
      .mockResolvedValueOnce(valid);
    render(<App />);
    runCheck();
    await screen.findByText(/Health check passed/);
    runCheck();
    await screen.findByText(/Forge Bridge invocation rejected/);
    expect(screen.getByText('Rejected')).toBeTruthy();
    expect(document.body.textContent).not.toContain('secret');
    expect(document.body.textContent).not.toContain(valid.correlationId);
    runCheck();
    await screen.findByText(/Health check passed/);
  });
  it('handles synchronous bridge failure without leaking details', async () => {
    invoke.mockImplementation(() => {
      throw new Error('private');
    });
    render(<App />);
    runCheck();
    await screen.findByText(/Forge Bridge invocation rejected/);
    expect(document.body.textContent).not.toContain('private');
  });
  it.each(['resolve', 'reject'])(
    'ignores %s after unmount',
    async (outcome) => {
      let resolve!: (value: unknown) => void;
      let reject!: (error: Error) => void;
      invoke.mockReturnValue(
        new Promise((done, fail) => {
          resolve = done;
          reject = fail;
        }),
      );
      const app = render(<App />);
      runCheck();
      app.unmount();
      await act(async () => {
        if (outcome === 'resolve') resolve(valid);
        else reject(new Error('offline'));
      });
      expect(screen.queryByRole('main')).toBeNull();
    },
  );
});
