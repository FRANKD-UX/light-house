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
  });
}
export function createStructuredLogger(sink: LogSink): Logger {
  return {
    info: (record) => sink.info(serialize(record)),
    error: (record) => sink.error(serialize(record)),
  };
}
