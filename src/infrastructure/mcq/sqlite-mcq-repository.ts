import type { McqRepository } from "@/application/mcq/mcq-ports";
import { defineQuestionItemVersion, type QuestionItemVersion } from "@/domain/mcq/question-item";
import { createSession, recordSessionAnswer, type McqSession, type SessionAnswer } from "@/domain/mcq/mcq-session";
import type { McqScore } from "@/domain/mcq/scoring";
import { McqError } from "@/domain/mcq/mcq-errors";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";

type ItemRow = Readonly<{ item_id: string; version: number; stem: string; choices_json: string; correct_choice_id: string; explanation: string; difficulty: QuestionItemVersion["difficulty"]; provenance: string | null }>;
type MappingRow = Readonly<{ item_id: string; item_version: number; blueprint_version_id: string; domain_id: string; competency_id: string; topic_id: string; objective_id: string }>;
type SessionRow = Readonly<{ session_id: string; mode: McqSession["mode"]; status: McqSession["status"]; blueprint_version_id: string; seed: string; started_at: string; completed_at: string | null; score_json: string | null }>;
type SessionItemRow = Readonly<{ item_id: string; item_version: number; position: number }>;
type AnswerRow = Readonly<{ item_id: string; item_version: number; choice_id: string; correct: number; duration_ms: number | null; error_classification: string | null; answered_at: string }>;

