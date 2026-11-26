import { describe, expect, it, vi } from 'vitest';
import { getStatus } from '../../src/application/use-cases/get-status';
import { internalError } from '../../src/application/ports/errors';
import { createCorrelationId } from '../../src/infrastructure/observability/correlation-id';
import { createStructuredLogger } from '../../src/infrastructure/observability/structured-logger';
import { APPLICATION_METADATA } from '../../src/domain/value-objects/application-metadata';
describe('foundation contracts', () => {
  it('reports accurate stage and unconfigured integrations', () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    expect(getStatus(logger, 'correlation')).toEqual({
      application: APPLICATION_METADATA,
      backend: 'available',
      integrations: 'not-configured',
      correlationId: 'correlation',
    });
    expect(logger.info).toHaveBeenCalledWith({
      event: 'backend.status',
      correlationId: 'correlation',
      outcome: 'success',
    });
  });
  it('keeps shared metadata immutable', () => {
    expect(Object.isFrozen(APPLICATION_METADATA)).toBe(true);
    expect(APPLICATION_METADATA.name).toBe('Light House');
  });
  it('creates internal unique UUID correlation IDs', () => {
    const ids = Array.from({ length: 100 }, createCorrelationId);
    expect(new Set(ids).size).toBe(100);
    for (const id of ids)
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
  });
  it('exposes a safe error contract without raw exception details', () => {
    expect(internalError('request-id')).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'The operation could not be completed.',
      retryable: false,
      correlationId: 'request-id',
    });
  });
  it('strips arbitrary runtime fields from both log levels', () => {
    const sink = { info: vi.fn(), error: vi.fn() };
    const logger = createStructuredLogger(sink);
    const record = {
      event: 'processing.failed' as const,
      correlationId: 'id',
      outcome: 'failure' as const,
      authorization: 'must-not-log',
      customer: 'private',
    };
    logger.info(record);
    logger.error(record);
    const expected = JSON.stringify({
      event: record.event,
      correlationId: 'id',
      outcome: 'failure',
    });
    expect(sink.info).toHaveBeenCalledWith(expected);
    expect(sink.error).toHaveBeenCalledWith(expected);
    expect(expected).not.toContain('must-not-log');
  });
});
