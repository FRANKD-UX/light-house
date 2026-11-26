import {
  integer,
  InventoryError,
  kind,
  object,
  role,
  text,
  utc,
  uuid,
  validateFields,
} from '../../../src/domain/inventory/model';
export function inventoryValue(
  action: string,
  input: unknown,
): Record<string, unknown> {
  const value = object(input);
  if (action === 'overview') {
    if (
      typeof value.ready !== 'boolean' ||
      typeof value.development !== 'boolean' ||
      typeof value.canBootstrap !== 'boolean' ||
      !Array.isArray(value.tenants) ||
      value.tenants.length > 50
    )
      throw new InventoryError('INVALID');
    for (const input of value.tenants) {
      const tenant = object(input);
      uuid(tenant.tenantId);
      text(tenant.name);
      role(tenant.role);
      integer(tenant.version);
    }
  }
  if (action === 'list') {
    if (!Array.isArray(value.rows) || value.rows.length > 50)
      throw new InventoryError('INVALID');
    for (const input of value.rows) {
      const row = object(input);
      uuid(row.id);
      uuid(row.tenant_id);
      integer(row.version);
      utc(row.created_at);
      utc(row.updated_at);
      text(row.status, 24);
      object(row.fields);
      if (row.pending !== null && row.pending !== 'repair-required')
        throw new InventoryError('INVALID');
    }
    if (value.next !== null) uuid(value.next);
  }
  return value;
}
// Validate fields against the selected kind as well as the envelope before rendering a list.
export function validateInventoryList(
  entity: unknown,
  value: Record<string, unknown>,
): void {
  for (const input of value.rows as unknown[]) {
    const row = object(input);
    validateFields(kind(entity), row.fields, row.status);
  }
}
