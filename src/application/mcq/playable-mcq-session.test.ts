import { describe, expect, it } from "vitest";
import { MemoryMcqRepository } from "./mcq-use-case-test-harness";
import { GetPlayableMcqSession } from "./playable-mcq-session";
import { createSession, recordSessionAnswer } from "@/domain/mcq/mcq-session";

describe("GetPlayableMcqSession", () => {
  it("hides correction before an answer and reveals it afterwards", async () => { const repository = new MemoryMcqRepository(); const base = createSession({ sessionId: "session", mode: "STUDY", blueprintVersionId: "bp-v1", seed: "seed", items: [{ itemId: "item-1", itemVersion: 1, position: 0 }], startedAt: "now" }); await repository.createSession(base); const before = await new GetPlayableMcqSession(repository).execute("session"); expect(before.items[0]).not.toHaveProperty("correctChoiceId"); expect(before.items[0]?.answer).toBeNull(); expect(JSON.stringify(before)).not.toContain("correctChoiceId"); expect(JSON.stringify(before)).not.toContain("Explication synthétique."); const answer = { itemId: "item-1", itemVersion: 1, choiceId: "a", correct: true, durationMs: null, errorClassification: null, answeredAt: "later" } as const; recordSessionAnswer(base, answer); await repository.saveAnswer("session", answer); const after = await new GetPlayableMcqSession(repository).execute("session"); expect(after.items[0]?.answer).toMatchObject({ correct: true, correctChoiceId: "a", explanation: "Explication synthétique." }); });
});
