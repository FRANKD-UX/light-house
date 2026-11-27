// Public diagnostic contract: names only, never DDL or installation context.
export const expectedMigrationNames = [
  'v001_installation_metadata',
  'v001_isp_tenants',
  'v001_tenant_memberships',
  'v001_sites',
  'v001_carriers',
  'v001_uplinks',
  'v001_customers',
  'v001_customer_services',
  'v001_service_dependencies',
  'v001_teams',
  'v001_assignees',
  'v001_team_memberships',
  'v001_sla_tiers',
  'v001_sla_policy_versions',
  'v001_mutation_receipts',
] as const;

export const diagnosticSqlCodes = [
  'UNKNOWN_ERROR',
  'SQL_EXECUTION_ERROR',
  'INVALID_SQL_QUERY',
  'QUERY_TIMED_OUT',
  'APP_NOT_ENABLED',
  'SQL_POLICY_VIOLATION',
] as const;

export interface SchemaDiagnostic {
  environment: 'DEVELOPMENT';
  expectedMigrationNames: readonly string[];
  actualSuccessfulMigrationNames: string[] | null;
  missingMigrationNames: string[] | null;
  unexpectedMigrationCount: number | null;
  migrationSqlErrorCode: string | null;
  readinessRecordPresent: boolean | null;
  readiness: string | null;
  schemaVersion: number | string | null;
  schemaVersionType: string | null;
  readinessSqlErrorCode: string | null;
}

// Project the response again before rendering; extra fields never reach the UI.
export function schemaDiagnosticValue(input: unknown): SchemaDiagnostic {
  if (!input || typeof input !== 'object') throw new Error('INVALID');
  const value = input as Record<string, unknown>;
  const names = (input: unknown): string[] | null => {
    if (input === null) return null;
    if (
      !Array.isArray(input) ||
      input.length > expectedMigrationNames.length ||
      !input.every((name) =>
        expectedMigrationNames.some((expected) => expected === name),
      )
    )
      throw new Error('INVALID');
    return [...input] as string[];
  };
  const code = (input: unknown): string | null => {
    if (input === null) return null;
    if (!diagnosticSqlCodes.some((code) => code === input))
      throw new Error('INVALID');
    return input as string;
  };
  if (
    value.environment !== 'DEVELOPMENT' ||
    (value.readinessRecordPresent !== null &&
      typeof value.readinessRecordPresent !== 'boolean') ||
    ![null, 'ready', 'provisioning', 'failed', 'REDACTED'].includes(
      value.readiness as string | null,
    ) ||
    ![
      null,
      'number',
      'string',
      'null',
      'undefined',
      'boolean',
      'object',
      'bigint',
      'symbol',
      'function',
    ].includes(value.schemaVersionType as string | null) ||
    !(
      value.schemaVersion === null ||
      value.schemaVersion === 'REDACTED' ||
      (typeof value.schemaVersion === 'number' &&
        Number.isSafeInteger(value.schemaVersion)) ||
      (typeof value.schemaVersion === 'string' &&
        /^\d{1,10}$/.test(value.schemaVersion))
    ) ||
    !(
      value.unexpectedMigrationCount === null ||
      (typeof value.unexpectedMigrationCount === 'number' &&
        Number.isSafeInteger(value.unexpectedMigrationCount) &&
        value.unexpectedMigrationCount >= 0)
    )
  )
    throw new Error('INVALID');
  return {
    environment: 'DEVELOPMENT',
    expectedMigrationNames,
    actualSuccessfulMigrationNames: names(value.actualSuccessfulMigrationNames),
    missingMigrationNames: names(value.missingMigrationNames),
    unexpectedMigrationCount: value.unexpectedMigrationCount as number | null,
    migrationSqlErrorCode: code(value.migrationSqlErrorCode),
    readinessRecordPresent: value.readinessRecordPresent as boolean | null,
    readiness: value.readiness as string | null,
    schemaVersion: value.schemaVersion as number | string | null,
    schemaVersionType: value.schemaVersionType as string | null,
    readinessSqlErrorCode: code(value.readinessSqlErrorCode),
  };
}
