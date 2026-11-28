export const inventoryStages = [
  'resolver.entry',
  'installation.context',
  'schema.readiness',
  'schema.sql',
  'tenant.membership',
  'tenant.authorisation',
  'inventory.parameters',
  'inventory.query',
  'inventory.sql',
  'inventory.mapping',
  'response.contract',
  'response.serialization',
  'resolver.completion',
] as const;
export type InventoryStage = (typeof inventoryStages)[number];
export interface InventoryDiagnostics {
  run<T>(stage: InventoryStage, work: () => T | Promise<T>): Promise<T>;
}
export const noInventoryDiagnostics: InventoryDiagnostics = {
  async run(_stage, work) {
    return await work();
  },
};
