import type { TenantContext } from '../ports/tenant-context';
import type {
  Fields,
  InventoryRecord,
  Kind,
  Role,
} from '../../domain/inventory/model';
export interface Session {
  installationId: string;
  environment: string;
  accountId: string;
}
export interface Membership {
  version: number;
  tenantId: string;
  name: string;
  role: Role;
}
export interface PendingIntent {
  commandId: string;
  version: number;
  action: 'create' | 'update';
  at: string;
}
export type TenantMutation =
  | {
      operation: 'save';
      entity: Kind;
      record: InventoryRecord;
      expected: number;
    }
  | { operation: 'configure'; name: string; status: string; expected: number };
export interface InventoryRepository {
  claim(ctx: TenantContext, intent: string): Promise<boolean>;
  pending(ctx: TenantContext): Promise<string | null>;
  finish(ctx: TenantContext, intent: string): Promise<void>;
  recorded(ctx: TenantContext, commandId: string): Promise<boolean>;
  get(
    ctx: TenantContext,
    entity: Kind,
    id: string,
  ): Promise<InventoryRecord | null>;
  list(
    ctx: TenantContext,
    entity: Kind,
    after: string,
    limit: number,
  ): Promise<InventoryRecord[]>;
  fixture(
    ctx: TenantContext,
    entity: Kind,
    key: string,
  ): Promise<InventoryRecord | null>;
  create(
    ctx: TenantContext,
    entity: Kind,
    record: InventoryRecord,
  ): Promise<void>;
  update(
    ctx: TenantContext,
    entity: Kind,
    record: InventoryRecord,
    expected: number,
  ): Promise<boolean>;
  materialise(
    ctx: TenantContext,
    entity: Kind,
    record: InventoryRecord,
  ): Promise<void>;
  referenced(ctx: TenantContext, entity: Kind, id: string): Promise<boolean>;
  hasLiveInventory(ctx: TenantContext): Promise<boolean>;
  policies(ctx: TenantContext, tierId: string): Promise<InventoryRecord[]>;
}
export interface AccessRepository {
  schemaStatus(session: Session): Promise<string>;
  configureTenant(
    ctx: TenantContext,
    name: string,
    status: string,
    expected: number,
    intent: string,
  ): Promise<boolean>;
  ready(session: Session): Promise<boolean>;
  memberships(session: Session): Promise<Membership[]>;
  membership(session: Session, tenantId: string): Promise<Role | null>;
  bootstrap(session: Session, name: string, slug: string): Promise<string>;
  grant(
    ctx: TenantContext,
    accountId: string,
    role: Role,
    expires: string | null,
    expected: number | null,
    status: 'active' | 'revoked',
  ): Promise<boolean>;
}
export interface InventoryDependencies {
  inventory: InventoryRepository;
  access: AccessRepository;
  id(): string;
  now(): string;
  isJiraAdmin(): Promise<boolean>;
  migrate(session: Session): Promise<boolean>;
}
export interface Mutation {
  entity: Kind;
  id?: string;
  expected?: number;
  fields: Fields;
  status: string;
}
