import { expect, it, vi } from "vitest";
import { MemoryMcqRepository } from "./mcq-use-case-test-harness";
import { GetCompletedMcqSession } from "./get-completed-mcq-session";
import { completeSession, createSession } from "@/domain/mcq/mcq-session";

it("never expires or writes an unfinished Mock Exam during a history read", async () => {
  const repository = new MemoryMcqRepository();
  await repository.createSession(createSession({ sessionId: "s", sessionKind: "MOCK_EXAM", durationSeconds: 60, mode: "QUIZ", blueprintVersionId: "bp-v1", seed: "s", startedAt: "2020-01-01T00:00:00Z", items: [{ itemId: "item-1", itemVersion: 1, position: 0 }] }));
  const write = vi.spyOn(repository, "completeSession");
  await expect(new GetCompletedMcqSession(repository).execute("s")).rejects.toMatchObject({ code: "MCQ_SESSION_INCOMPLETE" });
  expect(write).not.toHaveBeenCalled();
  expect((await repository.findSession("s"))?.status).toBe("IN_PROGRESS");
});

it("shows the immutable correction for an unanswered item without manufacturing an answer or score", async () => {
  const repository = new MemoryMcqRepository();
  const session = createSession({ sessionId: "s", mode: "STUDY", blueprintVersionId: "bp-v1", seed: "s", startedAt: "2020-01-01T00:00:00Z", items: [{ itemId: "item-1", itemVersion: 1, position: 0 }] });
  repository.sessions.set("s", completeSession(session, "2020-01-01T00:01:00Z"));
  const result = await new GetCompletedMcqSession(repository).execute("s");
  expect(result.items[0]?.answer).toBeNull();
  expect(result.items[0]?.unansweredCorrection).toMatchObject({ correctChoiceId: "a", explanation: "Explication synthétique." });
  expect(result.score).toBeNull();
});
