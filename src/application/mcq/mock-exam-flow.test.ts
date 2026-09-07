import { describe, expect, it } from "vitest";
import { CompleteMcqSession } from "./complete-mcq-session";
import { CreateMcqSession } from "./create-mcq-session";
import { GetPlayableMcqSession } from "./playable-mcq-session";
import { SubmitMcqAnswer } from "./submit-mcq-answer";
import { harness } from "./mcq-use-case-test-harness";

function mockInput(count = 2) {
  return { learnerId: "learner-a", sessionKind: "MOCK_EXAM" as const, durationSeconds: 60, mode: "QUIZ" as const, count, seed: "stable", blueprintVersionId: "bp-v1", traceId: "trace_12345678" };
}

describe("Mock Exam MCQ convergence", () => {
  it("hides every answer-key field and score until complete, then uses server scoring", async () => {
    const h = harness();
    let now = "2026-01-01T00:00:00.000Z";
    const clock = { now: () => now };
    const create = new CreateMcqSession(h.repository, h.ids, clock, h.logger);
    const submit = new SubmitMcqAnswer(h.repository, clock, h.logger);
    const complete = new CompleteMcqSession(h.repository, clock, h.logger);
    const playable = new GetPlayableMcqSession(h.repository, clock, complete);
    const session = await create.execute(mockInput());

    const first = session.items[0]!;
    await submit.execute({ sessionId: session.sessionId, itemId: first.itemId, itemVersion: first.itemVersion, choiceId: "a", traceId: "trace_12345678" });
    const active = await playable.execute(session.sessionId);
    expect(active.deadlineAt).toBe("2026-01-01T00:01:00.000Z");
    expect(active.remainingSeconds).toBe(60);
    expect(active.score).toBeNull();
    expect(active.items[0]?.answer).toEqual({ choiceId: "a" });
    expect(JSON.stringify(active)).not.toContain("correctChoiceId");
    expect(JSON.stringify(active)).not.toContain("correct\"");
    expect(JSON.stringify(active)).not.toContain("explanation");

    await expect(complete.execute({ sessionId: session.sessionId, traceId: "trace_12345678" })).rejects.toMatchObject({ code: "MCQ_SESSION_INCOMPLETE" });
    const second = session.items[1]!;
    await submit.execute({ sessionId: session.sessionId, itemId: second.itemId, itemVersion: second.itemVersion, choiceId: "b", traceId: "trace_12345678" });
    now = "2026-01-01T00:00:30.000Z";
    const completed = await complete.execute({ sessionId: session.sessionId, traceId: "trace_12345678" });
    expect(completed.score).toMatchObject({ answered: 2, correct: 1, percentage: 50 });
    const result = await playable.execute(session.sessionId);
    expect(result.items[0]?.answer).toMatchObject({ correct: true, correctChoiceId: "a", explanation: "Explication synthétique." });
    expect(result.score?.percentage).toBe(50);
  });

  it("preserves the deadline, rejects deadline answers, expires safely and reconciles repeated completion", async () => {
    const h = harness();
    let now = "2026-01-01T00:00:00.000Z";
    const clock = { now: () => now };
    const create = new CreateMcqSession(h.repository, h.ids, clock, h.logger);
    const submit = new SubmitMcqAnswer(h.repository, clock, h.logger);
    const complete = new CompleteMcqSession(h.repository, clock, h.logger);
    const playable = new GetPlayableMcqSession(h.repository, clock, complete);
    const session = await create.execute(mockInput(1));
    const initial = await playable.execute(session.sessionId);

    now = "2026-01-01T00:01:00.000Z";
    const item = session.items[0]!;
    await expect(submit.execute({ sessionId: session.sessionId, itemId: item.itemId, itemVersion: item.itemVersion, choiceId: "a", traceId: "trace_12345678" })).rejects.toMatchObject({ code: "MCQ_SESSION_EXPIRED" });
    const expired = await playable.execute(session.sessionId);
    expect(expired.status).toBe("COMPLETED");
    expect(expired.deadlineAt).toBe(initial.deadlineAt);
    expect(expired.score).toMatchObject({ answered: 0, unanswered: 1, percentage: 0 });
    const repeated = await complete.execute({ sessionId: session.sessionId, traceId: "trace_12345678" });
    expect(repeated.score).toEqual(expired.score);
  });
});
