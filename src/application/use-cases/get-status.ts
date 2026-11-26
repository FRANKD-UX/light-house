import {
  APPLICATION_METADATA,
  type ApplicationMetadata,
} from '../../domain/value-objects/application-metadata';
import type { Logger } from '../ports/logger';
export interface ApplicationStatus {
  readonly application: ApplicationMetadata;
  readonly backend: 'available';
  readonly integrations: 'not-configured';
  readonly correlationId: string;
}
export function getStatus(
  logger: Logger,
  correlationId: string,
): ApplicationStatus {
  logger.info({ event: 'backend.status', correlationId, outcome: 'success' });
  return {
    application: APPLICATION_METADATA,
    backend: 'available',
    integrations: 'not-configured',
    correlationId,
  };
}
