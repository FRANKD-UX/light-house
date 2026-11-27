export interface LogRecord {
  readonly event:
    'backend.status' | 'processing.failed' | 'inventory.diagnostic';
  readonly correlationId: string;
  readonly outcome: 'success' | 'failure' | 'started';
  readonly operation?: 'inventory.list';
  readonly stage?: import('./inventory-diagnostics').InventoryStage;
  readonly durationMs?: number;
  readonly exceptionCategory?: string;
  readonly errorCode?: string;
  readonly providerCode?: string;
}
export interface Logger {
  info(record: LogRecord): void;
  error(record: LogRecord): void;
}
