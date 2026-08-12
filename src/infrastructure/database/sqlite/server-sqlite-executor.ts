import "server-only";

import { all, run } from "@/lib/db";
import type { SqliteExecutor, SqliteParameter } from "./sqlite-executor";

export const sqliteExecutor: SqliteExecutor = {
  all: <T>(sql: string, ...params: SqliteParameter[]) => all<T>(sql, ...params),
  run: (sql, ...params) => run(sql, ...params),
};
