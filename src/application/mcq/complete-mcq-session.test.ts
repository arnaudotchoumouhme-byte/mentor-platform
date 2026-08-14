import { describe, expect, it } from "vitest";
import { CompleteMcqSession } from "./complete-mcq-session";
import { CreateMcqSession } from "./create-mcq-session";
import { GetMcqSession } from "./get-mcq-session";
import { SubmitMcqAnswer } from "./submit-mcq-answer";
import { harness } from "./mcq-use-case-test-harness";

describe("CompleteMcqSession", () => {
  it("atomically stores final state and structured score", async () => { const h = harness(); const session = await new CreateMcqSession(h.repository, h.ids, h.clock, h.logger).execute({ mode: "QUIZ", count: 2, seed: "seed", blueprintVersionId: "bp-v1", traceId: "trace_12345678" }); const first = session.items[0]!; await new SubmitMcqAnswer(h.repository, h.clock, h.logger).execute({ sessionId: session.sessionId, itemId: first.itemId, itemVersion: first.itemVersion, choiceId: "a", traceId: "trace_12345678" }); const result = await new CompleteMcqSession(h.repository, h.clock, h.logger).execute({ sessionId: session.sessionId, traceId: "trace_12345678" }); expect(result.session.status).toBe("COMPLETED"); expect(result.score).toMatchObject({ total: 2, answered: 1, correct: 1, unanswered: 1, percentage: 50 }); expect(await new GetMcqSession(h.repository).execute(session.sessionId)).toEqual(result); });
  it("rejects missing and already completed sessions", async () => { const h = harness(); const useCase = new CompleteMcqSession(h.repository, h.clock, h.logger); await expect(useCase.execute({ sessionId: "missing", traceId: "trace_12345678" })).rejects.toMatchObject({ code: "MCQ_SESSION_NOT_FOUND" }); });
});
