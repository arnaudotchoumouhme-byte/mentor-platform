import { describe, expect, it } from "vitest";
import { CreateMcqSession } from "./create-mcq-session";
import { harness } from "./mcq-use-case-test-harness";

describe("CreateMcqSession", () => {
  it("selects, snapshots, persists and traces a session", async () => { const h = harness(); const result = await new CreateMcqSession(h.repository, h.ids, h.clock, h.logger).execute({ mode: "QUIZ", count: 2, seed: "seed", blueprintVersionId: "bp-v1", traceId: "trace_12345678" }); expect(result.items).toHaveLength(2); expect(await h.repository.findSession(result.sessionId)).toEqual(result); expect(h.events.map(({ name }) => name)).toEqual(["mcq.session.created", "mcq.items.selected"]); });
  it("uses a validated caller-provided session id for safe client reconciliation", async () => { const h = harness(); const sessionId = "11111111-1111-4111-8111-111111111111"; const result = await new CreateMcqSession(h.repository, h.ids, h.clock, h.logger).execute({ sessionId, mode: "QUIZ", count: 1, seed: "seed", blueprintVersionId: "bp-v1", traceId: "trace_12345678" }); expect(result.sessionId).toBe(sessionId); expect(await h.repository.findSession(sessionId)).toEqual(result); });
  it("traces impossible selection without persisting", async () => { const h = harness(); await expect(new CreateMcqSession(h.repository, h.ids, h.clock, h.logger).execute({ mode: "QUIZ", count: 3, seed: "seed", blueprintVersionId: "bp-v1", traceId: "trace_12345678" })).rejects.toMatchObject({ code: "MCQ_SELECTION_IMPOSSIBLE" }); expect(h.events.at(-1)?.name).toBe("mcq.session.creation_failed"); });
});
