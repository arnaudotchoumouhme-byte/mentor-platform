import { NextResponse } from "next/server";
import { z } from "zod";
import type { PilotIdentity } from "@/application/pilot/pilot-core";
import type { CalculationsApi } from "@/infrastructure/calculations/server-calculations";
import { apiErrorResponse, apiValidationError } from "@/infrastructure/observability/api-boundary";
import { apiSuccess } from "@/shared/api/contracts";
import { resolveTraceId } from "@/shared/observability/trace-id";

export const runtime = "nodejs"; export const dynamic = "force-dynamic";
const uuid = z.string().uuid();
const quantity = z.object({ value: z.number().finite(), unit: z.enum(["mg", "g", "mL", "L"]) }).strict();
const mutation = z.discriminatedUnion("action", [z.object({ action: z.literal("submit"), learnerId: uuid, exerciseVersionId: uuid, steps: z.array(quantity).min(1), result: quantity }).strict(), z.object({ action: z.literal("prepareRetest"), sourceAttemptId: uuid, exerciseVersionId: uuid }).strict()]);
const invalid = (traceId: string) => apiValidationError("Requête Calculations Lab invalide.", { traceId, module: "calculations", operation: "calculations.request" });
const respond = async (traceId: string, operation: () => Promise<unknown>, status = 200) => { try { return NextResponse.json(apiSuccess(await operation()), { status, headers: { "x-trace-id": traceId, "cache-control": "no-store" } }); } catch (error) { return apiErrorResponse(error, { traceId, module: "calculations", operation: "calculations.request" }); } };
const testIdentity = async (): Promise<PilotIdentity> => ({ accountId: "test", learnerId: "10000000-0000-4000-8000-000000000002" });

export function createCalculationsHandlers(load: () => Promise<CalculationsApi>, identity: () => Promise<PilotIdentity> = testIdentity) {
  return {
    GET: async (request: Request) => { const traceId = resolveTraceId(request.headers.get("x-trace-id")); const parsed = uuid.safeParse(new URL(request.url).searchParams.get("exerciseVersionId")); if (!parsed.success) return invalid(traceId); return respond(traceId, async () => { await identity(); return (await load()).exercise.execute(parsed.data, traceId); }); },
    POST: async (request: Request) => { const traceId = resolveTraceId(request.headers.get("x-trace-id")); let body: unknown; try { body = await request.json(); } catch { return invalid(traceId); } const parsed = mutation.safeParse(body); if (!parsed.success) return invalid(traceId); return respond(traceId, async () => { const caller = await identity(); const api = await load(); const input = parsed.data; if (input.action === "submit") return api.submit.execute({ learnerId: caller.learnerId, exerciseVersionId: input.exerciseVersionId, submission: { steps: input.steps, result: input.result }, traceId }); return api.retest.execute({ sourceAttemptId: input.sourceAttemptId, exerciseVersionId: input.exerciseVersionId, learnerId: caller.learnerId, traceId }); }, 201); },
  };
}
const handlers = createCalculationsHandlers(async () => (await import("@/infrastructure/calculations/server-calculations")).calculationsApi, async () => (await import("@/infrastructure/pilot/server-pilot")).requirePilotIdentity()); export const GET = handlers.GET; export const POST = handlers.POST;
