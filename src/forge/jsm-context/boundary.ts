import { randomUUID } from 'node:crypto';
import { getAppContext } from '@forge/api';
import { object, text } from '../../domain/inventory/model';
import { identifier } from '../../application/jsm/validation';
import { JsmContextService } from '../../application/jsm-context/service';
import type {
  JsmContextSession,
  JsmContextResult,
} from '../../application/jsm-context/contracts';
import { SqlJsmContextRepository } from '../../infrastructure/sql/jsm-context-repository';
import { ForgeIssueVisibilityVerifier } from '../../infrastructure/jsm/context-gateway';
import { forgeSql } from '../../infrastructure/sql/driver';
import { createStructuredLogger } from '../../infrastructure/observability/structured-logger';
export function createEmbeddedRequest(deps: {
  runtime: () => unknown;
  lookup: (
    session: JsmContextSession,
    issueId: string,
  ) => Promise<JsmContextResult>;
}) {
  return async (context: unknown, input: unknown) => {
    const correlationId = randomUUID(),
      logger = createStructuredLogger(console);
    try {
      const data = object(input),
        runtime = object(deps.runtime()),
        ctx = object(context),
        extension = object(ctx.extension);
      // Explicit compatibility list while native UI-module vs function-key semantics remain unverified.
      if (
        Object.keys(data).length !== 1 ||
        data.action !== 'read' ||
        runtime.environmentType !== 'DEVELOPMENT' ||
        !['light-house-incident-context', 'issue-context-resolver'].some(
          (key) => key === runtime.moduleKey,
        ) ||
        extension.type !== 'jira:issueContext'
      ) {
        return { ok: false, code: 'DENIED', correlationId };
      }
      const installation = object(runtime.installationAri);
      const session = {
        installationId: text(installation.toString(), 255),
        accountId: text(ctx.accountId, 128),
        projectId: identifier(object(extension.project).id),
      };
      const value = await deps.lookup(
        session,
        identifier(object(extension.issue).id),
      );
      logger.info({
        event: 'incident.control',
        correlationId,
        outcome: 'success',
      });
      return { ok: true, value, correlationId };
    } catch {
      logger.error({
        event: 'incident.control',
        correlationId,
        outcome: 'failure',
      });
      return { ok: false, code: 'UNAVAILABLE', correlationId };
    }
  };
}
const service = new JsmContextService(
  new SqlJsmContextRepository(forgeSql, () => new Date().toISOString()),
  new ForgeIssueVisibilityVerifier(),
);
export const embeddedRequest = createEmbeddedRequest({
  runtime: getAppContext,
  lookup: (session, id) => service.lookup(session, id),
});
