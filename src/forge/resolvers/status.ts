import Resolver from '@forge/resolver';
import { getStatus } from '../../application/use-cases/get-status';
import { createCorrelationId } from '../../infrastructure/observability/correlation-id';
import { createStructuredLogger } from '../../infrastructure/observability/structured-logger';
import { inventoryRequest } from '../inventory/boundary';
import { monitoringRequest } from '../monitoring/runtime';
const resolver = new Resolver();
resolver.define('monitoring', ({ context, payload }) =>
  monitoringRequest(context, payload),
);
resolver.define('inventory', ({ context, payload }) =>
  inventoryRequest(context, payload),
);
// Public application metadata only; future tenant/configuration methods need backend permission checks.
resolver.define('getStatus', () =>
  getStatus(createStructuredLogger(console), createCorrelationId()),
);
export const handler = resolver.getDefinitions();
