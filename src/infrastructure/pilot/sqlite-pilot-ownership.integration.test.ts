import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { FreshDatabaseBootstrap } from "@/infrastructure/database/sqlite/migrations/fresh-database-bootstrap";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import { SqlitePilotOwnership } from "./sqlite-pilot-ownership";

describe("SqlitePilotOwnership MCQ resume", () => {
  it("returns only the newest in-progress session owned by the learner", () => {
    const sqlite = new DatabaseSync(":memory:");
    const database: SqliteExecutor = {
      all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[],
      run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params),
    };
    new FreshDatabaseBootstrap(database).run();
    sqlite.exec("PRAGMA foreign_keys=ON");
    for (const learner of ["a", "b"]) sqlite.prepare("INSERT INTO accounts VALUES(?,?,?,?,?,?)").run(`account-${learner}`, `auth0|${learner}`, `learner-${learner}`, "ACTIVE", "now", "now");
    const insert = sqlite.prepare("INSERT INTO mcq_sessions(session_id,mode,status,blueprint_version_id,seed,started_at,completed_at,learner_id) VALUES(?,?,?,?,?,?,?,?)");
    insert.run("session-a-old", "STUDY", "IN_PROGRESS", "bp", "seed", "2026-01-01", null, "learner-a");
    insert.run("session-a-new", "STUDY", "IN_PROGRESS", "bp", "seed", "2026-02-01", null, "learner-a");
    insert.run("session-a-done", "STUDY", "COMPLETED", "bp", "seed", "2026-03-01", "2026-03-02", "learner-a");
    insert.run("session-b", "STUDY", "IN_PROGRESS", "bp", "seed", "2026-04-01", null, "learner-b");

    const ownership = new SqlitePilotOwnership(database);
    expect(ownership.findInProgressMcqSession("learner-a")).toBe("session-a-new");
    expect(ownership.findInProgressMcqSession("learner-b")).toBe("session-b");
    expect(ownership.findInProgressMcqSession("learner-missing")).toBeNull();
    expect(() => ownership.assertMcqSession("session-a-new", "learner-b")).toThrow();
    sqlite.close();
  });
});
