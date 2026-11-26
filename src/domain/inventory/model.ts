// Public, bundle-safe Sprint 1 contracts. No backend SDKs or credentials.
export type Scalar = string | number | null;
export type Fields = Record<string, Scalar>;
export const kinds = [
  'sites',
  'carriers',
  'uplinks',
  'customers',
  'customer_services',
  'service_dependencies',
  'teams',
  'assignees',
  'team_memberships',
  'sla_tiers',
  'sla_policy_versions',
] as const;
export type Kind = (typeof kinds)[number];
export interface InventoryRecord {
  id: string;
  tenant_id: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
  fixture_key: string | null;
  pending: string | null;
  fields: Fields;
}
export type Role = 'viewer' | 'operator' | 'admin';
export type FailureCode =
  | 'INVALID'
  | 'DENIED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'REPAIR_REQUIRED'
  | 'NOT_READY'
  | 'UNAVAILABLE';
export class InventoryError extends Error {
  constructor(readonly code: FailureCode) {
    super(code);
  }
}
export function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new InventoryError('INVALID');
  return input as Record<string, unknown>;
}
export function text(input: unknown, max = 120): string {
  if (
    typeof input !== 'string' ||
    input.length < 1 ||
    input.length > max ||
    input.trim() !== input ||
    Array.from(input).some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
  )
    throw new InventoryError('INVALID');
  return input;
}
export function uuid(input: unknown): string {
  const value = text(input, 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value,
    )
  )
    throw new InventoryError('INVALID');
  return value;
}
export function integer(input: unknown, max = 2147483647, min = 1): number {
  if (
    typeof input !== 'number' ||
    !Number.isSafeInteger(input) ||
    input < min ||
    input > max
  )
    throw new InventoryError('INVALID');
  return input;
}
export function utc(input: unknown): string {
  const value = text(input, 24);
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  )
    throw new InventoryError('INVALID');
  return value;
}
export function kind(input: unknown): Kind {
  if (!kinds.includes(input as Kind)) throw new InventoryError('INVALID');
  return input as Kind;
}
export function role(input: unknown): Role {
  if (input !== 'viewer' && input !== 'operator' && input !== 'admin')
    throw new InventoryError('INVALID');
  return input;
}
export interface FieldSpec {
  type: 'text' | 'uuid' | 'int' | 'utc';
  max?: number;
  optional?: boolean;
  min?: number;
  choices?: readonly string[];
}
const code: FieldSpec = { type: 'text', max: 48 };
const label: FieldSpec = { type: 'text', max: 120 };
const ref: FieldSpec = { type: 'uuid' };
export const definitions: Record<
  Kind,
  {
    fields: Record<string, FieldSpec>;
    unique: string[];
    indexes: string[][];
    statuses: readonly string[];
    references: Record<string, Kind>;
  }
