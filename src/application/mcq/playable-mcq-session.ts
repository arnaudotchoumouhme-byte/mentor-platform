import type { McqScore } from "@/domain/mcq/scoring";
import { McqError } from "@/domain/mcq/mcq-errors";
import type { McqRepository } from "./mcq-ports";

export type PlayableMcqSession = Readonly<{
  sessionId: string;
  mode: "STUDY" | "QUIZ";
  status: "IN_PROGRESS" | "COMPLETED";
  blueprintVersionId: string;
  startedAt: string;
  completedAt: string | null;
  items: readonly Readonly<{
    itemId: string;
    itemVersion: number;
    position: number;
    stem: string;
    choices: readonly Readonly<{ id: string; text: string }>[];
    difficulty: "FOUNDATION" | "INTERMEDIATE" | "ADVANCED";
    answer: null | Readonly<{ choiceId: string; correct: boolean; correctChoiceId: string; explanation: string }>;
  }>[];
  score: McqScore | null;
}>;

export class GetPlayableMcqSession {
  constructor(private readonly repository: McqRepository) {}
  async execute(sessionId: string): Promise<PlayableMcqSession> {
    const session = await this.repository.findSession(sessionId);
    if (!session) throw new McqError("MCQ_SESSION_NOT_FOUND", "Session MCQ introuvable.", "MCQ session does not exist.");
    const items = await Promise.all(session.items.map(async snapshot => {
      const item = await this.repository.findQuestionVersion(snapshot.itemId, snapshot.itemVersion);
      if (!item) throw new McqError("MCQ_ITEM_VERSION_MISSING", "Version de question introuvable.", "Snapshot item version is missing.");
      const submitted = session.answers.find(answer => answer.itemId === snapshot.itemId && answer.itemVersion === snapshot.itemVersion);
      return {
        ...snapshot,
        stem: item.stem,
        choices: item.choices,
        difficulty: item.difficulty,
        answer: submitted ? { choiceId: submitted.choiceId, correct: submitted.correct, correctChoiceId: item.correctChoiceId, explanation: item.explanation } : null,
      };
    }));
    return { sessionId: session.sessionId, mode: session.mode, status: session.status, blueprintVersionId: session.blueprintVersionId, startedAt: session.startedAt, completedAt: session.completedAt, items, score: await this.repository.findScore(sessionId) };
  }
}
