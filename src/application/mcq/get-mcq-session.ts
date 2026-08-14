import type { UseCase } from "@/application/contracts";
import { McqError } from "@/domain/mcq/mcq-errors";
import type { McqScore } from "@/domain/mcq/scoring";
import type { McqSession } from "@/domain/mcq/mcq-session";
import type { McqRepository } from "./mcq-ports";

export class GetMcqSession implements UseCase<string, Readonly<{ session: McqSession; score: McqScore | null }>> {
  constructor(private readonly repository: McqRepository) {}
  async execute(sessionId: string) { const session = await this.repository.findSession(sessionId); if (!session) throw new McqError("MCQ_SESSION_NOT_FOUND", "Session MCQ introuvable.", "MCQ session does not exist."); return { session, score: await this.repository.findScore(sessionId) }; }
}
