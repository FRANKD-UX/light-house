import { randomUUID } from 'node:crypto';
// Always generated internally; untrusted inbound IDs must never become log fields.
export function createCorrelationId(): string {
  return randomUUID();
}
