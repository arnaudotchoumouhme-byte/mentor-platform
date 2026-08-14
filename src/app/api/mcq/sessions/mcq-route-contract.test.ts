import { describe, expect, it, vi } from "vitest";
import { createSessionGet } from "./[sessionId]/route";
import { createAnswerPost } from "./[sessionId]/answers/route";
import { createCompletePost } from "./[sessionId]/complete/route";
const sessionId = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ sessionId }) };

describe("MCQ route contracts", () => {
  it("reads a validated session", async () => { const execute = vi.fn(async () => ({ session: { sessionId } })); const response = await createSessionGet(async () => ({ execute }))(new Request(`http://local/api/mcq/sessions/${sessionId}`), context); expect(response.status).toBe(200); expect(execute).toHaveBeenCalledWith(sessionId); });
  it("submits a validated answer without scoring in the route", async () => { const execute = vi.fn(async (input) => input); const response = await createAnswerPost(async () => ({ execute }))(new Request("http://local", { method: "POST", headers: { "content-type": "application/json", "x-trace-id": "trace_12345678" }, body: JSON.stringify({ itemId: "item-1", itemVersion: 1, choiceId: "a", durationMs: 12 }) }), context); expect(response.status).toBe(200); expect(execute).toHaveBeenCalledWith({ sessionId, itemId: "item-1", itemVersion: 1, choiceId: "a", durationMs: 12, traceId: "trace_12345678" }); });
  it("completes a validated session", async () => { const execute = vi.fn(async () => ({ status: "COMPLETED" })); const response = await createCompletePost(async () => ({ execute }))(new Request("http://local", { method: "POST" }), context); expect(response.status).toBe(200); expect(execute).toHaveBeenCalledWith(expect.objectContaining({ sessionId })); });
  it("rejects invalid IDs and bodies", async () => { const load = vi.fn(); const invalid = { params: Promise.resolve({ sessionId: "invalid" }) }; expect((await createSessionGet(load)(new Request("http://local"), invalid)).status).toBe(400); expect((await createAnswerPost(load)(new Request("http://local", { method: "POST", body: "{}" }), invalid)).status).toBe(400); expect((await createCompletePost(load)(new Request("http://local", { method: "POST" }), invalid)).status).toBe(400); expect(load).not.toHaveBeenCalled(); });
});
