import { NextResponse } from "next/server";
import type { PilotIdentity } from "@/application/pilot/pilot-core";
import type { CourseTraining } from "@/application/mcq/course-training";
import { courseCommandSchema } from "@/application/mcq/course-training-contract";
import { apiErrorResponse, apiValidationError } from "@/infrastructure/observability/api-boundary";
import { resolveTraceId } from "@/shared/observability/trace-id";

type Context = { params: Promise<{ documentId: string }> };
export function courseHandlers(identity: () => Promise<PilotIdentity>, load: () => Promise<CourseTraining>, meter: <T>(identity: PilotIdentity, traceId: string, operation: () => Promise<T>) => Promise<T>) {
  const handle = (write: boolean) => async (request: Request, context: Context) => {
    const traceId = resolveTraceId(request.headers.get("x-trace-id"));
    const boundary = { traceId, module: "course-training", operation: write ? "review" : "read" };
    try {
      const caller = await identity();
      const id = Number((await context.params).documentId);
      if (!Number.isSafeInteger(id) || id < 1) return apiValidationError("Cours invalide.", boundary);
      if (write && request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: { message: "Accès refusé." } }, { status: 403 });
      const command = write ? courseCommandSchema.safeParse(await request.json().catch(() => null)) : null;
      if (command && !command.success) return apiValidationError("Action de revue invalide.", boundary);
      const service = await load();
      // Resolve ownership before any metering/generation write.
      const state = service.read(id, caller.learnerId);
      const result = command?.success ? command.data.action === "generate"
        ? await service.execute(id, caller.learnerId, command.data, operation => meter(caller, traceId, operation))
        : await service.execute(id, caller.learnerId, command.data) : state;
      return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
    } catch (error) { return apiErrorResponse(error, boundary); }
  };
  return { GET: handle(false), POST: handle(true) };
}
const handlers = courseHandlers(async () => (await import("@/infrastructure/pilot/server-pilot")).requirePilotIdentity(), async () => (await import("@/infrastructure/mcq/server-course-training")).courseTraining, async (identity, traceId, operation) => (await import("@/infrastructure/pilot/server-pilot")).meterAiRequest(identity, traceId, operation));
export const GET = handlers.GET;
export const POST = handlers.POST;
