import { describe, expect, it } from 'vitest';
import {
  BackendFailure,
  inventoryResponse,
  invocationFailure,
} from '../../static/app/src/invocation-error';
describe('sanitised invocation diagnostics (synthetic errors)', () => {
  it.each([
    [{ code: 'ETIMEDOUT', message: 'private' }, 'reported timeout'],
    [new Error('request timed out with private payload'), 'reported timeout'],
    [{ code: 'AUTHENTICATION_REQUIRED' }, 'authentication required'],
    [{ code: 'FORBIDDEN' }, 'access forbidden'],
    [{ code: 'RATE_LIMITED' }, 'rate limited'],
    [{ name: 'BridgeAPIError' }, 'Bridge API error'],
    [new TypeError('private'), 'TypeError'],
    [new ReferenceError('private'), 'ReferenceError'],
    [null, 'unclassified rejection'],
    ['private timeout', 'unclassified rejection'],
    [
      { code: 'private', name: 'private', stack: 'private' },
      'unclassified rejection',
    ],
  ])(
    'preserves the reported category without exception details',
    (error, category) => {
      const diagnostic = invocationFailure(error);
      expect(diagnostic).toContain(category);
      expect(diagnostic).not.toContain('private');
      expect(diagnostic).toContain('unverified');
    },
  );
  it.each([
    'NOT_READY',
    'UNAVAILABLE',
    'DENIED',
    'INVALID',
    'CONFLICT',
    'NOT_FOUND',
    'REPAIR_REQUIRED',
  ])('retains handled backend %s', (code) => {
    try {
      inventoryResponse({
        ok: false,
        code,
        correlationId: '12345678-1234-4234-8234-123456789abc',
        extra: 'private',
      });
    } catch (error) {
      expect(error).toBeInstanceOf(BackendFailure);
      expect(error).toMatchObject({
        code,
        correlationId: '12345678-1234-4234-8234-123456789abc',
      });
      return;
    }
    throw new Error('Expected rejection');
  });
  it('does not expose malformed envelopes, arbitrary codes or invalid correlations', () => {
    for (const value of [
      null,
      [],
      {},
      { ok: false, code: 'private' },
      { ok: 'yes' },
    ])
      expect(() => inventoryResponse(value)).toThrow('INVALID_RESPONSE');
    expect(() =>
      inventoryResponse({
        ok: false,
        code: 'DENIED',
        correlationId: 'private',
      }),
    ).toThrow(BackendFailure);
    expect(inventoryResponse({ ok: true, value: { ready: true } })).toEqual({
      ready: true,
    });
  });
});
