import { NextResponse } from "next/server";
import { z } from "zod";
import { SYNTHETIC_SAFETY_CASE } from "@/application/coach/synthetic-case-catalog";
import type { PilotIdentity } from "@/application/pilot/pilot-core";
import { apiErrorResponse, apiValidationError } from "@/infrastructure/observability/api-boundary";
import { AppError } from "@/shared/errors/app-error";
import { resolveTraceId } from "@/shared/observability/trace-id";

const schema = z.discriminatedUnion("action", [z.object({ action: z.literal("start"), mode: z.enum(["PROFESSOR", "CLINICAL_PHARMACIST", "SOCRATIC", "TEACH_BACK", "RAPID_REVIEW"]), learningObjective: z.string().trim().min(3).max(300), language: z.enum(["fr", "en"]).default("fr"), learnerLevel: z.enum(["FOUNDATION", "INTERMEDIATE", "ADVANCED"]).default("INTERMEDIATE") }), z.object({ action: z.literal("answer"), sessionId: z.string().uuid(), answer: z.string().trim().min(1).max(4000), confidence: z.number().min(0).max(1).optional(), durationMs: z.number().int().min(0).max(3_600_000) }), z.object({ action: z.literal("resume"), sessionId: z.string().uuid() })]);
type Coach = Readonly<{ start: (input: never) => unknown; answer: (input: never) => unknown; resume: (id: string) => unknown }>;
type CoachOwnership = Readonly<{ bind(sessionId: string, learnerId: string): Promise<void> | void; assert(sessionId: string, learnerId: string): Promise<void> | void }>;

export function createCoachPost(identity: () => Promise<PilotIdentity>, load: () => Promise<Coach>, ownership: CoachOwnership) {
  return async (request: Request) => {
    const traceId = resolveTraceId(request.headers.get("x-trace-id")); let body: unknown;
    try { body = await request.json(); } catch { return apiValidationError("Requête Coach invalide.", { traceId, module: "coach", operation: "coach.request" }); }
    const parsed = schema.safeParse(body); if (!parsed.success) return apiValidationError("Requête Coach invalide.", { traceId, module: "coach", operation: "coach.request" });
    try {
      const caller = await identity();
      if (parsed.data.action !== "start") await ownership.assert(parsed.data.sessionId, caller.learnerId);
      const clinicalCoach = await load();
      const output = parsed.data.action === "start" ? clinicalCoach.start({ mode: parsed.data.mode, objectiveId: "clinical-safety", learningObjective: parsed.data.learningObjective, language: parsed.data.language, learnerLevel: parsed.data.learnerLevel, clinicalCase: { ...SYNTHETIC_SAFETY_CASE, learningObjective: parsed.data.learningObjective }, sourceScope: [], traceId } as never) : parsed.data.action === "answer" ? clinicalCoach.answer({ ...parsed.data, traceId } as never) : clinicalCoach.resume(parsed.data.sessionId);
      if (parsed.data.action === "start") await ownership.bind((output as { session: { sessionId: string } }).session.sessionId, caller.learnerId);
      return NextResponse.json(output, { headers: { "x-trace-id": traceId, "cache-control": "no-store" } });
    } catch (error) {
      if (error instanceof AppError && ["UNAUTHORIZED", "PILOT_ACCESS_DENIED"].includes(error.code)) return apiErrorResponse(error, { traceId, module: "coach", operation: "coach.request" });
      return apiErrorResponse(new AppError({ code: "COACH_SESSION_STATE_INVALID", userMessage: "La session Coach ne peut pas être traitée. Aucune donnée clinique interne n’est exposée.", internalMessage: "Coach operation failed.", cause: error, category: "internal" }), { traceId, module: "coach", operation: "coach.request" });
    }
  };
}
export const POST = createCoachPost(async () => (await import("@/infrastructure/pilot/server-pilot")).requirePilotIdentity(), async () => (await import("@/infrastructure/coach/server-clinical-coach")).clinicalCoach, { bind: async (sessionId, learnerId) => (await import("@/infrastructure/pilot/server-pilot")).pilotOwnership.bindCoachSession(sessionId, learnerId), assert: async (sessionId, learnerId) => (await import("@/infrastructure/pilot/server-pilot")).pilotOwnership.assertCoachSession(sessionId, learnerId) });
