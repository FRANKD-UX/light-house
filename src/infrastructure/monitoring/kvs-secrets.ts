import { kvs } from '@forge/kvs';
import type { MonitoringSecrets } from '../../application/monitoring/ports';
import type { SecretBinding } from '../../domain/monitoring/model';
// Narrow secret-only client: no plaintext KVS or SQL credential storage.
export interface KvsSecretClient {
  setSecret(
    key: string,
    value: SecretBinding,
    options: { keyPolicy: 'FAIL_IF_EXISTS' },
  ): Promise<void>;
  getSecret(key: string): Promise<unknown>;
  deleteSecret(key: string): Promise<void>;
}
export function createKvsSecretStore(
  client: KvsSecretClient,
): MonitoringSecrets {
  return {
    put: (key, value) =>
      client.setSecret(key, value, { keyPolicy: 'FAIL_IF_EXISTS' }),
    get: (key) => client.getSecret(key),
    remove: (key) => client.deleteSecret(key),
  };
}

export const forgeMonitoringSecrets = createKvsSecretStore(kvs);
