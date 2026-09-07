import { McqError } from "./mcq-errors";

export type McqSessionStatus = "IN_PROGRESS" | "COMPLETED";
export type McqSessionMode = "STUDY" | "QUIZ";
export type McqSessionKind = "STANDARD" | "MOCK_EXAM";
export type SessionItem = Readonly<{ itemId: string; itemVersion: number; position: number }>;
export type SessionAnswer = Readonly<{ itemId: string; itemVersion: number; choiceId: string; correct: boolean; durationMs: number | null; errorClassification: string | null; answeredAt: string }>;
export type McqSession = Readonly<{ sessionId: string; mode: McqSessionMode; status: McqSessionStatus; sessionKind: McqSessionKind | null; durationSeconds: number | null; blueprintVersionId: string; seed: string; items: readonly SessionItem[]; answers: readonly SessionAnswer[]; startedAt: string; completedAt: string | null }>;

type NewMcqSession = Omit<McqSession, "status" | "answers" | "completedAt" | "sessionKind" | "durationSeconds"> & Readonly<{ sessionKind?: McqSessionKind | null; durationSeconds?: number | null }>;

export function createSession(input: NewMcqSession): McqSession {
  if (!input.sessionId || !input.blueprintVersionId || input.items.length === 0 || input.items.some((item, index) => item.position !== index)) throw new McqError("MCQ_ANSWER_INVALID", "Session MCQ invalide.", "Session identity, blueprint and ordered items are required.");
  const sessionKind = input.sessionKind ?? null;
  const durationSeconds = input.durationSeconds ?? null;
  if (durationSeconds !== null && (!Number.isInteger(durationSeconds) || durationSeconds <= 0)) throw new McqError("MCQ_ANSWER_INVALID", "Durée de session invalide.", "Session duration must be a positive integer.");
  if (sessionKind === "MOCK_EXAM" && durationSeconds === null) throw new McqError("MCQ_ANSWER_INVALID", "Durée d’examen invalide.", "Mock Exam sessions require a duration.");
  if (sessionKind === "STANDARD" && durationSeconds !== null) throw new McqError("MCQ_ANSWER_INVALID", "Durée de session invalide.", "Standard sessions cannot carry a Mock Exam duration.");
  return Object.freeze({ ...input, sessionKind, durationSeconds, items: Object.freeze(input.items.map((item) => Object.freeze(item))), status: "IN_PROGRESS", answers: Object.freeze([]), completedAt: null });
}

export function recordSessionAnswer(session: McqSession, answer: SessionAnswer): McqSession {
  if (session.status === "COMPLETED") throw new McqError("MCQ_SESSION_ALREADY_COMPLETED", "Cette session est déjà terminée.", "Cannot answer a completed session.");
  if (!session.items.some(({ itemId, itemVersion }) => itemId === answer.itemId && itemVersion === answer.itemVersion)) throw new McqError("MCQ_ITEM_NOT_IN_SESSION", "Cette question n’appartient pas à la session.", "Answer item is outside the session.");
  if (session.answers.some(({ itemId }) => itemId === answer.itemId)) throw new McqError("MCQ_ANSWER_DUPLICATE", "Cette question a déjà reçu une réponse.", "Duplicate answers are forbidden.");
  return Object.freeze({ ...session, answers: Object.freeze([...session.answers, Object.freeze(answer)]) });
}

export function completeSession(session: McqSession, completedAt: string): McqSession {
  if (session.status === "COMPLETED") throw new McqError("MCQ_SESSION_ALREADY_COMPLETED", "Cette session est déjà terminée.", "Session completion is not repeatable.");
  return Object.freeze({ ...session, status: "COMPLETED", completedAt });
}
