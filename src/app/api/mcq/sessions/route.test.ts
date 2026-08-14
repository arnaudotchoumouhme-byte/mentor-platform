import { describe, expect, it, vi } from "vitest";
import { createSessionsPost } from "./route";

describe("POST /api/mcq/sessions", () => {
  it("validates input and propagates traceId", async () => { const execute = vi.fn(async (input) => ({ sessionId: "created", input })); const post = createSessionsPost(async () => ({ execute })); const response = await post(new Request("http://local/api/mcq/sessions", { method: "POST", headers: { "content-type": "application/json", "x-trace-id": "trace_12345678" }, body: JSON.stringify({ mode: "QUIZ", count: 2, seed: "seed", blueprintVersionId: "bp-v1" }) })); expect(response.status).toBe(201); expect(response.headers.get("x-trace-id")).toBe("trace_12345678"); expect(execute).toHaveBeenCalledWith(expect.objectContaining({ traceId: "trace_12345678", count: 2 })); });
  it("rejects malformed input before loading infrastructure", async () => { const load = vi.fn(); const response = await createSessionsPost(load)(new Request("http://local/api/mcq/sessions", { method: "POST", body: "{}" })); expect(response.status).toBe(400); expect(load).not.toHaveBeenCalled(); });
});
