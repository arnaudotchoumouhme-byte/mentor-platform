import { createHash } from "node:crypto";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FreshDatabaseBootstrap } from "@/infrastructure/database/sqlite/migrations/fresh-database-bootstrap";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import { ImportMcqCorpus } from "@/application/mcq/import-mcq-corpus";
import { CourseTraining } from "@/application/mcq/course-training";
import { generatedCourseItems } from "@/application/mcq/course-generation";
import { CreateMcqSession } from "@/application/mcq/create-mcq-session";
import { SubmitMcqAnswer } from "@/application/mcq/submit-mcq-answer";
import { CompleteMcqSession } from "@/application/mcq/complete-mcq-session";
import { GetCompletedMcqSession } from "@/application/mcq/get-completed-mcq-session";
import { SqliteMcqErrors } from "@/infrastructure/progress/sqlite-mcq-errors";
import { SqliteAggregatedAttempts } from "@/infrastructure/progress/sqlite-aggregated-attempts";
import { SqlitePilotOwnership } from "@/infrastructure/pilot/sqlite-pilot-ownership";
import { SqliteCourseTraining } from "./sqlite-course-training";
import { SqliteMcqCorpusWriter } from "./sqlite-mcq-corpus-writer";
import { SqliteMcqRepository } from "./sqlite-mcq-repository";

const text = "Le pharmacien recueille les données pertinentes avant de proposer un plan de soins.";
const candidate = { stem: "Quelle est la première étape ?", options: ["Recueillir les données", "Ignorer le dossier", "Conclure sans données", "Omettre le suivi"], correct: "a", explanation: text, simple: text, analogy: "NOT_SUPPORTED_BY_SOURCE", mechanism: text, reasoning: text, clue: "Avant de proposer", justifications: [text, text, text, text], trap: "NOT_SUPPORTED_BY_SOURCE", takeaway: text, transfer: text, quote: text, competency: "1.1" };

