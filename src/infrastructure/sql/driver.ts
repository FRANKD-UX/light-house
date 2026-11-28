import sql, { type UpdateQueryResponse } from '@forge/sql';
import { InventoryError, type Scalar } from '../../domain/inventory/model';
export interface SqlDriver {
  rows<T>(query: string, params: Scalar[]): Promise<T[]>;
  write(query: string, params: Scalar[]): Promise<number>;
}
export const forgeSql: SqlDriver = {
  async rows<T>(query: string, params: Scalar[]) {
    return (
      await sql
        .prepare<T>(query)
        .bindParams(...params)
        .execute()
    ).rows as T[];
  },
  async write(query, params) {
    let result;
    try {
      result = await sql
        .prepare<UpdateQueryResponse>(query)
        .bindParams(...params)
        .execute();
    } catch (error) {
      if (isDuplicate(error)) throw new InventoryError('CONFLICT');
      throw new InventoryError('UNAVAILABLE');
    }
    const affected = result.rows.affectedRows;
    if (!Number.isSafeInteger(affected) || affected < 0)
      throw new InventoryError('UNAVAILABLE');
    return affected;
  },
};

function isDuplicate(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as Record<string, unknown>;
  const context =
    value.context && typeof value.context === 'object'
      ? (value.context as Record<string, unknown>)
      : value;
  const debug = context.debug;
  return (
    value.code === 'SQL_EXECUTION_ERROR' &&
    !!debug &&
    typeof debug === 'object' &&
    'code' in debug &&
    debug.code === 'ER_DUP_ENTRY'
  );
}
