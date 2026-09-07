import type { McqScore } from "@/domain/mcq/scoring";
import { McqError } from "@/domain/mcq/mcq-errors";
import { mockExamDeadline, mockExamRemainingSeconds, isMockExamExpired } from "@/domain/mcq/mock-exam-policy";
import type { McqClock, McqRepository } from "./mcq-ports";
import type { CompleteMcqSession } from "./complete-mcq-session";

export type PlayableMcqSession = Readonly<{
  sessionId: string;
  mode: "STUDY" | "QUIZ";
  sessionKind: "STANDARD" | "MOCK_EXAM" | null;
  status: "IN_PROGRESS" | "COMPLETED";
  blueprintVersionId: string;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  deadlineAt: string | null;
  remainingSeconds: number | null;
  serverNow: string;
  items: readonly Readonly<{
    itemId: string;
    itemVersion: number;
    position: number;
    stem: string;
    choices: readonly Readonly<{ id: string; text: string }>[];
    difficulty: "FOUNDATION" | "INTERMEDIATE" | "ADVANCED";
    answer: null | Readonly<{ choiceId: string; correct?: boolean; correctChoiceId?: string; explanation?: string }>;
  }>[];
  score: McqScore | null;
}>;

export class GetPlayableMcqSession {
  constructor(private readonly repository: McqRepository, private readonly clock: McqClock = { now: () => new Date().toISOString() }, private readonly complete?: CompleteMcqSession) {}
  async execute(sessionId: string): Promise<PlayableMcqSession> {
    let session = await this.repository.findSession(sessionId);
    if (!session) throw new McqError("MCQ_SESSION_NOT_FOUND", "Session MCQ introuvable.", "MCQ session does not exist.");
    let serverNow = this.clock.now();
    if (session.status === "IN_PROGRESS" && isMockExamExpired(session, serverNow)) {
      if (!this.complete) throw new McqError("MCQ_SESSION_EXPIRED", "Le temps de l’examen est écoulé.", "Expired Mock Exam requires server completion.");
      session = (await this.complete.execute({ sessionId, traceId: `expiration:${sessionId}`, reason: "EXPIRATION" })).session;
      serverNow = this.clock.now();
    }
    const hideMockExamCorrection = session.sessionKind === "MOCK_EXAM" && session.status === "IN_PROGRESS";
    const items = await Promise.all(session.items.map(async snapshot => {
      const item = await this.repository.findQuestionVersion(snapshot.itemId, snapshot.itemVersion);
      if (!item) throw new McqError("MCQ_ITEM_VERSION_MISSING", "Version de question introuvable.", "Snapshot item version is missing.");
      const submitted = session.answers.find(answer => answer.itemId === snapshot.itemId && answer.itemVersion === snapshot.itemVersion);
      return {
        ...snapshot,
        stem: item.stem,
        choices: item.choices,
        difficulty: item.difficulty,
        answer: submitted ? hideMockExamCorrection ? { choiceId: submitted.choiceId } : { choiceId: submitted.choiceId, correct: submitted.correct, correctChoiceId: item.correctChoiceId, explanation: item.explanation } : null,
      };
    }));
    return { sessionId: session.sessionId, mode: session.mode, sessionKind: session.sessionKind, status: session.status, blueprintVersionId: session.blueprintVersionId, startedAt: session.startedAt, completedAt: session.completedAt, durationSeconds: session.durationSeconds, deadlineAt: mockExamDeadline(session), remainingSeconds: session.status === "IN_PROGRESS" ? mockExamRemainingSeconds(session, serverNow) : 0, serverNow, items, score: hideMockExamCorrection ? null : await this.repository.findScore(sessionId) };
  }
}
