import { McqError } from "@/domain/mcq/mcq-errors";
import type { McqRepository } from "./mcq-ports";
import { GetPlayableMcqSession } from "./playable-mcq-session";

/** Historical reads never complete an expired session or calculate a score. */
export class GetCompletedMcqSession {
  constructor(private readonly repository: McqRepository) {}

  async execute(sessionId: string) {
    const session = await this.repository.findSession(sessionId);
    if (!session) throw new McqError("MCQ_SESSION_NOT_FOUND", "Session introuvable.", "Historical session not found.");
    if (session.status !== "COMPLETED") throw new McqError("MCQ_SESSION_INCOMPLETE", "Cette session n’est pas terminée. Reprenez-la depuis les QCM.", "Historical read requires a completed session.");
    const historical = await new GetPlayableMcqSession(this.repository).execute(sessionId);
    const items = await Promise.all(historical.items.map(async item => {
      // Unanswered questions still have a correction, without fabricating an answer.
      const version = item.answer ? null : await this.repository.findQuestionVersion(item.itemId, item.itemVersion);
      return { ...item, unansweredCorrection: version ? { choiceId: "", correctChoiceId: version.correctChoiceId, explanation: version.explanation, provenance: version.provenance } : null };
    }));
    return { ...historical, items };
  }
}

export type CompletedMcqSession = Awaited<ReturnType<GetCompletedMcqSession["execute"]>>;
