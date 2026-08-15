import { describe, expect, it, vi } from "vitest";
import type { FoundationApi } from "@/infrastructure/foundation/server-foundation";
import { AppError } from "@/shared/errors/app-error";
import { createFoundationHandlers } from "./route";

const ids = {
  curriculum: "10000000-0000-4000-8000-000000000001",
  learner: "20000000-0000-4000-8000-000000000001",
  block: "30000000-0000-4000-8000-000000000001",
  unit: "40000000-0000-4000-8000-000000000001",
  objective: "50000000-0000-4000-8000-000000000001",
  diagnostic: "60000000-0000-4000-8000-000000000001",
  progress: "70000000-0000-4000-8000-000000000001",
  observation: "80000000-0000-4000-8000-000000000001",
};

const fakeApi = () => {
  const execute = () => vi.fn(async (input?: unknown) => input ?? { ok: true });
  return {
    curriculum: { execute: execute() }, diagnostic: { execute: execute() }, mastery: { execute: execute() }, recommendations: { execute: execute() }, progress: { execute: execute() }, exitAssessment: { execute: execute() },
    startDiagnostic: { execute: execute() }, recordObservation: { execute: execute() }, completeDiagnostic: { execute: execute() }, estimateMastery: { execute: execute() }, recommend: { execute: execute() }, startProgress: { execute: execute() }, resumeProgress: { execute: execute() }, advanceProgress: { execute: execute() }, completeExitAssessment: { execute: execute() }, recordRetest: { execute: execute() }, resolveCriticalError: { execute: execute() },
  };
};

const request = (body: unknown) => new Request("http://local/api/foundation", { method: "POST", headers: { "content-type": "application/json", "x-trace-id": "trace_foundation_123" }, body: JSON.stringify(body) });

describe("/api/foundation", () => {
  it("reads the draft curriculum with a stable response and trace ID", async () => {
    const api = fakeApi();
    api.curriculum.execute.mockResolvedValue({ version: { status: "DRAFT" }, blocks: ["BIO", "PHA", "CALC", "THER", "CAN", "COMM"] });
    const response = await createFoundationHandlers(async () => api as unknown as FoundationApi).GET(new Request(`http://local/api/foundation?resource=curriculum&id=${ids.curriculum}`, { headers: { "x-trace-id": "trace_foundation_123" } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-trace-id")).toBe("trace_foundation_123");
    expect(await response.json()).toEqual({ success: true, data: { version: { status: "DRAFT" }, blocks: ["BIO", "PHA", "CALC", "THER", "CAN", "COMM"] } });
  });

  it("handles missing resources without exposing internal details", async () => {
    const api = fakeApi();
    api.diagnostic.execute.mockRejectedValue(new AppError({ code: "NOT_FOUND", userMessage: "Ressource Foundation introuvable.", internalMessage: "secret internal diagnostic detail" }));
    const response = await createFoundationHandlers(async () => api as unknown as FoundationApi).GET(new Request(`http://local/api/foundation?resource=diagnostic&id=${ids.diagnostic}`));
    expect(response.status).toBe(404);
    expect(JSON.stringify(await response.json())).not.toContain("secret internal");
  });

  it("validates input before loading infrastructure", async () => {
    const load = vi.fn();
    const response = await createFoundationHandlers(load).POST(request({ action: "startDiagnostic" }));
    expect(response.status).toBe(400);
    expect(load).not.toHaveBeenCalled();
  });

  it("dispatches diagnostic, mastery and traceable recommendation actions", async () => {
    const api = fakeApi(); const handlers = createFoundationHandlers(async () => api as unknown as FoundationApi);
    expect((await handlers.POST(request({ action: "startDiagnostic", learnerId: ids.learner, curriculumVersionId: ids.curriculum, targetBlockIds: [ids.block], expectedCount: null }))).status).toBe(201);
    expect((await handlers.POST(request({ action: "recordObservation", diagnosticId: ids.diagnostic, blockId: ids.block, unitId: ids.unit, objectiveId: ids.objective, activityType: "SYNTHETIC", outcome: { correct: true }, confidence: 0.8, durationMs: 100, criticalErrorCategory: null, evidenceType: "FOUNDATION", evidenceRefId: null, evidenceRefVersion: null }))).status).toBe(200);
    expect((await handlers.POST(request({ action: "completeDiagnostic", diagnosticId: ids.diagnostic }))).status).toBe(200);
    expect((await handlers.POST(request({ action: "estimateMastery", diagnosticId: ids.diagnostic, blockId: ids.block, unitId: ids.unit, objectiveId: ids.objective }))).status).toBe(200);
    const mastery = { id: ids.observation, learnerId: ids.learner, curriculumVersionId: ids.curriculum, blockId: ids.block, unitId: ids.unit, objectiveId: ids.objective, level: "N1", confidence: 0.5, calculatedAt: "2026-08-14T00:00:00.000Z", evidenceObservationIds: [ids.observation], ruleVersion: "internal-v1" };
    api.recommend.execute.mockResolvedValue({ decision: "REQUIRED", justification: "Recommandation pédagogique interne; non officielle PEBC." });
    const recommendation = await handlers.POST(request({ action: "recommend", diagnosticId: ids.diagnostic, mastery, supersedesId: null }));
    expect(JSON.stringify(await recommendation.json())).toContain("non officielle PEBC");
    expect(api.startDiagnostic.execute.mock.calls[0]![0]).not.toHaveProperty("action");
    expect(api.recordObservation.execute.mock.calls[0]![0]).not.toHaveProperty("action");
  });

  it("dispatches progression, exit assessment, re-test and resolution actions", async () => {
    const api = fakeApi(); const post = createFoundationHandlers(async () => api as unknown as FoundationApi).POST;
    const inputs = [
      { action: "startProgress", learnerId: ids.learner, curriculumVersionId: ids.curriculum, unitId: ids.unit },
      { action: "resumeProgress", learnerId: ids.learner, curriculumVersionId: ids.curriculum, unitId: ids.unit },
      { action: "advanceProgress", progressId: ids.progress, targetStage: "MICRO_LESSON" },
      { action: "completeExitAssessment", progressId: ids.progress, diagnosticId: ids.diagnostic, result: { satisfactory: true } },
      { action: "recordRetest", progressId: ids.progress, diagnosticId: ids.diagnostic, criticalObservationId: ids.observation, satisfactory: true, confidence: 0.9, durationMs: 200 },
      { action: "resolveCriticalError", diagnosticId: ids.diagnostic, criticalObservationId: ids.observation },
    ];
    for (const input of inputs) expect((await post(request(input))).status).toBe(input.action === "startProgress" ? 201 : 200);
    expect(api.recordRetest.execute).toHaveBeenCalledOnce();
    expect(api.resolveCriticalError.execute).toHaveBeenCalledOnce();
  });

  it("maps unknown failures to a generic 500 response", async () => {
    const api = fakeApi(); api.curriculum.execute.mockRejectedValue(new Error("database password leaked"));
    const response = await createFoundationHandlers(async () => api as unknown as FoundationApi).GET(new Request("http://local/api/foundation?resource=curriculum"));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("database password");
  });
});
