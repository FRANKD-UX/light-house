import { describe, it, expect, vi } from 'vitest';
const sdk = vi.hoisted(() => ({
  execute: vi.fn(),
  bind: vi.fn(),
  prepare: vi.fn(),
}));
vi.mock('@forge/sql', () => ({ default: { prepare: sdk.prepare } }));
import { forgeSql } from '../../src/infrastructure/sql/driver';
describe('Forge SQL driver (mock SDK only)', () => {
  it('binds parameters separately and interprets rows.affectedRows fail-closed', async () => {
    sdk.prepare.mockReturnValue({ bindParams: sdk.bind });
    sdk.bind.mockReturnValue({ execute: sdk.execute });
    sdk.execute.mockResolvedValue({ rows: [{ id: 'safe' }] });
    expect(
      await forgeSql.rows('SELECT id FROM sites WHERE tenant_id = ?', [
        'tenant-example',
      ]),
    ).toEqual([{ id: 'safe' }]);
    expect(sdk.bind).toHaveBeenLastCalledWith('tenant-example');
    for (const affectedRows of [0, 1]) {
      sdk.execute.mockResolvedValue({ rows: { affectedRows } });
      expect(
        await forgeSql.write(
          'UPDATE sites SET version = version + 1 WHERE tenant_id = ?',
          ['tenant-example'],
        ),
      ).toBe(affectedRows);
    }
    for (const error of [
      {
        code: 'SQL_EXECUTION_ERROR',
        context: { debug: { code: 'ER_DUP_ENTRY' } },
      },
      { code: 'SQL_EXECUTION_ERROR', debug: { code: 'ER_DUP_ENTRY' } },
      new Error('secret'),
      null,
      {
        code: 'SQL_EXECUTION_ERROR',
        context: { debug: { code: 'ER_PARSE_ERROR' } },
      },
    ]) {
      sdk.execute.mockRejectedValueOnce(error);
      await expect(
        forgeSql.write('INSERT INTO sites VALUES (?)', ['safe']),
      ).rejects.toThrow(
        error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'SQL_EXECUTION_ERROR' &&
          !('message' in error) &&
          !(
            'context' in error &&
            (error.context as { debug: { code: string } }).debug.code ===
              'ER_PARSE_ERROR'
          )
          ? 'CONFLICT'
          : 'UNAVAILABLE',
      );
    }
    for (const affectedRows of [undefined, -1, 1.5, '1']) {
      sdk.execute.mockResolvedValue({ rows: { affectedRows } });
      await expect(
        forgeSql.write(
          'UPDATE sites SET version = version + 1 WHERE tenant_id = ?',
          ['tenant-example'],
        ),
      ).rejects.toThrow('UNAVAILABLE');
    }
  });
});
