import { describe, it, expect, vi } from 'vitest';
const { definitions } = vi.hoisted(() => ({
  definitions: new Map<string, (request?: unknown) => unknown>(),
}));
vi.mock('@forge/resolver', () => ({
  default: class {
    define(name: string, fn: (request?: unknown) => unknown) {
      definitions.set(name, fn);
    }
    getDefinitions() {
      return definitions;
    }
  },
}));
import { handler } from '../../src/index';
describe('Forge status wiring (mock SDK)', () => {
  it('registers the inventory boundary and rejects absent trusted identity', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      await definitions.get('inventory')?.({
        context: {},
        payload: { action: 'overview' },
      }),
    ).toMatchObject({ ok: false, code: 'INVALID' });
    log.mockRestore();
  });
  it('registers and executes the read-only status resolver', () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    expect(handler).toBe(definitions);
    const status = definitions.get('getStatus')?.();
    expect(status).toMatchObject({
      backend: 'available',
      integrations: 'not-configured',
      application: { name: 'Light House' },
    });
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
});
