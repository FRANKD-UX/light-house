import { inventoryStages } from '../../application/ports/inventory-diagnostics';
import { diagnosticCodes } from './inventory-diagnostics';
import type { Logger, LogRecord } from '../../application/ports/logger';
interface LogSink {
  info(message: string): void;
  error(message: string): void;
}
// Field allowlisting also strips unexpected properties at runtime.
function serialize(record: LogRecord): string {
  return JSON.stringify({
    event: record.event,
    correlationId: record.correlationId,
    outcome: record.outcome,
    ...(record.event === 'monitoring.ingress'
      ? {
          monitoringResult: [
            'accepted',
            'invalid',
            'unauthorised',
            'conflict',
            'too_large',
            'method',
            'rate_limited',
            'unavailable',
          ].find((code) => code === record.monitoringResult),
        }
      : {}),
    ...(record.event === 'inventory.diagnostic'
      ? {
          operation:
            record.operation === 'inventory.list'
              ? record.operation
              : undefined,
          stage: inventoryStages.find((stage) => stage === record.stage),
          durationMs:
            Number.isSafeInteger(record.durationMs) && record.durationMs! >= 0
              ? record.durationMs
              : undefined,
          exceptionCategory: [
            'INVENTORY_ERROR',
            'SQL_ERROR',
            'TYPE_ERROR',
            'SYNTAX_ERROR',
            'UNKNOWN_ERROR',
          ].find((category) => category === record.exceptionCategory),
          errorCode: diagnosticCodes.find((code) => code === record.errorCode),
          providerCode: diagnosticCodes.find(
            (code) => code === record.providerCode,
          ),
        }
      : {}),
  });
}
export function createStructuredLogger(sink: LogSink): Logger {
  return {
    info: (record) => sink.info(serialize(record)),
    error: (record) => sink.error(serialize(record)),
  };
}
