import type {
  JsmContextLookup,
  JsmContextRepository,
  JsmContextSession,
  OperationsReadiness,
} from '../../application/jsm-context/contracts';
import type { TenantContext } from '../../application/ports/tenant-context';
import { configuration, identifier } from '../../application/jsm/validation';
import { integer, text, utc, uuid } from '../../domain/inventory/model';
import type { SqlDriver } from './driver';
const ready =
  'SELECT j.ready FROM jsm_schema_state j JOIN incident_schema_state s ON s.installation_id = j.installation_id JOIN monitoring_schema_state m ON m.installation_id = j.installation_id JOIN installation_metadata i ON i.installation_id = j.installation_id WHERE j.installation_id = ? AND j.schema_version = 4 AND j.ready = 1 AND s.schema_version = 3 AND s.ready = 1 AND m.schema_version = 2 AND m.ready = 1 AND i.schema_version = 1 AND i.readiness = ? AND i.environment = ?';
const unavailable = (
  reason: 'NOT_AVAILABLE' | 'NOT_READY',
): JsmContextLookup => ({ kind: 'unavailable', reason });
/** Read-only reverse lookup. A linked tenant is resolved from storage, never accepted from UI input. */
export class SqlJsmContextRepository implements JsmContextRepository {
  constructor(
    private readonly db: SqlDriver,
    private readonly now: () => string,
  ) {}
  async lookup(
    session: JsmContextSession,
    issueId: string,
  ): Promise<JsmContextLookup> {
    text(session.installationId, 255);
    text(session.accountId, 128);
    identifier(session.projectId);
    identifier(issueId);
    const readiness = await this.db.rows<{ ready: number }>(ready, [
      session.installationId,
      'ready',
      'DEVELOPMENT',
    ]);
    if (readiness.length !== 1 || readiness[0]?.ready !== 1)
      return unavailable('NOT_READY');
    const links = await this.db.rows<{
      tenant_id: string;
      incident_id: string;
    }>(
      'SELECT tenant_id, incident_id FROM jsm_intents WHERE installation_id = ? AND issue_id = ? LIMIT 2',
      [session.installationId, issueId],
    );
    if (!links.length) return unavailable('NOT_AVAILABLE');
    if (links.length !== 1) return unavailable('NOT_READY');
    const tenantId = uuid(links[0]!.tenant_id),
      incidentId = uuid(links[0]!.incident_id);
    let operations: OperationsReadiness = 'unavailable';
    try {
      const op = await this.db.rows<{ ready: number }>(
        'SELECT ready FROM operations_schema_state WHERE installation_id = ? AND schema_version = 5 AND ready = 1',
        [session.installationId],
      );
      operations =
        op.length === 1 && op[0]?.ready === 1 ? 'ready' : 'not-ready';
    } catch {
      /* No schema/read result is fabricated from an unavailable query. */
    }
    const useOperations = operations === 'ready';
    const rows = await this.db.rows<{
      tenant_id: string;
      incident_id: string;
      issue_id: string;
      state: string;
      link_configuration_json: string;
      current_configuration_json: string | null;
      snapshot_json: string | null;
      operations_json?: string | null;
      operations_version?: number | null;
      operations_pending_command?: string | null;
      operations_pending_json?: string | null;
      operations_ready?: number | null;
    }>(
      `SELECT j.tenant_id, j.incident_id, j.issue_id, j.state, j.configuration_json AS link_configuration_json, c.configuration_json AS current_configuration_json, i.snapshot_json${useOperations ? ', o.aggregate_json AS operations_json, o.version AS operations_version, o.pending_command AS operations_pending_command, o.pending_json AS operations_pending_json, os.ready AS operations_ready' : ''} FROM jsm_intents j JOIN isp_tenants t ON t.installation_id = j.installation_id AND t.id = j.tenant_id JOIN tenant_memberships m ON m.tenant_id = t.id LEFT JOIN incidents i ON i.installation_id = j.installation_id AND i.tenant_id = j.tenant_id AND i.id = j.incident_id LEFT JOIN jsm_configuration c ON c.installation_id = j.installation_id AND c.tenant_id = j.tenant_id${useOperations ? ' LEFT JOIN operations_schema_state os ON os.installation_id = j.installation_id AND os.schema_version = 5 AND os.ready = 1 LEFT JOIN operations_state o ON o.installation_id = j.installation_id AND o.tenant_id = j.tenant_id AND o.incident_id = j.incident_id AND os.ready = 1' : ''} WHERE j.installation_id = ? AND j.issue_id = ? AND j.tenant_id = ? AND j.incident_id = ? AND t.status = ? AND t.pending_mutation IS NULL AND m.account_id = ? AND m.status = ? AND m.role IN (?, ?, ?) AND (m.expires_at IS NULL OR m.expires_at > ?) AND (SELECT COUNT(*) FROM jsm_intents duplicate_link WHERE duplicate_link.installation_id = j.installation_id AND duplicate_link.issue_id = j.issue_id) = 1 AND EXISTS (${ready}) LIMIT 2`,
      [
        session.installationId,
        issueId,
        tenantId,
        incidentId,
        'active',
        session.accountId,
        'active',
        'viewer',
        'operator',
        'admin',
        utc(this.now()),
        session.installationId,
        'ready',
        'DEVELOPMENT',
      ],
    );
    if (!rows.length) return unavailable('NOT_AVAILABLE');
    if (rows.length !== 1) return unavailable('NOT_READY');
    const row = rows[0]!;
    if (
      row.tenant_id !== tenantId ||
      row.incident_id !== incidentId ||
      row.issue_id !== issueId
    )
      return unavailable('NOT_AVAILABLE');
    if (
      row.state !== 'linked' ||
      row.current_configuration_json === null ||
      row.snapshot_json === null
    )
      return unavailable('NOT_READY');
    const ctx: TenantContext = {
      installationId: session.installationId,
      tenantId,
      actor: { kind: 'atlassian-user', accountId: session.accountId },
    };
    const originalConfig = configuration(
      ctx,
      JSON.parse(row.link_configuration_json),
    );
    configuration(ctx, JSON.parse(row.current_configuration_json));
    if (originalConfig.projectId !== session.projectId)
      return unavailable('NOT_AVAILABLE');
    let op: unknown | null = null;
    if (useOperations) {
      if (row.operations_ready !== 1) operations = 'not-ready';
      else if (
        row.operations_json !== null &&
        row.operations_json !== undefined
      ) {
        op = JSON.parse(row.operations_json);
        const aggregate = op as {
          incident?: { version?: unknown };
          pending?: { receipt?: { commandId?: unknown } } | null;
        };
        if (
          integer(aggregate.incident?.version) !== row.operations_version ||
          (aggregate.pending?.receipt?.commandId ?? null) !==
            row.operations_pending_command ||
          (aggregate.pending ? JSON.stringify(aggregate.pending) : null) !==
            row.operations_pending_json
        )
          throw new Error('INVALID_CONTEXT_STORAGE');
      }
    }
    return {
      kind: 'linked',
      installationId: session.installationId,
      tenantId,
      incidentId,
      issueId,
      incident: JSON.parse(row.snapshot_json),
      operations: { readiness: operations, snapshot: op },
    };
  }
}
