import {
  integer,
  text,
  utc,
  uuid,
  validateFields,
  type InventoryRecord,
  type Kind,
} from '../inventory/model';
import {
  IncidentError,
  type ImpactSnapshot,
  type IncidentInventory,
} from './model';

function rows(
  input: readonly InventoryRecord[],
  entity: Kind,
  tenantId: string,
) {
  if (!Array.isArray(input) || input.length > 1000)
    throw new IncidentError('INVALID');
  const ids = new Set<string>();
  for (const row of input) {
    uuid(row.id);
    if (row.tenant_id !== tenantId) throw new IncidentError('DENIED');
    if (ids.has(row.id)) throw new IncidentError('INVALID');
    ids.add(row.id);
    integer(row.version);
    if (row.pending !== null) throw new IncidentError('NOT_READY');
    validateFields(entity, row.fields, row.status);
  }
  return input;
}
const sorted = (values: Iterable<string>): string[] =>
  [...new Set(values)].sort();

/** The failed link is known down; backup health requires explicit fresh evidence. */
export function determineImpact(
  tenantId: string,
  uplinkId: string,
  occurredAt: string,
  inventory: IncidentInventory,
): ImpactSnapshot {
  uuid(tenantId);
  uuid(uplinkId);
  utc(occurredAt);
  const sites = rows(inventory.sites, 'sites', tenantId);
  const carriers = rows(inventory.carriers, 'carriers', tenantId);
  const uplinks = rows(inventory.uplinks, 'uplinks', tenantId);
  const customers = rows(inventory.customers, 'customers', tenantId);
  const services = rows(inventory.services, 'customer_services', tenantId);
  const dependencies = rows(
    inventory.dependencies,
    'service_dependencies',
    tenantId,
  );
  const tiers = rows(inventory.tiers, 'sla_tiers', tenantId);
  const link = uplinks.find((u) => u.id === uplinkId && u.status !== 'retired');
  if (!link) throw new IncidentError('NOT_READY');
  const siteId = uuid(link.fields.site_id);
  const carrierId = uuid(link.fields.carrier_id);
  if (
    !sites.some((s) => s.id === siteId && s.status === 'active') ||
    !carriers.some((c) => c.id === carrierId && c.status === 'active')
  )
    throw new IncidentError('NOT_READY');
  const availability = new Map<string, 'up' | 'down' | 'unknown'>();
  if (
    !Array.isArray(inventory.availability) ||
    inventory.availability.length > 1000
  )
    throw new IncidentError('INVALID');
  for (const item of inventory.availability) {
    uuid(item.uplinkId);
    utc(item.observedAt);
    if (
      !['up', 'down', 'unknown'].includes(item.state) ||
      availability.has(item.uplinkId) ||
      !uplinks.some((u) => u.id === item.uplinkId)
    )
      throw new IncidentError('INVALID');
    // Only observations no older than one minute at the event are used. No future evidence.
    const age = Date.parse(occurredAt) - Date.parse(item.observedAt);
    availability.set(
      item.uplinkId,
      age >= 0 && age <= 60_000 ? item.state : 'unknown',
    );
  }
  availability.set(uplinkId, 'down');
  const affected = new Set<string>(),
    protectedIds = new Set<string>(),
    uncertain = new Set<string>();
  const customerIds = new Set<string>(),
    potentialCustomers = new Set<string>(),
    tierIds = new Set<string>();
  const serviceReferences = new Map<
    string,
    { customerId: string; tierId: string }
  >();
  let incomplete = false;
  const related = dependencies.filter(
    (d) => d.status === 'active' && d.fields.uplink_id === uplinkId,
  );
  for (const dependency of related) {
    const service = services.find(
      (s) => s.id === dependency.fields.service_id && s.status === 'active',
    );
    if (!service) {
      incomplete = true;
      continue;
    }
    const customer = customers.find(
      (c) => c.id === service.fields.customer_id && c.status === 'active',
    );
    const tier = tiers.find(
      (t) => t.id === service.fields.tier_id && t.status === 'active',
    );
    if (
      !customer ||
      !tier ||
      service.fields.site_id !== siteId ||
      customer.fields.site_id !== siteId
    ) {
      incomplete = true;
      uncertain.add(service.id);
      continue;
    }
    serviceReferences.set(service.id, {
      customerId: customer.id,
      tierId: tier.id,
    });
    if (dependency.fields.dependency_mode === 'required')
      affected.add(service.id);
    else {
      const group = text(dependency.fields.failover_group, 48);
      const peers = dependencies.filter(
        (d) =>
          d.status === 'active' &&
          d.fields.service_id === service.id &&
          d.fields.dependency_mode === 'failover' &&
          d.fields.failover_group === group,
      );
      const states = peers.map((d) => {
        const peer = uplinks.find(
          (u) =>
            u.id === d.fields.uplink_id &&
            u.status !== 'retired' &&
            u.fields.site_id === siteId,
        );
        return peer ? (availability.get(peer.id) ?? 'unknown') : 'unknown';
      });
      const adequateUpLink = peers.some((d) => {
        const peer = uplinks.find(
          (u) =>
            u.id === d.fields.uplink_id &&
            u.fields.site_id === siteId &&
            u.status === 'active',
        );
        return (
          peer !== undefined &&
          availability.get(peer.id) === 'up' &&
          Number(peer.fields.capacity_mbps) >= Number(link.fields.capacity_mbps)
        );
      });
      if (adequateUpLink) protectedIds.add(service.id);
      else if (states.every((s) => s === 'down')) affected.add(service.id);
      else uncertain.add(service.id);
    }
  }
  // A service with multiple dependencies remains affected if any required path failed.
  for (const id of affected) {
    protectedIds.delete(id);
    uncertain.delete(id);
  }
  const potentialServices = new Set([...affected, ...uncertain]);
  for (const id of potentialServices) {
    const references = serviceReferences.get(id);
    if (references) {
      potentialCustomers.add(references.customerId);
      tierIds.add(references.tierId);
      if (affected.has(id)) customerIds.add(references.customerId);
    }
  }
  const confidence =
    incomplete || uncertain.size || related.length === 0 ? 'unknown' : 'known';
  return Object.freeze({
    confidence,
    reason:
      incomplete || related.length === 0
        ? 'INCOMPLETE_INVENTORY'
        : uncertain.size
          ? 'UNKNOWN_FAILOVER'
          : 'COMPLETE',
    siteId,
    uplinkId,
    carrierId,
    affectedServiceIds: Object.freeze(sorted(affected)),
    affectedCustomerIds: Object.freeze(sorted(customerIds)),
    potentiallyAffectedCustomerIds: Object.freeze(sorted(potentialCustomers)),
    potentiallyAffectedServiceIds: Object.freeze(sorted(potentialServices)),
    protectedServiceIds: Object.freeze(sorted(protectedIds)),
    uncertainServiceIds: Object.freeze(sorted(uncertain)),
    tierIds: Object.freeze(sorted(tierIds)),
  });
}
