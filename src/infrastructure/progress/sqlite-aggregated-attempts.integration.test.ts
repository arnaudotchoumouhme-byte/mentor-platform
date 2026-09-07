import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FreshDatabaseBootstrap } from "@/infrastructure/database/sqlite/migrations/fresh-database-bootstrap";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import { SqliteAggregatedAttempts } from "./sqlite-aggregated-attempts";

describe("SqliteAggregatedAttempts", () => {
  let sqlite: DatabaseSync;
  let attempts: SqliteAggregatedAttempts;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    const database: SqliteExecutor = { all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[], run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params) };
    new FreshDatabaseBootstrap(database).run();
    sqlite.exec("PRAGMA foreign_keys=ON");
    for (const learner of ["a", "b"]) sqlite.prepare("INSERT INTO accounts VALUES(?,?,?,?,?,?)").run(`account-${learner}`, `auth0|${learner}`, `learner-${learner}`, "ACTIVE", "now", "now");
    attempts = new SqliteAggregatedAttempts(database);
  });

  afterEach(() => sqlite.close());

  it("aggregates historical attempts and completed Mock Exams without misclassifying other sessions", () => {
    const legacy = sqlite.prepare("INSERT INTO attempts(module,subject,score,duration_minutes,created_at) VALUES('Legacy','SNC',70,12,'2026-01-01T00:00:00.000Z')").run();
    sqlite.prepare("INSERT INTO learner_attempt_ownership VALUES(?,?)").run(legacy.lastInsertRowid, "learner-a");
    const insert = sqlite.prepare("INSERT INTO mcq_sessions(session_id,mode,status,blueprint_version_id,seed,started_at,completed_at,learner_id,session_kind,duration_seconds,percentage) VALUES(?,?,?,?,?,?,?,?,?,?,?)");
    insert.run("mock-a", "QUIZ", "COMPLETED", "bp", "seed", "2026-01-02T00:00:00.000Z", "2026-01-02T00:30:00.000Z", "learner-a", "MOCK_EXAM", 2700, 80);
    insert.run("standard-a", "QUIZ", "COMPLETED", "bp", "seed", "2026-01-03T00:00:00.000Z", "2026-01-03T00:10:00.000Z", "learner-a", "STANDARD", null, 100);
    insert.run("historical-null", "QUIZ", "COMPLETED", "bp", "seed", "2026-01-04T00:00:00.000Z", "2026-01-04T00:10:00.000Z", "learner-a", null, null, 100);
    insert.run("mock-b", "QUIZ", "COMPLETED", "bp", "seed", "2026-01-05T00:00:00.000Z", "2026-01-05T00:10:00.000Z", "learner-b", "MOCK_EXAM", 2700, 100);

    expect(attempts.list("learner-a")).toEqual([
      { id: "mcq:mock-a", module: "Examen blanc", subject: "QCM", score: 80, duration_minutes: 30, created_at: "2026-01-02T00:30:00.000Z" },
      { id: Number(legacy.lastInsertRowid), module: "Legacy", subject: "SNC", score: 70, duration_minutes: 12, created_at: "2026-01-01T00:00:00.000Z" },
    ]);
  });
});
