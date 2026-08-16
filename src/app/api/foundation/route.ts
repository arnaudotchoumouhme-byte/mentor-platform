import { NextResponse } from "next/server";
import { z } from "zod";
import type { FoundationApi } from "@/infrastructure/foundation/server-foundation";
import { mapErrorToHttp } from "@/presentation/api/http-error-mapper";
import { apiSuccess } from "@/shared/api/contracts";
import { resolveTraceId } from "@/shared/observability/trace-id";
import type { PilotIdentity } from "@/application/pilot/pilot-core";
import { AppError } from "@/shared/errors/app-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = z.string().uuid();
const nullableUuid = uuid.nullable();
const evidence = z.object({ evidenceType: z.enum(["FOUNDATION", "MCQ", "COACH", "SOURCE_VERSION", "EXTERNAL"]), evidenceRefId: z.string().trim().min(1).nullable(), evidenceRefVersion: z.string().trim().min(1).nullable() });
const mastery = z.object({ id: uuid, learnerId: uuid, curriculumVersionId: uuid, blockId: uuid, unitId: nullableUuid, objectiveId: nullableUuid, level: z.enum(["N0", "N1", "N2", "N3", "N4"]), confidence: z.number().min(0).max(1), calculatedAt: z.string().datetime(), evidenceObservationIds: z.array(uuid), ruleVersion: z.string().trim().min(1) });
const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("startDiagnostic"), learnerId: uuid, curriculumVersionId: uuid, targetBlockIds: z.array(uuid).min(1), expectedCount: z.number().int().positive().nullable() }),
  z.object({ action: z.literal("recordObservation"), diagnosticId: uuid, blockId: uuid, unitId: nullableUuid, objectiveId: nullableUuid, activityType: z.string().trim().min(1), outcome: z.record(z.string(), z.unknown()), confidence: z.number().min(0).max(1).nullable(), durationMs: z.number().int().nonnegative().nullable(), criticalErrorCategory: z.enum(["SAFETY", "CALCULATION", "PHARMACOTHERAPY", "CANADIAN_PRACTICE"]).nullable(), ...evidence.shape }),
  z.object({ action: z.literal("completeDiagnostic"), diagnosticId: uuid }),
  z.object({ action: z.literal("estimateMastery"), diagnosticId: uuid, blockId: uuid, unitId: nullableUuid, objectiveId: nullableUuid }),
  z.object({ action: z.literal("recommend"), diagnosticId: uuid, mastery, supersedesId: nullableUuid }),
  z.object({ action: z.literal("startProgress"), learnerId: uuid, curriculumVersionId: uuid, unitId: uuid }),
  z.object({ action: z.literal("resumeProgress"), learnerId: uuid, curriculumVersionId: uuid, unitId: uuid }),
  z.object({ action: z.literal("advanceProgress"), progressId: uuid, targetStage: z.enum(["PRE_TEST", "MICRO_LESSON", "GUIDED_PRACTICE", "APPLICATION", "TEACH_BACK", "EXIT_ASSESSMENT", "CONSOLIDATION", "RETEST"]) }),
  z.object({ action: z.literal("completeExitAssessment"), progressId: uuid, diagnosticId: uuid, result: z.record(z.string(), z.unknown()) }),
  z.object({ action: z.literal("recordRetest"), progressId: uuid, diagnosticId: uuid, criticalObservationId: uuid, satisfactory: z.boolean(), confidence: z.number().min(0).max(1).nullable(), durationMs: z.number().int().nonnegative().nullable() }),
  z.object({ action: z.literal("resolveCriticalError"), diagnosticId: uuid, criticalObservationId: uuid }),
]);
const readQuery = z.discriminatedUnion("resource", [
  z.object({ resource: z.literal("curriculum"), id: uuid.optional() }),
  z.object({ resource: z.literal("diagnostic"), id: uuid }),
  z.object({ resource: z.literal("mastery"), learnerId: uuid }),
  z.object({ resource: z.literal("recommendations"), learnerId: uuid }),
  z.object({ resource: z.literal("progress"), id: uuid }),
  z.object({ resource: z.literal("exitAssessment"), id: uuid }),
]);

