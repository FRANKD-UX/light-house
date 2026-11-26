export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHORISED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'INTERNAL_ERROR';
export interface ApplicationError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly correlationId: string;
}
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ApplicationError };
// Never serialize an arbitrary exception, payload or credential to a caller.
export function internalError(correlationId: string): ApplicationError {
  return {
    code: 'INTERNAL_ERROR',
    message: 'The operation could not be completed.',
    retryable: false,
    correlationId,
  };
}
