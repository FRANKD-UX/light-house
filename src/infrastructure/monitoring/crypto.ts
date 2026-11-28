import { createHash, timingSafeEqual } from 'node:crypto';
import type { MonitoringCrypto } from '../../application/monitoring/ports';
export const monitoringCrypto: MonitoringCrypto = {
  digest: (value) => createHash('sha256').update(value, 'utf8').digest('hex'),
  equalSecret: (expected, actual) =>
    timingSafeEqual(
      createHash('sha256').update(expected, 'utf8').digest(),
      createHash('sha256').update(actual, 'utf8').digest(),
    ),
};