export class SqliteMcqRepository implements McqRepository {
  constructor(private readonly database: SqliteExecutor) {}
  private mappings(itemId: string, version: number): QuestionItemVersion["mappings"] {
    const rows = this.database.all<MappingRow>("SELECT * FROM mcq_item_mappings WHERE item_id=? AND item_version=? ORDER BY blueprint_version_id,domain_id,competency_id,topic_id,objective_id", itemId, version);
    const groups = new Map<string, { blueprintVersionId: string; domainId: string; competencyId: string; topicId: string; objectiveIds: string[] }>();
    for (const row of rows) { const key = `${row.blueprint_version_id}\0${row.domain_id}\0${row.competency_id}\0${row.topic_id}`; const group = groups.get(key) ?? { blueprintVersionId: row.blueprint_version_id, domainId: row.domain_id, competencyId: row.competency_id, topicId: row.topic_id, objectiveIds: [] }; group.objectiveIds.push(row.objective_id); groups.set(key, group); }
    return [...groups.values()];
  }
  private item(row: ItemRow): QuestionItemVersion { return defineQuestionItemVersion({ itemId: row.item_id, version: row.version, stem: row.stem, choices: JSON.parse(row.choices_json) as QuestionItemVersion["choices"], correctChoiceId: row.correct_choice_id, explanation: row.explanation, difficulty: row.difficulty, provenance: row.provenance, mappings: this.mappings(row.item_id, row.version) }); }
  async listQuestionVersions(blueprintVersionId: string) { return this.database.all<ItemRow>("SELECT DISTINCT v.* FROM mcq_question_versions v JOIN mcq_item_mappings m ON m.item_id=v.item_id AND m.item_version=v.version WHERE m.blueprint_version_id=? ORDER BY v.item_id,v.version", blueprintVersionId).map((row) => this.item(row)); }
  async findQuestionVersion(itemId: string, version: number) { const row = this.database.all<ItemRow>("SELECT * FROM mcq_question_versions WHERE item_id=? AND version=?", itemId, version)[0]; return row ? this.item(row) : null; }
  async createSession(session: McqSession): Promise<void> {
    this.database.run("BEGIN IMMEDIATE");
    try { this.database.run("INSERT INTO mcq_sessions(session_id,mode,status,blueprint_version_id,seed,started_at) VALUES(?,?,?,?,?,?)", session.sessionId, session.mode, session.status, session.blueprintVersionId, session.seed, session.startedAt); for (const item of session.items) this.database.run("INSERT INTO mcq_session_items(session_id,position,item_id,item_version) VALUES(?,?,?,?)", session.sessionId, item.position, item.itemId, item.itemVersion); this.database.run("COMMIT"); }
    catch (cause) { this.database.run("ROLLBACK"); throw new McqError("MCQ_ANSWER_INVALID", "La session MCQ ne peut pas être créée.", "MCQ session transaction failed.", { sessionId: session.sessionId, cause }); }
  }
  async findSession(sessionId: string): Promise<McqSession | null> {
    const row = this.database.all<SessionRow>("SELECT * FROM mcq_sessions WHERE session_id=?", sessionId)[0]; if (!row) return null;
    const items = this.database.all<SessionItemRow>("SELECT item_id,item_version,position FROM mcq_session_items WHERE session_id=? ORDER BY position", sessionId).map((item) => ({ itemId: item.item_id, itemVersion: item.item_version, position: item.position }));
    let session = createSession({ sessionId: row.session_id, mode: row.mode, blueprintVersionId: row.blueprint_version_id, seed: row.seed, items, startedAt: row.started_at });
    for (const answer of this.database.all<AnswerRow>("SELECT * FROM mcq_answers WHERE session_id=? ORDER BY answered_at", sessionId)) session = recordSessionAnswer(session, { itemId: answer.item_id, itemVersion: answer.item_version, choiceId: answer.choice_id, correct: answer.correct === 1, durationMs: answer.duration_ms, errorClassification: answer.error_classification, answeredAt: answer.answered_at });
    return row.status === "COMPLETED" ? Object.freeze({ ...session, status: "COMPLETED", completedAt: row.completed_at }) : session;
  }
  async saveAnswer(sessionId: string, answer: SessionAnswer): Promise<McqSession> {
    this.database.run("BEGIN IMMEDIATE");
    try { const status = this.database.all<{ status: string }>("SELECT status FROM mcq_sessions WHERE session_id=?", sessionId)[0]?.status; if (status !== "IN_PROGRESS") throw new McqError(status ? "MCQ_SESSION_ALREADY_COMPLETED" : "MCQ_SESSION_NOT_FOUND", status ? "Cette session est déjà terminée." : "Session MCQ introuvable.", "Session cannot accept an answer."); this.database.run("INSERT INTO mcq_answers(session_id,item_id,item_version,choice_id,correct,duration_ms,error_classification,answered_at) VALUES(?,?,?,?,?,?,?,?)", sessionId, answer.itemId, answer.itemVersion, answer.choiceId, answer.correct ? 1 : 0, answer.durationMs, answer.errorClassification, answer.answeredAt); this.database.run("COMMIT"); }
    catch (cause) { this.database.run("ROLLBACK"); if (cause instanceof McqError) throw cause; throw new McqError("MCQ_ANSWER_DUPLICATE", "Cette question a déjà reçu une réponse.", "Answer persistence constraint rejected the answer.", { sessionId, itemId: answer.itemId, cause }); }
    return (await this.findSession(sessionId))!;
  }
  async completeSession(session: McqSession, score: McqScore): Promise<void> {
    this.database.run("BEGIN IMMEDIATE");
    try { const result = this.database.run("UPDATE mcq_sessions SET status='COMPLETED',completed_at=?,total_count=?,answered_count=?,correct_count=?,incorrect_count=?,unanswered_count=?,percentage=?,score_json=? WHERE session_id=? AND status='IN_PROGRESS'", session.completedAt, score.total, score.answered, score.correct, score.incorrect, score.unanswered, score.percentage, JSON.stringify(score), session.sessionId); if (result.changes !== 1) throw new McqError("MCQ_SESSION_ALREADY_COMPLETED", "Cette session est déjà terminée.", "Session completion update was rejected."); this.database.run("COMMIT"); }
    catch (cause) { this.database.run("ROLLBACK"); throw cause; }
  }
  async findScore(sessionId: string): Promise<McqScore | null> { const json = this.database.all<{ score_json: string | null }>("SELECT score_json FROM mcq_sessions WHERE session_id=?", sessionId)[0]?.score_json; return json ? JSON.parse(json) as McqScore : null; }
}
