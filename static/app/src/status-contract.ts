import { APPLICATION_METADATA } from '../../../src/domain/value-objects/application-metadata';
import type { ApplicationStatus } from '../../../src/application/use-cases/get-status';

type Failure =
  | 'response structure'
  | 'application metadata'
  | 'backend status'
  | 'integration status'
  | 'correlation ID';
export type StatusValidation =
  | { readonly valid: true; readonly status: ApplicationStatus }
  | { readonly valid: false; readonly reason: Failure };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate the foundation's literal contract and project only public fields. */
export function validateStatus(value: unknown): StatusValidation {
  if (!isRecord(value)) return { valid: false, reason: 'response structure' };
  const application = value.application;
  if (
    !isRecord(application) ||
    application.name !== APPLICATION_METADATA.name ||
    application.repository !== APPLICATION_METADATA.repository ||
    application.version !== APPLICATION_METADATA.version ||
    application.stage !== APPLICATION_METADATA.stage
  ) {
    return { valid: false, reason: 'application metadata' };
  }
  if (value.backend !== 'available')
    return { valid: false, reason: 'backend status' };
  if (value.integrations !== 'not-configured')
    return { valid: false, reason: 'integration status' };
  // The resolver generates RFC 9562 UUIDv4 IDs with node:crypto.randomUUID.
  if (
    typeof value.correlationId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.correlationId,
    )
  ) {
    return { valid: false, reason: 'correlation ID' };
  }
  return {
    valid: true,
    status: {
      application: {
        name: application.name,
        repository: application.repository,
        version: application.version,
        stage: application.stage,
      },
      backend: value.backend,
      integrations: value.integrations,
      correlationId: value.correlationId,
    },
  };
}
