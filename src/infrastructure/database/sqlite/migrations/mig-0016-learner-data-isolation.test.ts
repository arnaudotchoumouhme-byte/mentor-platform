import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { SqliteExecutor } from "../sqlite-executor";
import { coreMigrationRegistry } from "./core-migration-registry";
import { FreshDatabaseBootstrap } from "./fresh-database-bootstrap";
import { MigrationRegistry } from "./migration-registry";
import { LEARNER_OWNERSHIP_TABLES } from "./definitions/mig-0016-learner-data-isolation";

const executor = (sqlite: DatabaseSync): SqliteExecutor => ({ all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[], run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params) });

describe("MIG-0016 learner data isolation", () => {
  it("migrates v15 additively while leaving legacy rows unowned", () => {
    const sqlite = new DatabaseSync(":memory:"); const database = executor(sqlite);
    const v15 = new MigrationRegistry(coreMigrationRegistry.migrations.filter(migration => migration.id !== "MIG-0016"));
    new FreshDatabaseBootstrap(database, v15).run();
    sqlite.exec("INSERT INTO flashcards(front,back,subject) VALUES('legacy','legacy','legacy'); INSERT INTO attempts(module,subject,score) VALUES('legacy','legacy',50)");
    expect(new FreshDatabaseBootstrap(database, coreMigrationRegistry).run()).toEqual({ currentVersion: 16, appliedMigrationIds: ["MIG-0016"] });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM flashcards").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM learner_flashcard_ownership").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM learner_attempt_ownership").get()).toEqual({ count: 0 });
    expect(LEARNER_OWNERSHIP_TABLES.every(table => sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name=?").get(table))).toBe(true);
    expect(sqlite.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    sqlite.close();
  });
});
