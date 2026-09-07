import type { McqSession } from "./mcq-session";

export const DEFAULT_MOCK_EXAM_DURATION_SECONDS = 45 * 60;
export const DEFAULT_MOCK_EXAM_QUESTION_COUNT = 50;

export function mockExamDeadline(session: McqSession): string | null {
  if (session.sessionKind !== "MOCK_EXAM" || session.durationSeconds === null) return null;
  return new Date(Date.parse(session.startedAt) + session.durationSeconds * 1_000).toISOString();
}

export function isMockExamExpired(session: McqSession, now: string): boolean {
  const deadline = mockExamDeadline(session);
  return deadline !== null && Date.parse(now) >= Date.parse(deadline);
}

export function mockExamRemainingSeconds(session: McqSession, now: string): number | null {
  const deadline = mockExamDeadline(session);
  return deadline === null ? null : Math.max(0, Math.ceil((Date.parse(deadline) - Date.parse(now)) / 1_000));
}
