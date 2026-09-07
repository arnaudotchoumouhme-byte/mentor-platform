import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/shared/errors/app-error";
import { createSessionGet } from "./[sessionId]/route";
import { createAnswerPost } from "./[sessionId]/answers/route";
import { createCompletePost } from "./[sessionId]/complete/route";
import { createSessionsPost } from "./route";

const sessionId = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ sessionId }) };
const identity = async () => ({ accountId: "account", learnerId: "learner" });
const authorize = vi.fn(async () => {});

describe("MCQ route contracts", () => {
  it("accepts a client UUID for reconciliation and binds identity atomically", async () => {
    const execute = vi.fn(async input => input);
    const request = new Request("http://local", { method: "POST", body: JSON.stringify({ sessionId, mode: "STUDY", count: 1, seed: "seed", blueprintVersionId: "bp" }) });
    expect((await createSessionsPost(async () => ({ execute }), identity)(request)).status).toBe(201);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ sessionId, learnerId: "learner" }));
  });

  it("authorizes read, answer and completion before execution", async () => {
    const execute = vi.fn(async input => input);
    const load = async () => ({ execute });
    expect((await createSessionGet(load, identity, authorize)(new Request("http://local"), context)).status).toBe(200);
    expect((await createAnswerPost(load, identity, authorize)(new Request("http://local", { method: "POST", body: JSON.stringify({ itemId: "item-1", itemVersion: 1, choiceId: "a" }) }), context)).status).toBe(200);
    expect((await createCompletePost(load, identity, authorize)(new Request("http://local", { method: "POST" }), context)).status).toBe(200);
    expect(authorize).toHaveBeenCalledWith(sessionId, "learner");
  });

  it("fails closed for cross-learner read, answer and completion", async () => {
    const execute = vi.fn();
    const load = async () => ({ execute });
    const denied = vi.fn(async () => { throw new AppError({ code: "PILOT_ACCESS_DENIED", userMessage: "Accès refusé.", category: "security" }); });
    expect((await createSessionGet(load, identity, denied)(new Request("http://local"), context)).status).toBe(403);
    expect((await createAnswerPost(load, identity, denied)(new Request("http://local", { method: "POST", body: JSON.stringify({ itemId: "item-1", itemVersion: 1, choiceId: "a" }) }), context)).status).toBe(403);
    expect((await createCompletePost(load, identity, denied)(new Request("http://local", { method: "POST" }), context)).status).toBe(403);
    expect(execute).not.toHaveBeenCalled();
  });
});
