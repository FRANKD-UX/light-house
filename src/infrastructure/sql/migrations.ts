// Immutable named DDL. Append new migrations; never edit the v001 snapshot.
import v001 from './migrations.v001.json';
export const migrations: readonly {
  readonly name: string;
  readonly ddl: string;
}[] = v001;
