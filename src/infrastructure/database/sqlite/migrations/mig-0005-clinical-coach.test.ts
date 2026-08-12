import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { SqliteExecutor } from "../sqlite-executor";
import { assertClinicalCoachSchema, clinicalCoachMigration } from "./definitions/mig-0005-clinical-coach";

describe("MIG-0005 clinical coach", () => {
  it("creates and validates persistent coach tables", () => {
    const sqlite = new DatabaseSync(":memory:");
    const database: SqliteExecutor = { all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[], run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params) };
    try {
      clinicalCoachMigration.up(database);
      expect(() => assertClinicalCoachSchema(database)).not.toThrow();
    } finally { sqlite.close(); }
  });
});
