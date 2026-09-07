import type { UseCase } from "@/application/contracts";
import { McqError } from "@/domain/mcq/mcq-errors";
import { completeSession, type McqSession } from "@/domain/mcq/mcq-session";
import { calculateScore, type McqScore } from "@/domain/mcq/scoring";
import { isMockExamExpired } from "@/domain/mcq/mock-exam-policy";
import type { McqClock, McqLoggerPort, McqRepository } from "./mcq-ports";

export type CompleteMcqSessionInput = Readonly<{ sessionId: string; traceId: string; reason?: "MANUAL" | "EXPIRATION" }>;
export type CompletedMcqSession = Readonly<{ session: McqSession; score: McqScore }>;
export class CompleteMcqSession implements UseCase<CompleteMcqSessionInput, CompletedMcqSession> {
  constructor(private readonly repository: McqRepository, private readonly clock: McqClock, private readonly logger: McqLoggerPort) {}
  async execute(input: CompleteMcqSessionInput): Promise<CompletedMcqSession> {
    try {
      let completedAt: string | null = null;
      while (true) {
        const session = await this.repository.findSession(input.sessionId);
        if (!session) throw new McqError("MCQ_SESSION_NOT_FOUND", "Session MCQ introuvable.", "MCQ session does not exist.");
        if (session.status === "COMPLETED" && session.sessionKind === "MOCK_EXAM") {
          const score = await this.repository.findScore(input.sessionId);
          if (!score) throw new McqError("MCQ_SESSION_ALREADY_COMPLETED", "Cette session est déjà terminée.", "Completed Mock Exam has no stored score.");
          return { session, score };
        }
        completedAt ??= this.clock.now();
        if (session.sessionKind === "MOCK_EXAM") {
          const expired = isMockExamExpired(session, completedAt);
          if (input.reason === "EXPIRATION" && !expired) throw new McqError("MCQ_ANSWER_INVALID", "L’examen est encore actif.", "Premature expiration completion was rejected.");
          if (!expired && session.answers.length !== session.items.length) throw new McqError("MCQ_SESSION_INCOMPLETE", "Répondez à toutes les questions avant de terminer.", "Active Mock Exam completion requires every answer.");
        }
        const scored = await Promise.all(session.answers.map(async (answer) => { const item = await this.repository.findQuestionVersion(answer.itemId, answer.itemVersion); if (!item) throw new McqError("MCQ_ITEM_VERSION_MISSING", "Version de question introuvable.", "Snapshot item version is missing."); return { correct: answer.correct, mappings: item.mappings }; }));
        const score = calculateScore(session.items.length, scored);
        const completed = completeSession(session, completedAt);
        if (!await this.repository.completeSession(completed, score)) continue;
        this.logger.event({ name: "mcq.session.completed", traceId: input.traceId, sessionId: input.sessionId, status: "success", context: { total: score.total, answered: score.answered, correct: score.correct, percentage: score.percentage } });
        return { session: completed, score };
      }
    } catch (cause) { this.logger.event({ name: "mcq.session.completion_failed", traceId: input.traceId, sessionId: input.sessionId, status: "failure" }); throw cause; }
  }
}
