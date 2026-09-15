import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { FreshDatabaseBootstrap } from "@/infrastructure/database/sqlite/migrations/fresh-database-bootstrap";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import { SqlitePilotOwnership } from "./sqlite-pilot-ownership";

function setup() {
  const sqlite = new DatabaseSync(":memory:");
  const database: SqliteExecutor = { all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[], run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params) };
  new FreshDatabaseBootstrap(database).run();
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const learner of ["a", "b"]) sqlite.prepare("INSERT INTO accounts VALUES(?,?,?,?,?,?)").run(`account-${learner}`, `auth0|${learner}`, `learner-${learner}`, "ACTIVE", "now", "now");
  return { sqlite, ownership: new SqlitePilotOwnership(database) };
}

describe("SqlitePilotOwnership MCQ resume", () => {
  it("returns only the newest ordinary in-progress session owned by the learner", () => {
    const { sqlite, ownership } = setup();
    const insert = sqlite.prepare("INSERT INTO mcq_sessions(session_id,mode,status,blueprint_version_id,seed,started_at,completed_at,learner_id,session_kind) VALUES(?,?,?,?,?,?,?,?,?)");
    insert.run("session-a-old", "STUDY", "IN_PROGRESS", "bp", "seed", "2026-01-01", null, "learner-a", null);
    insert.run("session-a-new", "STUDY", "IN_PROGRESS", "bp", "seed", "2026-02-01", null, "learner-a", "STANDARD");
    insert.run("session-b", "STUDY", "IN_PROGRESS", "bp", "seed", "2026-04-01", null, "learner-b", "STANDARD");
    expect(ownership.findInProgressMcqSession("learner-a")).toBe("session-a-new");
    expect(ownership.findInProgressMcqSession("learner-b")).toBe("session-b");
    expect(() => ownership.assertMcqSession("session-a-new", "learner-b")).toThrow();
    sqlite.prepare("UPDATE mcq_sessions SET status='COMPLETED', completed_at='2026-05-01' WHERE learner_id='learner-a'").run();
    expect(ownership.findInProgressMcqSession("learner-a")).toBeNull();
    expect(ownership.findInProgressMcqSession("learner-without-sessions")).toBeNull();
    sqlite.close();
  });

  it("isolates Mock Exam resume without reclassifying STANDARD or NULL sessions", () => {
    const { sqlite, ownership } = setup();
    const insert = sqlite.prepare("INSERT INTO mcq_sessions(session_id,mode,status,blueprint_version_id,seed,started_at,learner_id,session_kind,duration_seconds) VALUES(?,?,?,?,?,?,?,?,?)");
    insert.run("historical", "QUIZ", "IN_PROGRESS", "bp", "seed", "2026-01-01", "learner-a", null, null);
    insert.run("standard", "QUIZ", "IN_PROGRESS", "bp", "seed", "2026-02-01", "learner-a", "STANDARD", null);
    insert.run("mock", "QUIZ", "IN_PROGRESS", "bp", "seed", "2026-03-01", "learner-a", "MOCK_EXAM", 2_700);
    expect(ownership.findInProgressMcqSession("learner-a", "MOCK_EXAM")).toBe("mock");
    expect(ownership.findInProgressMcqSession("learner-a", "STANDARD")).toBe("standard");
    sqlite.close();
  });
});
