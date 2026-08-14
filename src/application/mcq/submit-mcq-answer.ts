import type { UseCase } from "@/application/contracts";
import { McqError } from "@/domain/mcq/mcq-errors";
import { recordSessionAnswer, type McqSession } from "@/domain/mcq/mcq-session";
import { isCorrectAnswer } from "@/domain/mcq/question-item";
import type { McqClock, McqLoggerPort, McqRepository } from "./mcq-ports";

export type SubmitMcqAnswerInput = Readonly<{ sessionId: string; itemId: string; itemVersion: number; choiceId: string; durationMs?: number | null; traceId: string }>;
export class SubmitMcqAnswer implements UseCase<SubmitMcqAnswerInput, McqSession> {
  constructor(private readonly repository: McqRepository, private readonly clock: McqClock, private readonly logger: McqLoggerPort) {}
  async execute(input: SubmitMcqAnswerInput): Promise<McqSession> {
    try {
      const session = await this.repository.findSession(input.sessionId);
      if (!session) throw new McqError("MCQ_SESSION_NOT_FOUND", "Session MCQ introuvable.", "MCQ session does not exist.", { sessionId: input.sessionId });
      const item = await this.repository.findQuestionVersion(input.itemId, input.itemVersion);
      if (!item) throw new McqError("MCQ_ITEM_VERSION_MISSING", "Version de question introuvable.", "MCQ item version does not exist.", { itemId: input.itemId, itemVersion: input.itemVersion });
      const correct = isCorrectAnswer(item, input.choiceId);
      const answer = { itemId: input.itemId, itemVersion: input.itemVersion, choiceId: input.choiceId, correct, durationMs: input.durationMs ?? null, errorClassification: correct ? null : "UNCLASSIFIED", answeredAt: this.clock.now() } as const;
      recordSessionAnswer(session, answer);
      const updated = await this.repository.saveAnswer(input.sessionId, answer);
      this.logger.event({ name: "mcq.answer.submitted", traceId: input.traceId, sessionId: input.sessionId, status: "success", context: { itemId: input.itemId, itemVersion: input.itemVersion, durationMs: answer.durationMs } });
      this.logger.event({ name: "mcq.answer.corrected", traceId: input.traceId, sessionId: input.sessionId, status: correct ? "success" : "degraded", context: { itemId: input.itemId, itemVersion: input.itemVersion, correct, errorClassification: answer.errorClassification } });
      return updated;
    } catch (cause) { this.logger.event({ name: "mcq.answer.failed", traceId: input.traceId, sessionId: input.sessionId, status: "failure", context: { itemId: input.itemId, itemVersion: input.itemVersion } }); throw cause; }
  }
}
