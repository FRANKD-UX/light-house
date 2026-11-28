import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn(), rows: vi.fn() }));
vi.mock('@forge/sql', () => ({ migrationRunner: { list: mocks.list } }));
vi.mock('../../src/infrastructure/sql/driver', () => ({
  forgeSql: { rows: mocks.rows },
}));
import { readSchemaDiagnostic } from '../../src/infrastructure/sql/schema-diagnostics';
import { migrations } from '../../src/infrastructure/sql/migrations';
import {
  expectedMigrationNames,
  schemaDiagnosticValue,
} from '../../src/domain/value-objects/schema-diagnostics';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.list.mockResolvedValue(
    expectedMigrationNames.map((name) => ({
      name,
      id: 30006,
      migratedAt: new Date(),
    })),
  );
  mocks.rows.mockResolvedValue([
    { readiness: 'ready', schema_version: 1, installation_id: 'private' },
  ]);
});
describe('read-only schema diagnostics (mock SDK, no native acceptance)', () => {
  it('keeps public expected names aligned with the immutable registry and strips private fields', async () => {
    expect(expectedMigrationNames).toEqual(migrations.map((item) => item.name));
    const result = await readSchemaDiagnostic(
      'installation-example',
      'DEVELOPMENT',
    );
    expect(result).toMatchObject({
      actualSuccessfulMigrationNames: expectedMigrationNames,
      missingMigrationNames: [],
      unexpectedMigrationCount: 0,
      readinessRecordPresent: true,
      readiness: 'ready',
      schemaVersion: 1,
      schemaVersionType: 'number',
    });
    expect(schemaDiagnosticValue({ ...result, private: 'secret' })).toEqual(
      result,
    );
    expect(JSON.stringify(result)).not.toMatch(
      /private|installation-example|30006|migratedAt/,
    );
  });
  it('reports missing names and redacts unexpected names without using checkpoint IDs', async () => {
    mocks.list.mockResolvedValue([
      { name: expectedMigrationNames[0], id: 30006 },
      { name: 'private contents' },
    ]);
    mocks.rows.mockResolvedValue([]);
    const result = await readSchemaDiagnostic('example', 'DEVELOPMENT');
    expect(result).toMatchObject({
      actualSuccessfulMigrationNames: [expectedMigrationNames[0]],
      missingMigrationNames: expectedMigrationNames.slice(1),
      unexpectedMigrationCount: 1,
      readinessRecordPresent: false,
      readiness: null,
      schemaVersion: null,
      schemaVersionType: null,
    });
    expect(JSON.stringify(result)).not.toContain('private');
  });
  it('separates unknown checkpoints from missing names and still queries readiness', async () => {
    mocks.list.mockRejectedValue({
      code: 'SQL_EXECUTION_ERROR',
      message: 'private',
      context: { debug: 'private' },
    });
    const result = await readSchemaDiagnostic('example', 'DEVELOPMENT');
    expect(result).toMatchObject({
      actualSuccessfulMigrationNames: null,
      missingMigrationNames: null,
      migrationSqlErrorCode: 'SQL_EXECUTION_ERROR',
      readinessRecordPresent: true,
    });
    expect(JSON.stringify(result)).not.toContain('private');
  });
  it('returns only allowlisted SQL errors while preserving successful checkpoints', async () => {
    for (const [error, expected] of [
      [
        { code: 'SQL_POLICY_VIOLATION', message: 'private' },
        'SQL_POLICY_VIOLATION',
      ],
      [{ code: 'private token' }, 'UNKNOWN_ERROR'],
      [null, 'UNKNOWN_ERROR'],
    ]) {
      mocks.rows.mockRejectedValueOnce(error);
      const result = await readSchemaDiagnostic('example', 'DEVELOPMENT');
      expect(result).toMatchObject({
        missingMigrationNames: [],
        readinessRecordPresent: null,
        readinessSqlErrorCode: expected,
      });
      expect(JSON.stringify(result)).not.toContain('private');
    }
  });
  it('preserves returned number/string/null types and redacts unsupported values', async () => {
    for (const [version, expected, type] of [
      [1, 1, 'number'],
      ['1', '1', 'string'],
      [0, 0, 'number'],
      [null, null, 'null'],
      [undefined, 'REDACTED', 'undefined'],
      [{ secret: 'private' }, 'REDACTED', 'object'],
      ['private', 'REDACTED', 'string'],
      [true, 'REDACTED', 'boolean'],
    ]) {
      mocks.rows.mockResolvedValueOnce([
        { readiness: 'private', schema_version: version },
      ]);
      const result = await readSchemaDiagnostic('example', 'DEVELOPMENT');
      expect(result).toMatchObject({
        readiness: 'REDACTED',
        schemaVersion: expected,
        schemaVersionType: type,
      });
      expect(schemaDiagnosticValue(result)).toEqual(result);
      expect(JSON.stringify(result)).not.toContain('private');
    }
  });
  it('treats malformed metadata results as unknown presence, never absence', async () => {
    for (const rows of [null, [null], [{}, {}]]) {
      mocks.rows.mockResolvedValueOnce(rows);
      expect(
        await readSchemaDiagnostic('example', 'DEVELOPMENT'),
      ).toMatchObject({
        readinessRecordPresent: null,
        readinessSqlErrorCode: 'UNKNOWN_ERROR',
      });
    }
  });
  it('rejects malformed frontend diagnostic fields and never projects arbitrary fields', async () => {
    const result = await readSchemaDiagnostic('example', 'DEVELOPMENT');
    for (const input of [
      null,
      { ...result, environment: 'PRODUCTION' },
      { ...result, readinessRecordPresent: 'yes' },
      { ...result, readiness: 'private' },
      { ...result, schemaVersionType: 'private' },
      { ...result, schemaVersion: 'private' },
      { ...result, unexpectedMigrationCount: -1 },
      { ...result, actualSuccessfulMigrationNames: ['private'] },
      { ...result, missingMigrationNames: 'private' },
      { ...result, readinessSqlErrorCode: 'private' },
    ]) {
      expect(() => schemaDiagnosticValue(input)).toThrow('INVALID');
    }
  });
});
