import { describe, expect, it } from "vitest";
import { completeSession, createSession, recordSessionAnswer } from "./mcq-session";

const session = () => createSession({ sessionId: "session-1", mode: "QUIZ", blueprintVersionId: "bp-v1", seed: "seed", items: [{ itemId: "item-1", itemVersion: 2, position: 0 }], startedAt: "2026-01-01T00:00:00.000Z" });
const answer = { itemId: "item-1", itemVersion: 2, choiceId: "a", correct: true, durationMs: 1000, errorClassification: null, answeredAt: "2026-01-01T00:00:01.000Z" } as const;

describe("MCQ session", () => {
  it("moves explicitly from in progress to completed", () => { const answered = recordSessionAnswer(session(), answer); expect(answered.answers).toHaveLength(1); expect(completeSession(answered, "2026-01-01T00:01:00.000Z").status).toBe("COMPLETED"); });
  it("rejects an item outside the immutable snapshot", () => { try { recordSessionAnswer(session(), { ...answer, itemId: "other" }); } catch (error) { expect(error).toMatchObject({ code: "MCQ_ITEM_NOT_IN_SESSION" }); return; } throw new Error("Expected MCQ_ITEM_NOT_IN_SESSION"); });
  it("rejects duplicate answers", () => { const answered = recordSessionAnswer(session(), answer); try { recordSessionAnswer(answered, answer); } catch (error) { expect(error).toMatchObject({ code: "MCQ_ANSWER_DUPLICATE" }); return; } throw new Error("Expected MCQ_ANSWER_DUPLICATE"); });
  it("rejects answers and repeated completion after completion", () => { const completed = completeSession(session(), "2026-01-01T00:01:00.000Z"); for (const operation of [() => recordSessionAnswer(completed, answer), () => completeSession(completed, "later")]) { try { operation(); } catch (error) { expect(error).toMatchObject({ code: "MCQ_SESSION_ALREADY_COMPLETED" }); continue; } throw new Error("Expected MCQ_SESSION_ALREADY_COMPLETED"); } });
});
