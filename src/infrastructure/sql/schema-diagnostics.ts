import { migrationRunner } from '@forge/sql';
import {
  diagnosticSqlCodes,
  expectedMigrationNames,
  type SchemaDiagnostic,
} from '../../domain/value-objects/schema-diagnostics';
import { forgeSql } from './driver';

function sqlCode(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error ? error.code : null;
  return (
    diagnosticSqlCodes.find((allowed) => allowed === code) ?? 'UNKNOWN_ERROR'
  );
}

// Caller must authorise the administrator and supply trusted runtime context.
// list() issues a SELECT in pinned SQL 4.0.11; do not initialize/run the runner.
export async function readSchemaDiagnostic(
  installationId: string,
  environment: 'DEVELOPMENT',
): Promise<SchemaDiagnostic> {
  const result: SchemaDiagnostic = {
    environment,
    expectedMigrationNames,
    actualSuccessfulMigrationNames: null,
    missingMigrationNames: null,
    unexpectedMigrationCount: null,
    migrationSqlErrorCode: null,
    readinessRecordPresent: null,
    readiness: null,
    schemaVersion: null,
    schemaVersionType: null,
    readinessSqlErrorCode: null,
  };
  try {
    const applied = await migrationRunner.list();
    result.actualSuccessfulMigrationNames = expectedMigrationNames.filter(
      (name) => applied.some((item) => item.name === name),
    );
    result.missingMigrationNames = expectedMigrationNames.filter(
      (name) => !result.actualSuccessfulMigrationNames!.includes(name),
    );
    result.unexpectedMigrationCount = applied.filter(
      (item) => !expectedMigrationNames.some((name) => item.name === name),
    ).length;
  } catch (error) {
    result.migrationSqlErrorCode = sqlCode(error);
  }
  // Independent of checkpoint success, so metadata failures remain distinguishable.
  try {
    const rows = await forgeSql.rows<Record<string, unknown>>(
      'SELECT readiness, schema_version FROM installation_metadata WHERE installation_id = ? AND environment = ?',
      [installationId, environment],
    );
    if (!Array.isArray(rows) || rows.length > 1) throw new Error('INVALID');
    result.readinessRecordPresent = rows.length === 1;
    if (rows.length === 1) {
      const row = rows[0];
      if (!row || typeof row !== 'object') throw new Error('INVALID');
      result.readiness = ['ready', 'provisioning', 'failed'].includes(
        row.readiness as string,
      )
        ? (row.readiness as string)
        : 'REDACTED';
      const version = row.schema_version;
      result.schemaVersionType = version === null ? 'null' : typeof version;
      result.schemaVersion =
        (typeof version === 'number' && Number.isSafeInteger(version)) ||
        (typeof version === 'string' && /^\d{1,10}$/.test(version))
          ? version
          : version === null
            ? null
            : 'REDACTED';
    }
  } catch (error) {
    result.readinessRecordPresent = null;
    result.readinessSqlErrorCode = sqlCode(error);
  }
  return result;
}
