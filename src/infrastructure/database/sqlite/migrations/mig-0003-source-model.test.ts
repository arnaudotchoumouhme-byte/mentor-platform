import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import type { SqliteExecutor } from "../sqlite-executor";
import { FreshDatabaseBootstrap } from "./fresh-database-bootstrap";
import { assertSourceModelSchema } from "./definitions/mig-0003-source-model";

describe("MIG-0003 source model", () => {
  let sqlite: DatabaseSync;
  afterEach(() => sqlite.close());

  it("creates source/version persistence non-destructively with checksum uniqueness", () => {
    sqlite = new DatabaseSync(":memory:");
    const database: SqliteExecutor = {
      all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[],
      run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params),
    };
    expect(new FreshDatabaseBootstrap(database).run()).toMatchObject({ currentVersion: 11 });
    expect(() => assertSourceModelSchema(database)).not.toThrow();
    expect(sqlite.prepare("PRAGMA table_info(sources)").all()).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "source_id" }),
      expect.objectContaining({ name: "provenance_type" }),
      expect.objectContaining({ name: "checksum" }),
    ]));
  });
});
