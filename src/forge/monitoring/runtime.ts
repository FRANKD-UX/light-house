import { forgeMonitoringSecrets } from '../../infrastructure/monitoring/kvs-secrets';
import { createMonitoringHandlers } from './handlers';
const handlers = createMonitoringHandlers(forgeMonitoringSecrets);
export const monitoringIngress = handlers.ingress;
export const monitoringRequest = handlers.request;
export const monitoringConsume = handlers.consume;
export const monitoringMigrate = handlers.migrate;
