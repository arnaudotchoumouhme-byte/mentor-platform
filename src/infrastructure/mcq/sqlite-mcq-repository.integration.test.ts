import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import { FreshDatabaseBootstrap } from "@/infrastructure/database/sqlite/migrations/fresh-database-bootstrap";
import { SqliteMcqRepository } from "./sqlite-mcq-repository";
import { CreateMcqSession } from "@/application/mcq/create-mcq-session";
import { SubmitMcqAnswer } from "@/application/mcq/submit-mcq-answer";
import { CompleteMcqSession } from "@/application/mcq/complete-mcq-session";
import type { McqEvent } from "@/application/mcq/mcq-ports";
import { GetCompletedMcqSession } from "@/application/mcq/get-completed-mcq-session";
import { SqliteMcqErrors } from "@/infrastructure/progress/sqlite-mcq-errors";
import { SqliteAggregatedAttempts } from "@/infrastructure/progress/sqlite-aggregated-attempts";

describe("SqliteMcqRepository", () => {
  let sqlite: DatabaseSync; let db: SqliteExecutor; let repository: SqliteMcqRepository; const events: McqEvent[] = [];
  beforeEach(() => { sqlite = new DatabaseSync(":memory:"); sqlite.exec("PRAGMA foreign_keys=ON"); db = { all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[], run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params) }; new FreshDatabaseBootstrap(db).run(); sqlite.prepare("INSERT INTO documents(name,type) VALUES('Source','PDF')").run(); sqlite.prepare("INSERT INTO sources(source_id,storage_id,document_id,original_filename,display_name,media_type,extension,size_bytes,checksum,status,extraction_status,version,provenance_type) VALUES('source','storage',1,'source.pdf','Source','application/pdf','pdf',1,'hash','READY','COMPLETED',1,'TEST_FIXTURE')").run(); sqlite.prepare("INSERT INTO source_versions(source_version_id,source_id,version,checksum,extracted_content,extraction_status) VALUES('source-version','source',1,'hash','Synthetic','COMPLETED')").run(); for (const id of ["item-a", "item-b"]) { sqlite.prepare("INSERT INTO mcq_question_items(item_id,latest_version) VALUES(?,1)").run(id); sqlite.prepare("INSERT INTO mcq_question_versions(item_id,version,stem,choices_json,correct_choice_id,explanation,difficulty,provenance) VALUES(?,1,?,?,?,?,?,?)").run(id, `Stem ${id}`, JSON.stringify([{ id: "a", text: "A" }, { id: "b", text: "B" }]), "a", "Synthetic", "FOUNDATION", "SYNTHETIC_FIXTURE"); sqlite.prepare("INSERT INTO mcq_item_mappings VALUES(?,?,?,?,?,?,?)").run(id, 1, "bp-v1", "care", "assessment", "renal", "obj-1"); sqlite.prepare("INSERT INTO mcq_item_editorial_metadata VALUES(?,1,'PUBLISHED','source-version','DOCUMENT','fixture','Fixture','test',1,?,'now')").run(id,`checksum-${id}`); } repository = new SqliteMcqRepository(db); events.length = 0; });
  afterEach(() => sqlite.close());
  const deps = () => ({ ids: { next: () => "session-1" }, clock: { now: () => "2026-01-01T00:00:00.000Z" }, logger: { event: (event: McqEvent) => events.push(event) } });
  it("reads owned completed history and exact-version errors without changing scores or answers", async () => {
    const d = deps();
    const session = await new CreateMcqSession(repository, d.ids, d.clock, d.logger).execute({ learnerId: "learner", sessionKind: "STANDARD", durationSeconds: null, mode: "STUDY", count: 2, seed: "stable", blueprintVersionId: "bp-v1", traceId: "trace_12345678" });
    const history = new GetCompletedMcqSession(repository);
    await expect(history.execute(session.sessionId)).rejects.toMatchObject({ code: "MCQ_SESSION_INCOMPLETE" });
    const wrong = session.items[0]!;
    const right = session.items[1]!;
    const submit = new SubmitMcqAnswer(repository, d.clock, d.logger);
    for (const [item, choiceId] of [[wrong, "b"], [right, "a"]] as const) await submit.execute({ sessionId: session.sessionId, itemId: item.itemId, itemVersion: 1, choiceId, traceId: "trace_12345678" });
    const errors = new SqliteMcqErrors(db);
    expect(errors.list("learner")).toEqual([]);
    const completed = await new CompleteMcqSession(repository, d.clock, d.logger).execute({ sessionId: session.sessionId, traceId: "trace_12345678" });
    const before = sqlite.prepare("SELECT total_changes() AS n").get();
    sqlite.exec("PRAGMA query_only=ON");
    const historical = await history.execute(session.sessionId);
    expect(historical.score).toEqual(completed.score);
    expect(historical.items[0]?.answer).toMatchObject({ choiceId: "b", correct: false, correctChoiceId: "a", explanation: "Synthetic" });
    expect(historical.items[1]?.answer?.correct).toBe(true);
    expect(errors.list("learner")).toEqual([expect.objectContaining({ sessionId: session.sessionId, itemId: wrong.itemId, itemVersion: 1, position: 0, question: `Stem ${wrong.itemId}`, chosenAnswer: "B. B", correctAnswer: "A. A", topic: "renal", answeredAt: d.clock.now() })]);
    expect(errors.list("other-learner")).toEqual([]);
    expect(new SqliteAggregatedAttempts(db).list("learner")).toEqual([expect.objectContaining({ module: "QCM Partie I", subject: "renal", score: 50, question_count: 2, session_id: session.sessionId })]);
    expect(new SqliteAggregatedAttempts(db).list("other-learner")).toEqual([]);
    expect(sqlite.prepare("SELECT total_changes() AS n").get()).toEqual(before);
  });
  it("persists an ordered immutable snapshot and reads history", async () => { const d = deps(); const session = await new CreateMcqSession(repository, d.ids, d.clock, d.logger).execute({ learnerId: "learner", sessionKind: "STANDARD", durationSeconds: null, mode: "QUIZ", count: 2, seed: "stable", blueprintVersionId: "bp-v1", traceId: "trace_12345678" }); expect((await repository.findSession(session.sessionId))?.items.map(({ position }) => position)).toEqual([0, 1]); expect(sqlite.prepare("SELECT COUNT(*) count FROM mcq_session_items").get()).toEqual({ count: 2 }); });
  it("persists one answer and rejects a duplicate transactionally", async () => { const d = deps(); const session = await new CreateMcqSession(repository, d.ids, d.clock, d.logger).execute({ learnerId: "learner", sessionKind: "STANDARD", durationSeconds: null, mode: "STUDY", count: 1, seed: "stable", blueprintVersionId: "bp-v1", traceId: "trace_12345678" }); const item = session.items[0]!; const submit = new SubmitMcqAnswer(repository, d.clock, d.logger); const input = { sessionId: session.sessionId, itemId: item.itemId, itemVersion: item.itemVersion, choiceId: "a", traceId: "trace_12345678" }; await submit.execute(input); await expect(submit.execute(input)).rejects.toMatchObject({ code: "MCQ_ANSWER_DUPLICATE" }); expect(sqlite.prepare("SELECT COUNT(*) count FROM mcq_answers").get()).toEqual({ count: 1 }); });
  it("closes atomically and exposes the final structured score", async () => { const d = deps(); const session = await new CreateMcqSession(repository, d.ids, d.clock, d.logger).execute({ learnerId: "learner", sessionKind: "STANDARD", durationSeconds: null, mode: "QUIZ", count: 2, seed: "stable", blueprintVersionId: "bp-v1", traceId: "trace_12345678" }); const item = session.items[0]!; await new SubmitMcqAnswer(repository, d.clock, d.logger).execute({ sessionId: session.sessionId, itemId: item.itemId, itemVersion: item.itemVersion, choiceId: "b", durationMs: 700, traceId: "trace_12345678" }); const result = await new CompleteMcqSession(repository, d.clock, d.logger).execute({ sessionId: session.sessionId, traceId: "trace_12345678" }); expect(result.score).toMatchObject({ total: 2, answered: 1, correct: 0, incorrect: 1, unanswered: 1, percentage: 0 }); expect((await repository.findSession(session.sessionId))?.status).toBe("COMPLETED"); await expect(new SubmitMcqAnswer(repository, d.clock, d.logger).execute({ sessionId: session.sessionId, itemId: session.items[1]!.itemId, itemVersion: 1, choiceId: "a", traceId: "trace_12345678" })).rejects.toMatchObject({ code: "MCQ_SESSION_ALREADY_COMPLETED" }); });
  it("enforces relational integrity", () => expect(() => sqlite.prepare("INSERT INTO mcq_session_items VALUES('missing',0,'item-a',1)").run()).toThrow());
  it("selects only the latest published version while preserving older versions", async () => { sqlite.prepare("UPDATE mcq_question_items SET latest_version=3 WHERE item_id='item-a'").run(); for (const [version,status] of [[2,"PUBLISHED"],[3,"DRAFT"]] as const) { sqlite.prepare("INSERT INTO mcq_question_versions(item_id,version,stem,choices_json,correct_choice_id,explanation,difficulty,provenance) VALUES('item-a',?,'New stem','[{\"id\":\"a\",\"text\":\"A\"},{\"id\":\"b\",\"text\":\"B\"}]','a','New explanation','INTERMEDIATE','SOURCE_VERSION:source-version')").run(version); sqlite.prepare("INSERT INTO mcq_item_mappings VALUES('item-a',?,'bp-v1','care','assessment','renal','obj-1')").run(version); sqlite.prepare("INSERT INTO mcq_item_editorial_metadata VALUES('item-a',?,?,'source-version','DOCUMENT','fixture','Fixture','test',?,'checksum','now')").run(version,status,version); } const versions = await repository.listQuestionVersions("bp-v1"); expect(versions.filter(item => item.itemId === "item-a").map(item => item.version)).toEqual([2]); expect(versions.filter(item => item.itemId === "item-b").map(item => item.version)).toEqual([1]); });
  it("persists Mock Exam specialization, immutable duration and learner ownership in the creation transaction", async () => {
    const d = deps();
    const session = await new CreateMcqSession(repository, d.ids, d.clock, d.logger).execute({ learnerId: "learner-authoritative", sessionKind: "MOCK_EXAM", durationSeconds: 2_700, mode: "QUIZ", count: 2, seed: "stable", blueprintVersionId: "bp-v1", traceId: "trace_12345678" });
    expect(sqlite.prepare("SELECT learner_id,session_kind,duration_seconds FROM mcq_sessions WHERE session_id=?").get(session.sessionId)).toEqual({ learner_id: "learner-authoritative", session_kind: "MOCK_EXAM", duration_seconds: 2_700 });
    expect((await repository.findSession(session.sessionId))).toMatchObject({ sessionKind: "MOCK_EXAM", durationSeconds: 2_700 });
  });
  it("re-scores from the persisted answer when an answer wins the expiration race", async () => {
    const d = deps();
    const session = await new CreateMcqSession(repository, d.ids, d.clock, d.logger).execute({ learnerId: "learner", sessionKind: "MOCK_EXAM", durationSeconds: 60, mode: "QUIZ", count: 1, seed: "stable", blueprintVersionId: "bp-v1", traceId: "trace_12345678" });
    const item = session.items[0]!;
    const submit = new SubmitMcqAnswer(repository, { now: () => "2026-01-01T00:00:59.000Z" }, d.logger);
    const persistCompletion = repository.completeSession.bind(repository);
    let answerInjected = false;
    repository.completeSession = async (completed, score) => {
      if (!answerInjected) {
        answerInjected = true;
        await submit.execute({ sessionId: session.sessionId, itemId: item.itemId, itemVersion: item.itemVersion, choiceId: "a", traceId: "trace_12345678" });
      }
      return persistCompletion(completed, score);
    };

    const result = await new CompleteMcqSession(repository, { now: () => "2026-01-01T00:01:00.000Z" }, d.logger).execute({ sessionId: session.sessionId, traceId: "trace_12345678", reason: "EXPIRATION" });
    const persistedAnswers = sqlite.prepare("SELECT COUNT(*) AS count FROM mcq_answers WHERE session_id=?").get(session.sessionId) as { count: number };

    expect(persistedAnswers.count).toBe(1);
    expect(result.score).toMatchObject({ answered: 1, correct: 1, unanswered: 0, percentage: 100 });
    expect(await repository.findScore(session.sessionId)).toEqual(result.score);
    expect(persistedAnswers.count === 1 && result.score.answered === 0).toBe(false);
  });
  it("rejects the answer without persisting it when expiration wins the race", async () => {
    const d = deps();
    const session = await new CreateMcqSession(repository, d.ids, d.clock, d.logger).execute({ learnerId: "learner", sessionKind: "MOCK_EXAM", durationSeconds: 60, mode: "QUIZ", count: 1, seed: "stable", blueprintVersionId: "bp-v1", traceId: "trace_12345678" });
    const item = session.items[0]!;
    const persistAnswer = repository.saveAnswer.bind(repository);
    const expire = new CompleteMcqSession(repository, { now: () => "2026-01-01T00:01:00.000Z" }, d.logger);
    let expirationInjected = false;
    repository.saveAnswer = async (sessionId, answer) => {
      if (!expirationInjected) {
        expirationInjected = true;
        await expire.execute({ sessionId, traceId: "trace_12345678", reason: "EXPIRATION" });
      }
      return persistAnswer(sessionId, answer);
    };

    const submit = new SubmitMcqAnswer(repository, { now: () => "2026-01-01T00:00:59.000Z" }, d.logger);
    await expect(submit.execute({ sessionId: session.sessionId, itemId: item.itemId, itemVersion: item.itemVersion, choiceId: "a", traceId: "trace_12345678" })).rejects.toMatchObject({ code: "MCQ_SESSION_ALREADY_COMPLETED" });

    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM mcq_answers WHERE session_id=?").get(session.sessionId)).toEqual({ count: 0 });
    expect(await repository.findScore(session.sessionId)).toMatchObject({ answered: 0, unanswered: 1, percentage: 0 });
  });
});
