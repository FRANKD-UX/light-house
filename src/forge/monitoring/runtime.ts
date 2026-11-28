import { forgeMonitoringSecrets } from '../../infrastructure/monitoring/kvs-secrets';
import { createMonitoringHandlers } from './handlers';
import { enrichMonitoringReceipt } from '../incidents/runtime';
const handlers = createMonitoringHandlers(
  forgeMonitoringSecrets,
  enrichMonitoringReceipt,
);
export const monitoringIngress = handlers.ingress;
export const monitoringRequest = handlers.request;
export const monitoringConsume = handlers.consume;
export const monitoringMigrate = handlers.migrate;
