import { useRef, useState } from 'react';
import { invoke } from '@forge/bridge';
import {
  definitions,
  kinds,
  object,
  type Fields,
  type InventoryRecord,
  type Kind,
  type Role,
} from '../../../src/domain/inventory/model';
import { inventoryValue, validateInventoryList } from './inventory-contract';
interface Overview {
  ready: boolean;
  schemaStatus?: string;
  tenants: { tenantId: string; name: string; role: Role; version: number }[];
  canBootstrap: boolean;
  development: boolean;
}
export function Inventory() {
  const [overview, setOverview] = useState<Overview>();
  const [tenant, setTenant] = useState('');
  const [entity, setEntity] = useState<Kind>('sites');
  const [rows, setRows] = useState<InventoryRecord[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Inventory not loaded.');
  const [seedOffset, setSeedOffset] = useState(0);
  const [editing, setEditing] = useState<InventoryRecord>();
  const [fields, setFields] = useState<Fields>({});
  const [status, setStatus] = useState('active');
  const [tierVersion, setTierVersion] = useState(1);
  const [bootstrapSlug, setBootstrapSlug] = useState('lantern-fibre');
  const [account, setAccount] = useState('');
  const [grantRole, setGrantRole] = useState<Role>('viewer');
  const [grantVersion, setGrantVersion] = useState('');
  const [grantStatus, setGrantStatus] = useState('active');
  const lock = useRef(false);
  async function request(action: string, extra: Record<string, unknown> = {}) {
    const result = object(
      await invoke('inventory', { action, tenantId: tenant, ...extra }),
    );
    if (result.ok !== true)
      throw new Error(
        typeof result.code === 'string' ? result.code : 'UNAVAILABLE',
      );
    return inventoryValue(action, result.value);
  }
  async function run(work: () => Promise<void | string>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage('Loading inventory…');
    try {
      const result = await work();
      setMessage(
        result ?? 'Operation completed. Synthetic demonstration data only.',
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setMessage(
        code === 'CONFLICT'
          ? 'Conflict: reload the current version before retrying.'
          : code === 'INVALID'
            ? 'Validation failed. Check fields and same-tenant active references.'
            : code === 'REPAIR_REQUIRED'
              ? 'Repair required before another mutation.'
              : code === 'DENIED'
                ? 'Access denied. An authorised administrator must grant access.'
                : 'Inventory unavailable. Retry or check schema readiness.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function refresh() {
    setOverview((await request('overview')) as unknown as Overview);
  }
  async function list(after = '') {
    const value = await request('list', { entity, after, limit: 20 });
    validateInventoryList(entity, value);
    setRows(value.rows as InventoryRecord[]);
    setCursor(value.next as string | null);
  }
  function selectEntity(value: Kind) {
    setEntity(value);
    setRows([]);
    setCursor(null);
    setEditing(undefined);
    setFields({});
    setStatus(definitions[value].statuses[0]!);
  }
  const member = overview?.tenants.find((item) => item.tenantId === tenant);
  const canWrite = member && member.role !== 'viewer';
  return (
    <section aria-labelledby="inventory-title">
      <h2 id="inventory-title">Synthetic network inventory</h2>
      <p>
        Development demonstration. No live monitoring or customer information.
      </p>
      <button disabled={busy} onClick={() => void run(refresh)}>
        Load tenants and schema status
      </button>
      <p>
        Schema:{' '}
        {overview
          ? overview.ready
            ? 'ready (v1)'
            : (overview.schemaStatus ?? 'not ready or unavailable')
          : 'not checked'}
      </p>
      {overview?.canBootstrap && (
        <>
          {overview.development && (
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await request('migrate');
                  return 'Migration queued. Refresh status after completion.';
                })
              }
            >
              Queue development migration
            </button>
          )}
          <label>
            Demonstration ISP{' '}
            <select
              value={bootstrapSlug}
              onChange={(event) => setBootstrapSlug(event.target.value)}
            >
              <option value="lantern-fibre">Lantern Fibre</option>
              <option value="beacon-transit">Beacon Transit</option>
            </select>
          </label>
          <button
            disabled={busy || !overview.ready}
            onClick={() =>
              void run(async () => {
                await request('bootstrap', {
                  slug: bootstrapSlug,
                  name:
                    bootstrapSlug === 'lantern-fibre'
                      ? 'Lantern Fibre'
                      : 'Beacon Transit',
                });
                await refresh();
              })
            }
          >
            Bootstrap selected ISP
          </button>
        </>
      )}
      <label>
        Authorised ISP{' '}
        <select
          value={tenant}
          disabled={busy}
          onChange={(event) => {
            setTenant(event.target.value);
            setRows([]);
            setCursor(null);
            setEditing(undefined);
            setFields({});
            setSeedOffset(0);
          }}
        >
          <option value="">Select ISP</option>
          {overview?.tenants.map((item) => (
            <option key={item.tenantId} value={item.tenantId}>
              {item.name} ({item.role})
            </option>
          ))}
        </select>
      </label>
      {overview?.ready && overview.tenants.length === 0 && (
        <p>
          No authorised ISP memberships. Ask a Jira administrator to bootstrap
          an ISP.
        </p>
      )}
      {tenant && (
        <>
          {overview?.development && member?.role === 'admin' && (
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await request('repairProbe');
                  await list();
                })
              }
            >
              Create synthetic partial-write repair probe
            </button>
          )}
          {overview?.development && member?.role === 'admin' && (
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const value = await request('seed', { offset: seedOffset });
                  setSeedOffset(
                    typeof value.next === 'number' ? value.next : 0,
                  );
                  await list();
                })
              }
            >
              Seed next batch ({seedOffset}; four records maximum)
            </button>
          )}
          <label>
            Inventory type{' '}
            <select
              disabled={busy}
              value={entity}
              onChange={(event) => selectEntity(event.target.value as Kind)}
            >
              {kinds.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <button disabled={busy} onClick={() => void run(() => list())}>
            Load inventory
          </button>
          <p>
            Showing {rows.length} records on this page. Customers and services
            have independent identities.
          </p>
          {rows.length === 0 ? (
            <p>No records loaded.</p>
          ) : (
            <table>
              <caption>{entity} — selected ISP only</caption>
              <thead>
                <tr>
                  <th>Identity / fields</th>
                  <th>Lifecycle</th>
                  <th>Version</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.id}
                      <pre>{JSON.stringify(row.fields, null, 2)}</pre>
                    </td>
                    <td>{row.status}</td>
                    <td>{row.version}</td>
                    <td>
                      {canWrite && (
                        <button
                          disabled={busy}
                          onClick={() => {
                            setEditing(row);
                            setFields(row.fields);
                            setStatus(row.status);
                          }}
                        >
                          Edit
                        </button>
                      )}
                      {row.pending && member?.role === 'admin' && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await request('repair', { entity, id: row.id });
                              await list();
                            })
                          }
                        >
                          Repair
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {cursor && (
            <button
              disabled={busy}
              onClick={() => void run(() => list(cursor))}
            >
              Next page
            </button>
          )}
          {canWrite && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  await request('save', {
                    entity,
                    fields,
                    status,
                    ...(editing
                      ? { id: editing.id, expected: editing.version }
                      : {}),
                  });
                  setEditing(undefined);
                  setFields({});
                  await list();
                });
              }}
            >
              <h3>{editing ? 'Edit record' : 'Create record'}</h3>
              <p>
                References require same-ISP UUIDs from the lists above.
                Identifiers and relationships are fixed after creation. Retired
                records stay retained.
              </p>
              {Object.entries(definitions[entity].fields).map(([key, spec]) => (
                <label key={key}>
                  {key}
                  {spec.optional ? ' (optional)' : ''}
                  {spec.choices ? (
                    <select
                      required={!spec.optional}
                      value={String(fields[key] ?? '')}
                      onChange={(event) =>
                        setFields({ ...fields, [key]: event.target.value })
                      }
                    >
                      <option value="">Choose</option>
                      {spec.choices.map((choice) => (
                        <option key={choice}>{choice}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required={!spec.optional}
                      type={spec.type === 'int' ? 'number' : 'text'}
                      min={spec.type === 'int' ? (spec.min ?? 1) : undefined}
                      maxLength={spec.max ?? (spec.type === 'uuid' ? 36 : 120)}
                      value={String(fields[key] ?? '')}
                      onChange={(event) =>
                        setFields({
                          ...fields,
                          [key]:
                            event.target.value === ''
                              ? null
                              : spec.type === 'int'
                                ? Number(event.target.value)
                                : event.target.value,
                        })
                      }
                    />
                  )}
                </label>
              ))}
              <label>
                Lifecycle{' '}
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  {definitions[entity].statuses.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <button disabled={busy}>Save record</button>
              <button
                disabled={busy}
                type="button"
                onClick={() => {
                  setEditing(undefined);
                  setFields({});
                }}
              >
                New record
              </button>
              {entity === 'sla_policy_versions' && member?.role === 'admin' && (
                <>
                  <label>
                    Expected tier version{' '}
                    <input
                      type="number"
                      min="1"
                      value={tierVersion}
                      onChange={(event) =>
                        setTierVersion(Number(event.target.value))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await request('publish', {
                          fields,
                          expectedTierVersion: tierVersion,
                        });
                        await list();
                      })
                    }
                  >
                    Publish new immutable demonstration policy
                  </button>
                </>
              )}
            </form>
          )}
          {member?.role === 'admin' && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void run(async () => {
                  await request('configureTenant', {
                    name: data.get('name'),
                    expected: Number(data.get('expected')),
                    status: data.get('status'),
                  });
                  setTenant('');
                  setRows([]);
                  await refresh();
                });
              }}
            >
              <h3>ISP configuration</h3>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await request('repairTenant');
                    await list();
                  })
                }
              >
                Repair pending ISP mutation
              </button>
              <p>Current ISP version: {member.version}</p>
              <label>
                ISP name
                <input
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={member.name}
                />
              </label>
              <label>
                Expected ISP version
                <input name="expected" type="number" min="1" required />
              </label>
              <label>
                ISP lifecycle
                <select name="status">
                  <option>active</option>
                  <option>suspended</option>
                  <option>retired</option>
                </select>
              </label>
              <p>
                Suspended ISPs deny member access. A Jira administrator can
                restore them through bootstrap. Retirement requires no live
                inventory and preserves stored records. No cleanup runs.
              </p>
              <button disabled={busy}>Save ISP configuration</button>
            </form>
          )}
          {member?.role === 'admin' && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  await request('grant', {
                    accountId: account,
                    role: grantRole,
                    expected: grantVersion === '' ? null : Number(grantVersion),
                    status: grantStatus,
                    expiresAt: null,
                  });
                });
              }}
            >
              <h3>Independent ISP access grant</h3>
              <p>
                Team membership and manual engineer mapping never grant app
                access. Use a consenting test account ID. Self changes are
                denied.
              </p>
              <label>
                Atlassian account ID{' '}
                <input
                  required
                  maxLength={128}
                  value={account}
                  onChange={(event) => setAccount(event.target.value)}
                />
              </label>
              <label>
                Access role{' '}
                <select
                  value={grantRole}
                  onChange={(event) => setGrantRole(event.target.value as Role)}
                >
                  {['viewer', 'operator', 'admin'].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                Expected grant version (empty for new grant)
                <input
                  type="number"
                  min="1"
                  value={grantVersion}
                  onChange={(event) => setGrantVersion(event.target.value)}
                />
              </label>
              <label>
                Grant lifecycle
                <select
                  value={grantStatus}
                  onChange={(event) => setGrantStatus(event.target.value)}
                >
                  <option>active</option>
                  <option>revoked</option>
                </select>
              </label>
              <button disabled={busy}>Save access grant</button>
            </form>
          )}
        </>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
