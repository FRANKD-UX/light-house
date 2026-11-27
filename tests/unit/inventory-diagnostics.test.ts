import { describe, expect, it, vi } from 'vitest';
import {
  exceptionDiagnostic,
  createInventoryDiagnostics,
} from '../../src/infrastructure/observability/inventory-diagnostics';
import { createStructuredLogger } from '../../src/infrastructure/observability/structured-logger';

describe('bounded diagnostic privacy', () => {
  it('redacts unknown codes, nested messages, raw values and throwing accessors', () => {
    for (const error of [
      null,
      'secret',
      {
        code: 'private-account',
        context: { debug: { code: 'token', message: 'private' } },
      },
      {
        get code() {
          throw new Error('secret');
        },
      },
    ]) {
      expect(exceptionDiagnostic(error)).toEqual({
        exceptionCategory: 'UNKNOWN_ERROR',
      });
    }
    expect(exceptionDiagnostic(new SyntaxError('secret'))).toEqual({
      exceptionCategory: 'SYNTAX_ERROR',
    });
    expect(
      exceptionDiagnostic({
        code: 'INVALID_SQL_QUERY',
        debug: { code: 'ER_WRONG_ARGUMENTS' },
      }),
    ).toEqual({
      exceptionCategory: 'SQL_ERROR',
      errorCode: 'INVALID_SQL_QUERY',
      providerCode: 'ER_WRONG_ARGUMENTS',
    });
  });
  it('filters unexpected diagnostic field values at the logging sink', async () => {
    const sink = { info: vi.fn(), error: vi.fn() };
    const logger = createStructuredLogger(sink);
    logger.error({
      event: 'inventory.diagnostic',
      correlationId: 'id',
      outcome: 'failure',
      operation: 'private',
      stage: 'secret',
      exceptionCategory: 'token',
      errorCode: 'customer',
      providerCode: 'account',
      durationMs: -1,
    } as never);
    expect(sink.error).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'inventory.diagnostic',
        correlationId: 'id',
        outcome: 'failure',
      }),
    );
    const trace = createInventoryDiagnostics(logger, 'id');
    await expect(
      trace.run('inventory.sql', () => {
        throw new Error('private');
      }),
    ).rejects.toThrow('private');
    expect(sink.error.mock.lastCall![0]).not.toContain('private');
  });
});
