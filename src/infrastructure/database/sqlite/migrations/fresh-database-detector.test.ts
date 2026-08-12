import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { SqliteExecutor } from "../sqlite-executor";
import { detectDatabaseFreshness } from "./fresh-database-detector";
import { SqliteMigrationHistoryStore } from "./sqlite-migration-history-store";
import { SqliteSchemaInspector } from "./sqlite-schema-inspector";

describe("fresh database detection with isolated SQLite", () => {
  let sqlite: DatabaseSync;
  let executor: SqliteExecutor;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    executor = {
      all: <T>(sql: string, ...params: SQLInputValue[]) =>
        sqlite.prepare(sql).all(...params) as T[],
      run: (sql: string, ...params: SQLInputValue[]) =>
        sqlite.prepare(sql).run(...params),
    };
  });

  afterEach(() => sqlite.close());

  const state = (): ReturnType<typeof detectDatabaseFreshness> =>
    detectDatabaseFreshness(new SqliteSchemaInspector(executor).inspect());

  it("classifies a truly empty database as fresh", () => {
    expect(state()).toBe("FRESH");
  });

  it("allows SQLite-owned internal metadata in a fresh database", () => {
    sqlite.exec("CREATE TABLE transient(id INTEGER PRIMARY KEY AUTOINCREMENT); DROP TABLE transient;");

    expect(
      new SqliteSchemaInspector(executor).inspect().tables.map(({ name }) => name),
    ).toEqual(["sqlite_sequence"]);
    expect(state()).toBe("FRESH");
  });

  it.each([
    ["business table", "CREATE TABLE unknown_business(id INTEGER)"],
    ["partial legacy-like table", "CREATE TABLE subjects(id INTEGER PRIMARY KEY)"],
    ["unknown view", "CREATE VIEW unexplained AS SELECT 1 AS value"],
  ])("does not classify a database with an %s as fresh", (_label, sql) => {
    sqlite.exec(sql);
    expect(state()).toBe("NON_EMPTY_UNVERSIONED");
  });

  it("recognizes valid migration metadata", () => {
    new SqliteMigrationHistoryStore(executor).ensureStorage();
    expect(state()).toBe("VERSIONED");
  });

  it("rejects malformed migration metadata", () => {
    sqlite.exec("CREATE TABLE schema_migrations(unrelated TEXT)");
    expect(state()).toBe("INCONSISTENT_MIGRATION_METADATA");
  });

  it("rejects lookalike migration metadata without canonical constraints", () => {
    sqlite.exec(`CREATE TABLE schema_migrations(
      migration_id TEXT, from_version INTEGER, to_version INTEGER,
      description TEXT, checksum TEXT, applied_at TEXT, duration_ms INTEGER,
      application_kind TEXT, application_version TEXT
    )`);
    expect(state()).toBe("INCONSISTENT_MIGRATION_METADATA");
  });
});
