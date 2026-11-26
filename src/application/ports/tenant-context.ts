// Construct only in trusted Forge boundaries after credential lookup or user authorisation.
// This contract alone does not implement authorisation.
export interface TenantContext {
  readonly installationId: string;
  readonly tenantId: string;
  readonly actor:
    | { readonly kind: 'atlassian-user'; readonly accountId: string }
    | { readonly kind: 'monitoring-source'; readonly sourceId: string }
    | { readonly kind: 'system' };
}
