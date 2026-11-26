import Resolver from '@forge/resolver';
import { getStatus } from '../../application/use-cases/get-status';
import { createCorrelationId } from '../../infrastructure/observability/correlation-id';
import { createStructuredLogger } from '../../infrastructure/observability/structured-logger';
const resolver = new Resolver();
// Public application metadata only; future tenant/configuration methods need backend permission checks.
resolver.define('getStatus', () =>
  getStatus(createStructuredLogger(console), createCorrelationId()),
);
export const handler = resolver.getDefinitions();
