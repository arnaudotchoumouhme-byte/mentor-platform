import { recordSessionAnswer, type McqSession, type SessionAnswer } from "@/domain/mcq/mcq-session";
import type { McqScore } from "@/domain/mcq/scoring";
import type { QuestionItemVersion } from "@/domain/mcq/question-item";
import type { McqEvent, McqRepository } from "./mcq-ports";
import { syntheticMcqItem } from "@/test/fixtures/mcq-items";

export class MemoryMcqRepository implements McqRepository {
  readonly items = new Map<string, QuestionItemVersion>(); readonly sessions = new Map<string, McqSession>(); readonly scores = new Map<string, McqScore>();
  constructor(items: readonly QuestionItemVersion[] = [syntheticMcqItem("item-1"), syntheticMcqItem("item-2")]) { for (const item of items) this.items.set(`${item.itemId}:${item.version}`, item); }
  async listQuestionVersions(blueprintVersionId: string) { return [...this.items.values()].filter((item) => item.mappings.some((m) => m.blueprintVersionId === blueprintVersionId)); }
  async findQuestionVersion(itemId: string, version: number) { return this.items.get(`${itemId}:${version}`) ?? null; }
  async createSession(session: McqSession) { this.sessions.set(session.sessionId, session); }
  async findSession(sessionId: string) { return this.sessions.get(sessionId) ?? null; }
  async saveAnswer(sessionId: string, answer: SessionAnswer) { const session = this.sessions.get(sessionId)!; const updated = recordSessionAnswer(session, answer); this.sessions.set(sessionId, updated); return updated; }
  async completeSession(session: McqSession, score: McqScore) { this.sessions.set(session.sessionId, session); this.scores.set(session.sessionId, score); }
  async findScore(sessionId: string) { return this.scores.get(sessionId) ?? null; }
}
export function harness() { const repository = new MemoryMcqRepository(); const events: McqEvent[] = []; return { repository, events, ids: { next: () => "session-1" }, clock: { now: () => "2026-01-01T00:00:00.000Z" }, logger: { event: (event: McqEvent) => events.push(event) } }; }
