import { InventoryError } from '../../domain/inventory/model';
import type {
  InventoryDiagnostics,
  InventoryStage,
} from '../../application/ports/inventory-diagnostics';
import type { Logger } from '../../application/ports/logger';
export const diagnosticCodes = [
  'SQL_EXECUTION_ERROR',
  'INVALID_SQL_QUERY',
  'SQL_POLICY_VIOLATION',
  'QUERY_TIMED_OUT',
  'ER_PARSE_ERROR',
  'ER_WRONG_ARGUMENTS',
  'ER_NO_SUCH_TABLE',
  'ER_BAD_FIELD_ERROR',
  'ER_ACCESS_DENIED_ERROR',
] as const;
// Never inspect messages, stacks, causes or arbitrary debug fields. Accessors can throw.
function property(value: unknown, key: string): unknown {
  try {
    if (value && typeof value === 'object')
      return Object.getOwnPropertyDescriptor(value, key)?.value;
  } catch {
    /* Untrusted exception object. */
  }
  return undefined;
}
function allowedCode(value: unknown): string | undefined {
  return diagnosticCodes.find((code) => code === value);
}
export function exceptionDiagnostic(error: unknown) {
  const code = allowedCode(property(error, 'code'));
  const debug =
    property(property(error, 'context'), 'debug') ?? property(error, 'debug');
  const providerCode = allowedCode(property(debug, 'code'));
  return {
    exceptionCategory:
      error instanceof InventoryError
        ? 'INVENTORY_ERROR'
        : code
          ? 'SQL_ERROR'
          : error instanceof TypeError
            ? 'TYPE_ERROR'
            : error instanceof SyntaxError
              ? 'SYNTAX_ERROR'
              : 'UNKNOWN_ERROR',
    ...(code ? { errorCode: code } : {}),
    ...(providerCode ? { providerCode } : {}),
  };
}
export function createInventoryDiagnostics(
  logger: Logger,
  correlationId: string,
): InventoryDiagnostics {
  return {
    async run<T>(
      stage: InventoryStage,
      work: () => T | Promise<T>,
    ): Promise<T> {
      const start = performance.now();
      const record = {
        event: 'inventory.diagnostic' as const,
        operation: 'inventory.list' as const,
        correlationId,
        stage,
      };
      logger.info({ ...record, outcome: 'started', durationMs: 0 });
      try {
        const value = await work();
        logger.info({
          ...record,
          outcome: 'success',
          durationMs: Math.max(0, Math.round(performance.now() - start)),
        });
        return value;
      } catch (error) {
        logger.error({
          ...record,
          outcome: 'failure',
          durationMs: Math.max(0, Math.round(performance.now() - start)),
          ...exceptionDiagnostic(error),
        });
        throw error;
      }
    },
  };
}