const invalid = (traceId: string) => NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Requête Foundation invalide." } }, { status: 400, headers: { "x-trace-id": traceId } });
const payload = <T extends { action: string }>(input: T): Omit<T, "action"> => {
  const copy: Partial<T> = { ...input };
  delete copy.action;
  return copy as Omit<T, "action">;
};
const respond = async (traceId: string, operation: () => Promise<unknown>, status = 200) => {
  try { return NextResponse.json(apiSuccess(await operation()), { status, headers: { "x-trace-id": traceId, "cache-control": "no-store" } }); }
  catch (error) { const mapped = mapErrorToHttp(error); return NextResponse.json(mapped.body, { status: mapped.status, headers: { "x-trace-id": traceId, "cache-control": "no-store" } }); }
};

const assertOwner = (actual: string, expected: string) => { if (actual !== expected) throw new AppError({ code: "PILOT_ACCESS_DENIED", userMessage: "Accès au pilote refusé.", category: "security" }); };

export function createFoundationHandlers(load: () => Promise<FoundationApi>, identity: () => Promise<PilotIdentity> = async () => ({ accountId: "test", learnerId: "20000000-0000-4000-8000-000000000001" })) {
  return {
    GET: async (request: Request) => {
      const traceId = resolveTraceId(request.headers.get("x-trace-id"));
      const url = new URL(request.url);
      const parsed = readQuery.safeParse(Object.fromEntries(url.searchParams));
      if (!parsed.success) return invalid(traceId);
      return respond(traceId, async () => {
        const query = parsed.data;
        const caller = await identity(); const api = await load();
        if (query.resource === "curriculum") return api.curriculum.execute(query.id);
        if (query.resource === "diagnostic") { const value = await api.diagnostic.execute(query.id); assertOwner(value.learnerId, caller.learnerId); return value; }
        if (query.resource === "mastery") return api.mastery.execute(caller.learnerId);
        if (query.resource === "recommendations") return api.recommendations.execute(caller.learnerId);
        if (query.resource === "progress") { const value = await api.progress.execute(query.id); assertOwner(value.learnerId, caller.learnerId); return value; }
        const value = await api.exitAssessment.execute(query.id); assertOwner(value.learnerId, caller.learnerId); return value;
      });
    },
    POST: async (request: Request) => {
      const traceId = resolveTraceId(request.headers.get("x-trace-id"));
      let body: unknown;
      try { body = await request.json(); } catch { return invalid(traceId); }
      const parsed = mutation.safeParse(body);
      if (!parsed.success) return invalid(traceId);
      return respond(traceId, async () => {
        const api = await load(); const caller = await identity(); const input = parsed.data;
        const ownDiagnostic = async (id: string) => assertOwner((await api.diagnostic.execute(id)).learnerId, caller.learnerId);
        const ownProgress = async (id: string) => assertOwner((await api.progress.execute(id)).learnerId, caller.learnerId);
        switch (input.action) {
          case "startDiagnostic": return api.startDiagnostic.execute({ ...payload(input), learnerId: caller.learnerId });
          case "recordObservation": await ownDiagnostic(input.diagnosticId); return api.recordObservation.execute(payload(input));
          case "completeDiagnostic": await ownDiagnostic(input.diagnosticId); return api.completeDiagnostic.execute(input.diagnosticId);
          case "estimateMastery": await ownDiagnostic(input.diagnosticId); return api.estimateMastery.execute(payload(input));
          case "recommend": await ownDiagnostic(input.diagnosticId); return api.recommend.execute(payload(input));
          case "startProgress": return api.startProgress.execute({ ...payload(input), learnerId: caller.learnerId });
          case "resumeProgress": return api.resumeProgress.execute({ ...payload(input), learnerId: caller.learnerId });
          case "advanceProgress": await ownProgress(input.progressId); return api.advanceProgress.execute(payload(input));
          case "completeExitAssessment": await ownProgress(input.progressId); await ownDiagnostic(input.diagnosticId); return api.completeExitAssessment.execute(payload(input));
          case "recordRetest": await ownProgress(input.progressId); await ownDiagnostic(input.diagnosticId); return api.recordRetest.execute(payload(input));
          case "resolveCriticalError": await ownDiagnostic(input.diagnosticId); return api.resolveCriticalError.execute(payload(input));
        }
      }, parsed.data.action.startsWith("start") ? 201 : 200);
    },
  };
}

const handlers = createFoundationHandlers(async () => (await import("@/infrastructure/foundation/server-foundation")).foundationApi, async () => (await import("@/infrastructure/pilot/server-pilot")).requirePilotIdentity());
export const GET = handlers.GET;
export const POST = handlers.POST;
