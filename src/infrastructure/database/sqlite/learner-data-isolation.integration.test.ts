import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { SqliteExecutor } from "./sqlite-executor";
import { FreshDatabaseBootstrap } from "./migrations/fresh-database-bootstrap";
import { SqliteMentorActions } from "./sqlite-mentor-actions";

const executor = (sqlite: DatabaseSync): SqliteExecutor => ({ all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[], run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params) });

describe("legacy learner data isolation", () => {
  it("filters lists and rejects cross-learner updates while preserving owner writes", async () => {
    const sqlite = new DatabaseSync(":memory:"); sqlite.exec("PRAGMA foreign_keys=ON"); const db = executor(sqlite); new FreshDatabaseBootstrap(db).run();
    for (const learner of ["learner-a", "learner-b"]) sqlite.prepare("INSERT INTO accounts(account_id,oidc_subject,learner_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(`account-${learner}`, `auth0|${learner}`, learner, "ACTIVE", "now", "now");
    const actions = new SqliteMentorActions(db);
    await actions.addFlashcard({ front: "private-a", back: "answer-a", subject: "SNC" }, "learner-a");
    await actions.addFlashcard({ front: "private-b", back: "answer-b", subject: "SNC" }, "learner-b");
    await actions.saveAttempt({ module: "QCM", subject: "SNC", score: 80, minutes: 5 }, "learner-a");
    await actions.saveSettings({ language: "fr" }, "learner-a");
    const cardA = sqlite.prepare("SELECT f.id FROM flashcards f JOIN learner_flashcard_ownership o ON o.flashcard_id=f.id WHERE o.learner_id='learner-a'").get() as { id: number };
    expect(await actions.scheduleCardReview(cardA.id, 4, "learner-b")).toBe(false);
    expect(await actions.scheduleCardReview(cardA.id, 4, "learner-a")).toBe(true);
    expect(sqlite.prepare("SELECT f.front FROM flashcards f JOIN learner_flashcard_ownership o ON o.flashcard_id=f.id WHERE o.learner_id=?").all("learner-a")).toEqual([{ front: "private-a" }]);
    expect(sqlite.prepare("SELECT f.front FROM flashcards f JOIN learner_flashcard_ownership o ON o.flashcard_id=f.id WHERE o.learner_id=?").all("learner-b")).toEqual([{ front: "private-b" }]);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM attempts a JOIN learner_attempt_ownership o ON o.attempt_id=a.id WHERE o.learner_id='learner-b'").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT value FROM learner_settings WHERE learner_id='learner-b'").all()).toEqual([]);
    sqlite.close();
  });

  it("keeps pre-migration legacy rows unowned and therefore invisible", () => {
    const sqlite = new DatabaseSync(":memory:"); const db = executor(sqlite); new FreshDatabaseBootstrap(db).run();
    sqlite.prepare("INSERT INTO flashcards(front,back,subject) VALUES('unowned','private','legacy')").run();
    expect(sqlite.prepare("SELECT f.id FROM flashcards f JOIN learner_flashcard_ownership o ON o.flashcard_id=f.id WHERE o.learner_id=?").all("learner-a")).toEqual([]);
    sqlite.close();
  });
});
