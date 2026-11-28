import { afterEach, describe, expect, it, vi } from 'vitest';
import { handler } from '../../src/index';
afterEach(() => vi.restoreAllMocks());
describe('resolver initialization and serialization (real SDKs, local only)', () => {
  it('runs SQL-independent health through the real resolver dispatch envelope', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const result = await handler(
      { call: { functionKey: 'getStatus' }, context: {} },
      {},
    );
    expect(result).toMatchObject({
      backend: 'available',
      application: { name: 'Light House' },
    });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});
