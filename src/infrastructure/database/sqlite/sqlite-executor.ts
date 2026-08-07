export type SqliteParameter = string | number | bigint | Uint8Array | null;

export type SqliteRunResult = Readonly<{ changes: number | bigint }>;

export interface SqliteExecutor {
  all<T>(sql: string, ...params: SqliteParameter[]): T[];
  run(sql: string, ...params: SqliteParameter[]): SqliteRunResult;
}
