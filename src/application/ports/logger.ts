export interface LogRecord {
  readonly event: 'backend.status' | 'processing.failed';
  readonly correlationId: string;
  readonly outcome: 'success' | 'failure';
}
export interface Logger {
  info(record: LogRecord): void;
  error(record: LogRecord): void;
}
