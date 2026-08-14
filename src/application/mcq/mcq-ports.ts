import type { McqScore } from "@/domain/mcq/scoring";
import type { McqSession, SessionAnswer } from "@/domain/mcq/mcq-session";
import type { QuestionItemVersion } from "@/domain/mcq/question-item";

export interface McqRepository {
  listQuestionVersions(blueprintVersionId: string): Promise<readonly QuestionItemVersion[]>;
  findQuestionVersion(itemId: string, version: number): Promise<QuestionItemVersion | null>;
  createSession(session: McqSession): Promise<void>;
  findSession(sessionId: string): Promise<McqSession | null>;
  saveAnswer(sessionId: string, answer: SessionAnswer): Promise<McqSession>;
  completeSession(session: McqSession, score: McqScore): Promise<void>;
  findScore(sessionId: string): Promise<McqScore | null>;
}
export interface McqIdGenerator { next(): string; }
export interface McqClock { now(): string; }
export type McqEvent = Readonly<{ name: string; traceId: string; sessionId?: string; status: "success" | "failure" | "degraded"; context?: Readonly<Record<string, unknown>> }>;
export interface McqLoggerPort { event(event: McqEvent): void; }
