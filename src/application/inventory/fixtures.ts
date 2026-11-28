import type { Fields, Kind } from '../../domain/inventory/model';
export interface Fixture {
  key: string;
  entity: Kind;
  status: string;
  fields: Fields;
  refs?: Record<string, string>;
}
// Stable natural fixture keys, server-generated opaque UUIDs. No real accounts or contacts.
export const fixtures: Fixture[] = [
  ...['copper-kite', 'blue-lantern'].map((key) => ({
    key,
    entity: 'carriers' as const,
    status: 'active',
    fields: {
      code: key,
      display_name: key === 'copper-kite' ? 'Copper Kite' : 'Blue Lantern',
    },
  })),
  ...['enterprise', 'standard'].map((key) => ({
    key,
    entity: 'sla_tiers' as const,
    status: 'active',
    fields: { code: key, name: `Demonstration ${key}` },
  })),
  ...['enterprise', 'standard'].map((key) => ({
    key: key + '-policy',
    entity: 'sla_policy_versions' as const,
    status: 'draft',
    fields: { ...demoPolicy(''), tier_id: null },
    refs: { tier_id: key },
  })),
  ...['noc', 'engineering', 'core-response'].map((key) => ({
    key,
    entity: 'teams' as const,
    status: 'active',
    fields: {
      code: key,
      name:
        key === 'noc'
          ? 'Access NOC'
          : key === 'engineering'
            ? 'Network Engineering'
            : 'Core Response',
    },
  })),
  ...['noc-engineer', 'network-engineer'].map((key) => ({
    key,
    entity: 'assignees' as const,
    status: 'unmapped',
    fields: {
      display_alias: `Synthetic ${key}`,
      atlassian_account_id: null,
      mapping_method: 'manual',
    },
  })),
  {
    key: 'noc-membership',
    entity: 'team_memberships',
    status: 'active',
    fields: { role: 'engineer', effective_until: null },
    refs: { team_id: 'noc', assignee_id: 'noc-engineer' },
  },
  {
    key: 'engineering-membership',
    entity: 'team_memberships',
    status: 'active',
    fields: { role: 'engineer', effective_until: null },
    refs: { team_id: 'engineering', assignee_id: 'network-engineer' },
  },
  ...['hill', 'harbour', 'metro'].flatMap((site) => [
    {
      key: site,
      entity: 'sites' as const,
      status: 'active',
      fields: {
        code: site,
        display_name:
          site === 'metro'
            ? 'Metro Core'
            : `${site === 'hill' ? 'Hill' : 'Harbour'} POP`,
      },
    },
    {
      key: `${site}-primary`,
      entity: 'uplinks' as const,
      status: 'active',
      fields: {
        code: 'primary',
        role: 'primary',
        capacity_mbps: 1000,
        protected_uplink_id: null,
      },
      refs: { site_id: site, carrier_id: 'copper-kite' },
    },
    {
      key: `${site}-backup`,
      entity: 'uplinks' as const,
      status: 'active',
      fields: { code: 'backup', role: 'backup', capacity_mbps: 500 },
      refs: {
        site_id: site,
        carrier_id: 'blue-lantern',
        protected_uplink_id: `${site}-primary`,
      },
    },
  ]),
  ...Array.from({ length: 6 }, (_, i) => {
    const key = `customer-${i + 1}`;
    const site = ['hill', 'harbour', 'metro'][i % 3]!;
    return {
      key,
      entity: 'customers' as const,
      status: 'active',
      fields: {
        reference: `DEMO-${i + 1}`,
        display_alias: `Synthetic subscriber ${i + 1}`,
      },
      refs: { site_id: site, sla_tier_id: i % 2 ? 'standard' : 'enterprise' },
    };
  }),
  ...Array.from({ length: 8 }, (_, i) => {
    const customer = i < 6 ? i : i - 6;
    const site = ['hill', 'harbour', 'metro'][customer % 3]!;
    return {
      key: `service-${i + 1}`,
      entity: 'customer_services' as const,
      status: 'active',
      fields: { code: `SERVICE-${i + 1}` },
      refs: {
        customer_id: `customer-${customer + 1}`,
        site_id: site,
        tier_id: customer % 2 ? 'standard' : 'enterprise',
      },
    };
  }),
  ...Array.from({ length: 7 }, (_, i) => {
    const customer = i < 6 ? i : 0;
    const site = ['hill', 'harbour', 'metro'][customer % 3]!;
    return {
      key: `dependency-${i + 1}`,
      entity: 'service_dependencies' as const,
      status: 'active',
      fields: {
        dependency_mode: i === 0 ? 'failover' : 'required',
        failover_group: i === 0 ? 'hill-resilience' : null,
      },
      refs: { service_id: `service-${i + 1}`, uplink_id: `${site}-primary` },
    };
  }),
  {
    key: 'dependency-backup',
    entity: 'service_dependencies',
    status: 'active',
    fields: { dependency_mode: 'failover', failover_group: 'hill-resilience' },
    refs: { service_id: 'service-1', uplink_id: 'hill-backup' },
  },
];
// Service 8 deliberately has no infrastructure mapping. Event/impact engines are later sprint work.
export function demoPolicy(tierId: string): Fields {
  return {
    approved_by: null,
    tier_id: tierId,
    version_number: 1,
    effective_from: '2026-01-01T00:00:00.000Z',
    effective_until: null,
    unknown_impact_rule: 'manual-review',
    priority_map: 'demonstration-only',
    p1_duration_seconds: 3600,
    p1_warning_seconds: 1800,
    p2_duration_seconds: 7200,
    p2_warning_seconds: 3600,
    p3_duration_seconds: 14400,
    p3_warning_seconds: 7200,
  };
}
