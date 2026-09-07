import type { UseCase } from "@/application/contracts";
import { createSession, type McqSession, type McqSessionKind, type McqSessionMode } from "@/domain/mcq/mcq-session";
import { selectQuestions, type CoverageConstraint } from "@/domain/mcq/question-selection";
import type { QuestionDifficulty } from "@/domain/mcq/question-item";
import type { McqClock, McqIdGenerator, McqLoggerPort, McqRepository } from "./mcq-ports";

export type CreateMcqSessionInput = Readonly<{ sessionId?: string; learnerId: string; sessionKind: McqSessionKind; durationSeconds: number | null; mode: McqSessionMode; count: number; seed: string; blueprintVersionId: string; difficulties?: readonly QuestionDifficulty[]; constraints?: readonly CoverageConstraint[]; traceId: string }>;
export class CreateMcqSession implements UseCase<CreateMcqSessionInput, McqSession> {
  constructor(private readonly repository: McqRepository, private readonly ids: McqIdGenerator, private readonly clock: McqClock, private readonly logger: McqLoggerPort) {}
  async execute(input: CreateMcqSessionInput): Promise<McqSession> {
    const sessionId = input.sessionId ?? this.ids.next();
    try {
      const selected = selectQuestions(await this.repository.listQuestionVersions(input.blueprintVersionId), input);
      const session = createSession({ sessionId, mode: input.mode, sessionKind: input.sessionKind, durationSeconds: input.durationSeconds, blueprintVersionId: input.blueprintVersionId, seed: input.seed, items: selected.map(({ itemId, version }, position) => ({ itemId, itemVersion: version, position })), startedAt: this.clock.now() });
      await this.repository.createSession(session, input.learnerId);
      this.logger.event({ name: "mcq.session.created", traceId: input.traceId, sessionId, status: "success", context: { mode: input.mode, sessionKind: input.sessionKind, itemCount: selected.length, blueprintVersionId: input.blueprintVersionId } });
      this.logger.event({ name: "mcq.items.selected", traceId: input.traceId, sessionId, status: "success", context: { itemCount: selected.length, seed: input.seed } });
      return session;
    } catch (cause) { this.logger.event({ name: "mcq.session.creation_failed", traceId: input.traceId, sessionId, status: "failure" }); throw cause; }
  }
}