describe("course training / synthetic v20 only", () => {
  let sqlite: DatabaseSync; let db: SqliteExecutor; let service: CourseTraining; let repository: SqliteCourseTraining; let catalog: SqliteMcqRepository;
  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    db = { all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[], run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params) };
    new FreshDatabaseBootstrap(db).run(); sqlite.exec("PRAGMA foreign_keys=ON");
    for (const who of ["a", "b"]) sqlite.prepare("INSERT INTO accounts VALUES(?,?,?,?,?,?)").run(`account-${who}`, `auth0|${who}`, `learner-${who}`, "ACTIVE", "now", "now");
    sqlite.exec("INSERT INTO documents(id,name,type) VALUES(1,'Cours synthétique','PDF'); INSERT INTO learner_document_ownership VALUES(1,'learner-a'); INSERT INTO sources(source_id,storage_id,document_id,original_filename,display_name,media_type,extension,size_bytes,checksum,status,extraction_status,version,provenance_type) VALUES('s','storage',1,'cours.pdf','Cours','application/pdf','pdf',80,'hash','READY','COMPLETED',1,'USER_UPLOAD')");
    sqlite.prepare("INSERT INTO source_versions(source_version_id,source_id,version,checksum,extracted_content,extraction_status) VALUES(?,'s',1,'hash',?,'COMPLETED')").run("00000000-0000-4000-8000-000000000001", text);
    const importer = new ImportMcqCorpus(new SqliteMcqCorpusWriter(db), { checksum: v => createHash("sha256").update(v).digest("hex") }, { now: () => "2026-09-25" });
    repository = new SqliteCourseTraining(db, importer); catalog = new SqliteMcqRepository(db);
    let sequence = 0;
    service = new CourseTraining(repository, { generate: async (source, count) => generatedCourseItems({ questions: Array.from({ length: count }, (_, i) => ({ ...candidate, stem: candidate.stem + i })) }, source) }, () => `test-${++sequence}`);
  });
  afterEach(() => sqlite.close());
  const generate = () => service.execute(1, "learner-a", { action: "generate", desiredQuestionCount: 2 });
  it("denies another learner before generation and conceals document existence", async () => {
    await expect(service.execute(1, "learner-b", { action: "generate", desiredQuestionCount: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(() => service.read(99, "learner-b")).toThrow("Accès refusé");
    expect(db.all("SELECT * FROM mcq_question_items")).toHaveLength(0);
  });
  it.each(["UPDATE sources SET status='FAILED'", "UPDATE sources SET extraction_status='FAILED'", "UPDATE source_versions SET extraction_status='FAILED'"])("rejects unavailable source: %s", async sql => {
    // FAILED is a valid source/extraction state in the synthetic schema.
    sqlite.exec(sql);
    await expect(generate()).rejects.toThrow();
  });
  it("generates only sourced drafts, refuses implicit publication", async () => {
    const state = await generate();
    expect(state.questions).toHaveLength(2); expect(state.questions.every(q => q.status === "DRAFT")).toBe(true);
    expect(service.read(1, "learner-a")).toEqual(state);
    expect(state.questions[0]).toMatchObject({ choices: expect.arrayContaining([{ id: "a", text: candidate.options[0] }]), correctChoiceId: "a", reference: "Cours synthétique" });
    expect(state.questions[0].explanation).toContain("D — FAUX");
    expect(await catalog.listPublishedBlueprints("learner-a")).toEqual([]);
    await expect(service.execute(1, "learner-a", { action: "publish", confirmReviewed: true, approvals: state.questions.map(q => ({ itemId: q.itemId, expectedVersion: q.version })) })).rejects.toThrow("Validez");
    await expect(generate()).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("edits, rejects, approves and publishes as immutable versions then starts a source-only session", async () => {
    const state = await generate(); const [first, second] = state.questions;
    const old = db.all("SELECT * FROM mcq_question_versions ORDER BY item_id,version");
    await service.execute(1, "learner-a", { action: "edit", itemId: first.itemId, expectedVersion: 1, edit: { stem: "Énoncé revu", choices: first.choices, correctChoiceId: first.correctChoiceId, explanation: first.explanation } });
    await expect(service.execute(1, "learner-a", { action: "approve", itemId: first.itemId, expectedVersion: 1 })).rejects.toMatchObject({ code: "CONFLICT" });
    await service.execute(1, "learner-a", { action: "approve", itemId: first.itemId, expectedVersion: 2 });
    expect(service.read(1, "learner-a").questions.find(q => q.itemId === first.itemId)?.status).toBe("IN_REVIEW");
    expect(await catalog.listQuestionVersions("PEBC-PART-I-2026", "learner-a", 1)).toEqual([]);
    await service.execute(1, "learner-a", { action: "reject", itemId: second.itemId, expectedVersion: 1 });
    await service.execute(1, "learner-a", { action: "publish", confirmReviewed: true, approvals: [{ itemId: first.itemId, expectedVersion: 3 }] });
    expect(db.all("SELECT * FROM mcq_question_versions WHERE version=1 ORDER BY item_id,version")).toEqual(old);
    expect(await catalog.listPublishedBlueprints("learner-b")).toEqual([]);
    expect(await catalog.listPublishedBlueprints()).toEqual([]);
    expect((await catalog.listQuestionVersions("PEBC-PART-I-2026", "learner-a", 1))).toHaveLength(1);
    await expect(catalog.listQuestionVersions("PEBC-PART-I-2026", "learner-b", 1)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const session = await new CreateMcqSession(catalog, { next: () => "session" }, { now: () => "2026-09-25T12:00:00Z" }, { event: vi.fn() }).execute({ learnerId: "learner-a", documentId: 1, sessionKind: "STANDARD", mode: "STUDY", durationSeconds: null, count: 1, seed: "seed", blueprintVersionId: "PEBC-PART-I-2026", traceId: "trace" });
    expect(session.items[0].itemId).toBe(first.itemId);
    expect(session.items.some(q => q.itemId === second.itemId)).toBe(false);
    const records = repository.list(repository.resolve(1, "learner-a"));
    const published = records.find(r => r.item.itemId === first.itemId)!.item;
    expect(published.choices).toHaveLength(4);
    expect(published.choices.filter(c => c.id === published.correctChoiceId)).toHaveLength(1);
    expect(published.source).toEqual({ sourceVersionId: "00000000-0000-4000-8000-000000000001", reference: { type: "DOCUMENT", locator: "Extrait vérifié dans le cours", label: "Cours synthétique" } });
    expect(published.explanation).toBe(first.explanation);
    expect(records.find(r => r.item.itemId === second.itemId)?.item.status).toBe("RETIRED");
    const ownership = new SqlitePilotOwnership(db);
    expect(ownership.findInProgressMcqSession("learner-a")).toBe("session");
    expect(() => ownership.assertMcqSession("session", "learner-b")).toThrow();
    const clock = { now: () => "2026-09-25T12:01:00Z" }; const logger = { event: vi.fn() };
    await new SubmitMcqAnswer(catalog, clock, logger).execute({ sessionId: "session", itemId: first.itemId, itemVersion: 4, choiceId: "b", traceId: "trace" });
    await new CompleteMcqSession(catalog, clock, logger).execute({ sessionId: "session", traceId: "trace" });
    expect((await catalog.findScore("session"))?.percentage).toBe(0);
    expect(new SqliteMcqErrors(db).list("learner-a")).toHaveLength(1);
    expect(new SqliteMcqErrors(db).list("learner-b")).toHaveLength(0);
    expect(new SqliteAggregatedAttempts(db).list("learner-a")).toHaveLength(1);
    expect(ownership.findInProgressMcqSession("learner-a")).toBeNull();
    const beforeRead = sqlite.prepare("SELECT total_changes() n").get();
    await new GetCompletedMcqSession(catalog).execute("session");
    expect(sqlite.prepare("SELECT total_changes() n").get()).toEqual(beforeRead);
    expect(db.all("PRAGMA integrity_check")).toEqual([{ integrity_check: "ok" }]);
    expect(db.all("SELECT learner_id FROM learner_document_ownership")).toEqual([{ learner_id: "learner-a" }]);
  });
  it("rejects fabricated quotations and duplicate options before persistence", () => {
    const source = repository.resolve(1, "learner-a");
    expect(() => generatedCourseItems({ questions: [{ ...candidate, quote: "Texte inexistant dans le document de référence." }] }, source)).toThrow();
    expect(() => generatedCourseItems({ questions: [{ ...candidate, options: ["a", "a", "b", "c"] }] }, source)).toThrow();
  });
  it("refuses invalid edits without writing, then resets an approved edit to DRAFT", async () => {
    const { questions: [first] } = await generate();
    const edit = { stem: first.stem, choices: first.choices, correctChoiceId: first.correctChoiceId, explanation: first.explanation };
    const before = sqlite.prepare("SELECT total_changes() n").get();
    for (const invalid of [
      { ...edit, choices: first.choices.slice(0, 3) },
      { ...edit, choices: first.choices.map(() => first.choices[0]) },
      { ...edit, correctChoiceId: "missing" },
      { ...edit, correctChoiceId: "b" }, // stale A/B truth labels
      { ...edit, explanation: "Correction sans structure" },
      { ...edit, source: { sourceVersionId: "forged" } },
    ]) {
      await expect(service.execute(1, "learner-a", { action: "edit", itemId: first.itemId, expectedVersion: 1, edit: invalid })).rejects.toThrow();
    }
    expect(sqlite.prepare("SELECT total_changes() n").get()).toEqual(before);
    await service.execute(1, "learner-a", { action: "approve", itemId: first.itemId, expectedVersion: 1 });
    const edited = await service.execute(1, "learner-a", { action: "edit", itemId: first.itemId, expectedVersion: 2, edit: { ...edit, stem: "Question revue" } });
    expect(edited.questions.find(q => q.itemId === first.itemId)).toMatchObject({ version: 3, status: "DRAFT" });
    await expect(service.execute(1, "learner-a", { action: "publish", confirmReviewed: true, approvals: [{ itemId: first.itemId, expectedVersion: 3 }] })).rejects.toThrow("Validez");
    expect(await catalog.listQuestionVersions("PEBC-PART-I-2026", "learner-a", 1)).toEqual([]);
  });
  it("retains rejected records but cannot start a study session from them", async () => {
    const { questions } = await generate();
    for (const q of questions) await service.execute(1, "learner-a", { action: "reject", itemId: q.itemId, expectedVersion: 1 });
    expect(service.read(1, "learner-a").questions.every(q => q.status === "RETIRED")).toBe(true);
    expect(db.all("SELECT * FROM mcq_question_versions")).toHaveLength(4);
    expect(await catalog.listQuestionVersions("PEBC-PART-I-2026", "learner-a", 1)).toEqual([]);
    await expect(new CreateMcqSession(catalog, { next: () => "rejected-session" }, { now: () => "2026-09-25T12:00:00Z" }, { event: vi.fn() }).execute({ learnerId: "learner-a", documentId: 1, sessionKind: "STANDARD", mode: "STUDY", durationSeconds: null, count: 1, seed: "seed", blueprintVersionId: "PEBC-PART-I-2026", traceId: "trace" })).rejects.toThrow();
    expect(db.all("SELECT * FROM mcq_sessions")).toHaveLength(0);
    await expect(service.execute(1, "learner-a", { action: "approve", itemId: questions[0].itemId, expectedVersion: 2 })).rejects.toThrow();
  });
  it("requires resolution of insufficient-source markers and explicit publication confirmation", async () => {
    const { questions: [first] } = await generate();
    const marker = "HUMAN_REVIEW_REQUIRED: INSUFFICIENT_SOURCE";
    await service.execute(1, "learner-a", { action: "edit", itemId: first.itemId, expectedVersion: 1, edit: { stem: first.stem, choices: first.choices, correctChoiceId: first.correctChoiceId, explanation: first.explanation.replace(`B — FAUX\n\n${text}`, `B — FAUX\n\n${marker}`) } });
    await expect(service.execute(1, "learner-a", { action: "approve", itemId: first.itemId, expectedVersion: 2 })).rejects.toThrow("non étayés");
    await service.execute(1, "learner-a", { action: "edit", itemId: first.itemId, expectedVersion: 2, edit: { stem: first.stem, choices: first.choices, correctChoiceId: first.correctChoiceId, explanation: first.explanation } });
    await service.execute(1, "learner-a", { action: "approve", itemId: first.itemId, expectedVersion: 3 });
    const command = { action: "publish" as const, confirmReviewed: true as const, approvals: [{ itemId: first.itemId, expectedVersion: 4 }] };
    await expect(service.execute(1, "learner-a", { ...command, confirmReviewed: false } as unknown as typeof command)).rejects.toThrow("Confirmez");
    expect(await catalog.listQuestionVersions("PEBC-PART-I-2026", "learner-a", 1)).toEqual([]);
  });
  it("keeps pre-existing official corpora global without changing them", async () => {
    const source = repository.resolve(1, "learner-a");
    const [item] = generatedCourseItems({ questions: [candidate] }, source);
    await repository.save({ schemaVersion: "MCQ_CORPUS/1", corpusId: "official-fixture", corpusVersion: 1, blueprintVersionId: "PEBC-PART-I-2026", items: [{ ...item, itemId: "GLOBAL-FIXTURE", status: "PUBLISHED" }] });
    const before = db.all("SELECT * FROM mcq_question_versions WHERE item_id='GLOBAL-FIXTURE'");
    await generate();
    expect(await catalog.listQuestionVersions("PEBC-PART-I-2026", "learner-b")).toHaveLength(1);
    expect(await catalog.listQuestionVersions("PEBC-PART-I-2026", "learner-a")).toHaveLength(1);
    expect(db.all("SELECT * FROM mcq_question_versions WHERE item_id='GLOBAL-FIXTURE'")).toEqual(before);
  });
});
