import { describe, it, expect, vi } from 'vitest';
const { definitions } = vi.hoisted(() => ({
  definitions: new Map<string, () => unknown>(),
}));
vi.mock('@forge/resolver', () => ({
  default: class {
    define(name: string, fn: () => unknown) {
      definitions.set(name, fn);
    }
    getDefinitions() {
      return definitions;
    }
  },
}));
import { handler } from '../../src/index';
describe('Forge status wiring (mock SDK)', () => {
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
