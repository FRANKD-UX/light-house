import type { Incident } from '../../domain/incidents/model';
import type { OperationalState } from '../../domain/incidents/workflow';
/** Construct from trusted Forge runtime/Atlassian identity, never a client-selected tenant. */
export interface JsmContextSession {
  readonly installationId: string;
  readonly accountId: string;
  readonly projectId: string;
}
/** A future adapter must positively establish both Jira Browse and issue-security visibility asUser. */
export interface IssueVisibilityVerifier {
  verify(session: JsmContextSession, issueId: string): Promise<unknown>;
}
export interface VerifiedIssueVisibility {
  readonly mode: 'asUser';
  readonly accountId: string;
  readonly issueId: string;
  readonly projectId: string;
  readonly browseAllowed: true;
  readonly issueSecurityAllowed: true;
}
export type PublicIncident = Omit<Incident, 'installationId'>;
export interface LinkedOperationalSummary {
  readonly incidentId: string;
  readonly state: OperationalState;
  readonly version: number;
  readonly ownerTeamId: string;
  readonly ownerAssigneeId: string | null;
  readonly nocTeamId: string;
  readonly pendingMaterialisation: boolean;
  readonly pendingHandoff: boolean;
  readonly pendingReturn: boolean;
  readonly resolvedAt: string | null;
}
export type OperationsReadiness = 'ready' | 'not-ready' | 'unavailable';
export type JsmContextLookup =
  | {
      readonly kind: 'unavailable';
      readonly reason: 'NOT_AVAILABLE' | 'NOT_READY';
    }
  | {
      readonly kind: 'linked';
      readonly installationId: string;
      readonly tenantId: string;
      readonly incidentId: string;
      readonly issueId: string;
      readonly incident: unknown;
      readonly operations: {
        readonly readiness: OperationsReadiness;
        readonly snapshot: unknown | null;
      };
    };
export interface JsmContextRepository {
  /** Resolve issue-to-tenant internally, then read only through current tenant membership/expiry/nonpending predicates. */
  lookup(
    session: JsmContextSession,
    issueId: string,
  ): Promise<JsmContextLookup>;
}
export type JsmContextResult =
  | {
      readonly kind: 'available';
      readonly incident: PublicIncident;
      readonly operations: {
        readonly readiness: OperationsReadiness;
        readonly summary: LinkedOperationalSummary | null;
      };
    }
  | {
      readonly kind: 'unavailable';
      readonly reason:
        | 'INVALID_CONTEXT'
        | 'NOT_VISIBLE'
        | 'NOT_AVAILABLE'
        | 'NOT_READY'
        | 'UNAVAILABLE';
    };
