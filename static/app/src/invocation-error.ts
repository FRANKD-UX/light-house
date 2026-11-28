// Classify reported failures locally; never render or log arbitrary exception text.
export function invocationFailure(error: unknown): string {
  const value =
    error && typeof error === 'object'
      ? (error as Record<string, unknown>)
      : {};
  const code = typeof value.code === 'string' ? value.code : '';
  const name = typeof value.name === 'string' ? value.name : '';
  const message =
    typeof value.message === 'string' ? value.message.slice(0, 2048) : '';
  const category =
    ['TIMEOUT', 'ETIMEDOUT'].includes(code) ||
    name === 'TimeoutError' ||
    /\b(timed out|timeout)\b/i.test(message)
      ? 'reported timeout'
      : ['UNAUTHENTICATED', 'AUTHENTICATION_REQUIRED'].includes(code) ||
          name === 'NeedsAuthenticationError'
        ? 'authentication required'
        : code === 'FORBIDDEN'
          ? 'access forbidden'
          : code === 'RATE_LIMITED'
            ? 'rate limited'
            : name === 'BridgeAPIError'
              ? 'Bridge API error'
              : name === 'TypeError'
                ? 'TypeError'
                : name === 'ReferenceError'
                  ? 'ReferenceError'
                  : 'unclassified rejection';
  return `Forge Bridge invocation rejected (${category}). Backend completion is unverified.`;
}

const backendCodes = [
  'INVALID',
  'DENIED',
  'NOT_FOUND',
  'CONFLICT',
  'REPAIR_REQUIRED',
  'NOT_READY',
  'UNAVAILABLE',
] as const;
type BackendCode = (typeof backendCodes)[number];
export class BackendFailure extends Error {
  constructor(
    readonly code: BackendCode,
    readonly correlationId: string | undefined,
  ) {
    super(code);
  }
}
export function inventoryResponse(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('INVALID_RESPONSE');
  const value = input as Record<string, unknown>;
  if (value.ok === true) return value.value;
  if (value.ok !== false) throw new Error('INVALID_RESPONSE');
  const code = backendCodes.find((code) => code === value.code);
  if (!code) throw new Error('INVALID_RESPONSE');
  const correlationId =
    typeof value.correlationId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.correlationId,
    )
      ? value.correlationId
      : undefined;
  throw new BackendFailure(code, correlationId);
}

export class InvocationFailure extends Error {
  constructor(error: unknown) {
    super(invocationFailure(error));
  }
}
