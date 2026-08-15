import { NextResponse } from "next/server";
import { z } from "zod";
import type { FoundationApi } from "@/infrastructure/foundation/server-foundation";
import { mapErrorToHttp } from "@/presentation/api/http-error-mapper";
import { apiSuccess } from "@/shared/api/contracts";
import { resolveTraceId } from "@/shared/observability/trace-id";

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

export function createFoundationHandlers(load: () => Promise<FoundationApi>) {
  return {
    GET: async (request: Request) => {
      const traceId = resolveTraceId(request.headers.get("x-trace-id"));
      const url = new URL(request.url);
      const parsed = readQuery.safeParse(Object.fromEntries(url.searchParams));
      if (!parsed.success) return invalid(traceId);
      return respond(traceId, async () => {
        const query = parsed.data;
        if (query.resource === "curriculum") return (await load()).curriculum.execute(query.id);
        if (query.resource === "diagnostic") return (await load()).diagnostic.execute(query.id);
        if (query.resource === "mastery") return (await load()).mastery.execute(query.learnerId);
        if (query.resource === "recommendations") return (await load()).recommendations.execute(query.learnerId);
        if (query.resource === "progress") return (await load()).progress.execute(query.id);
        return (await load()).exitAssessment.execute(query.id);
      });
    },
    POST: async (request: Request) => {
      const traceId = resolveTraceId(request.headers.get("x-trace-id"));
      let body: unknown;
      try { body = await request.json(); } catch { return invalid(traceId); }
      const parsed = mutation.safeParse(body);
      if (!parsed.success) return invalid(traceId);
      return respond(traceId, async () => {
        const api = await load(); const input = parsed.data;
        switch (input.action) {
          case "startDiagnostic": return api.startDiagnostic.execute(payload(input));
          case "recordObservation": return api.recordObservation.execute(payload(input));
          case "completeDiagnostic": return api.completeDiagnostic.execute(input.diagnosticId);
          case "estimateMastery": return api.estimateMastery.execute(payload(input));
          case "recommend": return api.recommend.execute(payload(input));
          case "startProgress": return api.startProgress.execute(payload(input));
          case "resumeProgress": return api.resumeProgress.execute(payload(input));
          case "advanceProgress": return api.advanceProgress.execute(payload(input));
          case "completeExitAssessment": return api.completeExitAssessment.execute(payload(input));
          case "recordRetest": return api.recordRetest.execute(payload(input));
          case "resolveCriticalError": return api.resolveCriticalError.execute(payload(input));
        }
      }, parsed.data.action.startsWith("start") ? 201 : 200);
    },
  };
}

const handlers = createFoundationHandlers(async () => (await import("@/infrastructure/foundation/server-foundation")).foundationApi);
export const GET = handlers.GET;
export const POST = handlers.POST;