> = {
  sites: {
    fields: { code, display_name: label },
    unique: ['code'],
    indexes: [],
    statuses: ['active', 'maintenance', 'retired'],
    references: {},
  },
  carriers: {
    fields: { code, display_name: label },
    unique: ['code'],
    indexes: [],
    statuses: ['active', 'retired'],
    references: {},
  },
  uplinks: {
    fields: {
      site_id: ref,
      carrier_id: ref,
      code,
      role: { type: 'text', choices: ['primary', 'backup'] },
      capacity_mbps: { type: 'int' },
      protected_uplink_id: { ...ref, optional: true },
    },
    unique: ['site_id', 'code'],
    indexes: [['site_id'], ['carrier_id'], ['protected_uplink_id']],
    statuses: ['active', 'degraded', 'down', 'retired'],
    references: {
      site_id: 'sites',
      carrier_id: 'carriers',
      protected_uplink_id: 'uplinks',
    },
  },
  customers: {
    fields: {
      reference: code,
      display_alias: label,
      site_id: ref,
      sla_tier_id: ref,
    },
    unique: ['reference'],
    indexes: [['site_id'], ['sla_tier_id']],
    statuses: ['active', 'suspended', 'retired'],
    references: { site_id: 'sites', sla_tier_id: 'sla_tiers' },
  },
  customer_services: {
    fields: { customer_id: ref, site_id: ref, tier_id: ref, code },
    unique: ['customer_id', 'code'],
    indexes: [['site_id'], ['tier_id']],
    statuses: ['active', 'retired'],
    references: {
      customer_id: 'customers',
      site_id: 'sites',
      tier_id: 'sla_tiers',
    },
  },
  service_dependencies: {
    fields: {
      service_id: ref,
      uplink_id: ref,
      dependency_mode: { type: 'text', choices: ['required', 'failover'] },
      failover_group: { ...code, optional: true },
    },
    unique: ['service_id', 'uplink_id'],
    indexes: [['uplink_id', 'service_id']],
    statuses: ['active', 'retired'],
    references: { service_id: 'customer_services', uplink_id: 'uplinks' },
  },
  teams: {
    fields: { code, name: label },
    unique: ['code'],
    indexes: [],
    statuses: ['active', 'retired'],
    references: {},
  },
  assignees: {
    fields: {
      atlassian_account_id: { type: 'text', max: 128, optional: true },
      display_alias: label,
      mapping_method: { type: 'text', choices: ['manual'] },
    },
    unique: ['atlassian_account_id'],
    indexes: [],
    statuses: ['active', 'unmapped', 'disabled'],
    references: {},
  },
  team_memberships: {
    fields: {
      team_id: ref,
      assignee_id: ref,
      role: { type: 'text', choices: ['engineer', 'lead'] },
      effective_until: { type: 'utc', optional: true },
    },
    unique: ['team_id', 'assignee_id'],
    indexes: [['assignee_id']],
    statuses: ['active', 'expired', 'revoked'],
    references: { team_id: 'teams', assignee_id: 'assignees' },
  },
  sla_tiers: {
    fields: { code, name: label },
    unique: ['code'],
    indexes: [],
    statuses: ['draft', 'active', 'retired'],
    references: {},
  },
  sla_policy_versions: {
    fields: {
      approved_by: { type: 'text', max: 128, optional: true },
      tier_id: ref,
      version_number: { type: 'int' },
      effective_from: { type: 'utc' },
      effective_until: { type: 'utc', optional: true },
      unknown_impact_rule: { type: 'text', choices: ['manual-review'] },
      priority_map: { type: 'text', choices: ['demonstration-only'] },
      p1_duration_seconds: { type: 'int' },
      p1_warning_seconds: { type: 'int', min: 0 },
      p2_duration_seconds: { type: 'int' },
      p2_warning_seconds: { type: 'int', min: 0 },
      p3_duration_seconds: { type: 'int' },
      p3_warning_seconds: { type: 'int', min: 0 },
    },
    unique: ['tier_id', 'version_number'],
    indexes: [['tier_id', 'effective_from']],
    statuses: ['draft', 'published', 'superseded'],
    references: { tier_id: 'sla_tiers' },
  },
};
export function validateFields(
  entity: Kind,
  input: unknown,
  status: unknown,
): Fields {
  const spec = definitions[entity];
  if (!spec.statuses.includes(text(status, 24)))
    throw new InventoryError('INVALID');
  const data = object(input);
  if (Object.keys(data).some((key) => !Object.hasOwn(spec.fields, key)))
    throw new InventoryError('INVALID');
  const result: Fields = {};
  for (const [key, field] of Object.entries(spec.fields)) {
    const value = data[key];
    if ((value === null || value === undefined) && field.optional) {
      result[key] = null;
      continue;
    }
    const parsed =
      field.type === 'int'
        ? integer(value, 2147483647, field.min)
        : field.type === 'uuid'
          ? uuid(value)
          : field.type === 'utc'
            ? utc(value)
            : text(value, field.max);
    if (field.choices && !field.choices.includes(String(parsed)))
      throw new InventoryError('INVALID');
    result[key] = parsed;
  }
  if (
    entity === 'uplinks' &&
    result.role === 'primary' &&
    result.protected_uplink_id
  )
    throw new InventoryError('INVALID');
  if (
    entity === 'assignees' &&
    ((status === 'active' && result.atlassian_account_id === null) ||
      (status === 'unmapped' && result.atlassian_account_id !== null))
  )
    throw new InventoryError('INVALID');
  if (
    entity === 'service_dependencies' &&
    (result.dependency_mode === 'failover') !== (result.failover_group !== null)
  )
    throw new InventoryError('INVALID');
  if (entity === 'sla_policy_versions') {
    for (const p of ['p1', 'p2', 'p3'])
      if (
        Number(result[`${p}_warning_seconds`]) >=
        Number(result[`${p}_duration_seconds`])
      )
        throw new InventoryError('INVALID');
    if (
      result.effective_until &&
      String(result.effective_until) <= String(result.effective_from)
    )
      throw new InventoryError('INVALID');
  }
  return result;
}
