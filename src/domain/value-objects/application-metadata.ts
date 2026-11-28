export const APPLICATION_METADATA = Object.freeze({
  name: 'Light House',
  repository: 'light-house',
  version: '0.1.0',
  stage: 'Sprint 1 — tenancy and synthetic inventory',
} as const);
export type ApplicationMetadata = typeof APPLICATION_METADATA;
