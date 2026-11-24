// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@forge/bridge', () => ({ invoke }));
import { App } from '../../static/app/src/App';
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
describe('Light House shell (mock bridge)', () => {
  it('shows loading then backend availability without claiming integrations', async () => {
    let resolve: (value: unknown) => void = () => {};
    invoke.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Light House',
    );
    expect(screen.getByRole('status').textContent).toContain('Checking');
    await act(async () => {
      resolve({ backend: 'available' });
    });
    expect(screen.getByRole('status').textContent).toContain(
      'resolver is available',
    );
    expect(screen.getByText(/orchestration are not connected/)).toBeTruthy();
    expect(invoke).toHaveBeenCalledWith('getStatus');
  });
  it('shows an honest unavailable state on bridge failure', async () => {
    invoke.mockRejectedValue(new Error('secret raw backend error'));
    render(<App />);
    expect(
      (await screen.findByText(/Backend status is unavailable/)).textContent,
    ).not.toContain('secret');
  });
  it.each(['resolve', 'reject'])(
    'ignores %s after unmount',
    async (outcome) => {
      let resolve: (value: unknown) => void = () => {};
      let reject: (error: Error) => void = () => {};
      invoke.mockReturnValue(
        new Promise((done, fail) => {
          resolve = done;
          reject = fail;
        }),
      );
      const app = render(<App />);
      app.unmount();
      await act(async () => {
        if (outcome === 'resolve') resolve({});
        else reject(new Error('offline'));
      });
      expect(screen.queryByRole('main')).toBeNull();
    },
  );
});
