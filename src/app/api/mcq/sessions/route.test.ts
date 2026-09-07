import { describe, expect, it, vi } from "vitest";
import { createSessionsGet, createSessionsPost } from "./route";

const identity = async () => ({ accountId: "account", learnerId: "authoritative-learner" });

describe("POST /api/mcq/sessions", () => {
  it("uses server identity and server Mock Exam policy", async () => {
    const execute = vi.fn(async input => ({ sessionId: "created", input }));
    const post = createSessionsPost(async () => ({ execute }), identity);
    const response = await post(new Request("http://local/api/mcq/sessions", { method: "POST", headers: { "content-type": "application/json", "x-trace-id": "trace_12345678" }, body: JSON.stringify({ learnerId: "browser", sessionKind: "MOCK_EXAM", mode: "STUDY", count: 2, seed: "seed", blueprintVersionId: "bp-v1" }) }));
    expect(response.status).toBe(201);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ traceId: "trace_12345678", learnerId: "authoritative-learner", sessionKind: "MOCK_EXAM", mode: "QUIZ", durationSeconds: 2_700 }));
  });

  it("keeps ordinary sessions standard and untimed", async () => {
    const execute = vi.fn(async input => input);
    await createSessionsPost(async () => ({ execute }), identity)(new Request("http://local", { method: "POST", body: JSON.stringify({ mode: "STUDY", count: 1, seed: "seed", blueprintVersionId: "bp" }) }));
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ sessionKind: "STANDARD", durationSeconds: null, mode: "STUDY" }));
  });

  it("rejects malformed input before loading infrastructure", async () => {
    const load = vi.fn();
    const response = await createSessionsPost(load, identity)(new Request("http://local/api/mcq/sessions", { method: "POST", body: "{}" }));
    expect(response.status).toBe(400);
    expect(load).not.toHaveBeenCalled();
  });
});

describe("GET /api/mcq/sessions", () => {
  it("selects resume candidates by persisted specialization", async () => {
    const execute = vi.fn(async () => [{ blueprintVersionId: "bp-v1", itemCount: 2 }]);
    const findResumable = vi.fn(async () => "11111111-1111-4111-8111-111111111111");
    const response = await createSessionsGet(async () => ({ execute }), identity, findResumable)(new Request("http://local/api/mcq/sessions?kind=MOCK_EXAM"));
    expect(await response.json()).toEqual({ blueprints: [{ blueprintVersionId: "bp-v1", itemCount: 2 }], resumableSession: { sessionId: "11111111-1111-4111-8111-111111111111" } });
    expect(findResumable).toHaveBeenCalledWith("authoritative-learner", "MOCK_EXAM");
  });
});
