import { NextResponse } from "next/server";
import { z } from "zod";
import { MentorActionsService } from "@/application/actions/mentor-actions";
import type { UseCase } from "@/application/contracts";
import { SqliteMentorActions } from "@/infrastructure/database/sqlite/sqlite-mentor-actions";
import { sqliteExecutor } from "@/infrastructure/database/sqlite/server-sqlite-executor";
import { apiErrorResponse, apiValidationError } from "@/infrastructure/observability/api-boundary";
import { resolveTraceId } from "@/shared/observability/trace-id";
import { LocalDocumentStorage } from "@/infrastructure/documents/local-document-storage";
import type { PilotIdentity } from "@/application/pilot/pilot-core";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("archiveDocument"), id: z.number(), archived: z.boolean() }),
  z.object({ action: z.literal("deleteDocument"), id: z.number() }),
  z.object({ action: z.literal("reviewCard"), id: z.number(), rating: z.string(), interval: z.number() }),
  z.object({ action: z.literal("completeTask"), id: z.number(), completed: z.boolean() }),
  z.object({ action: z.literal("resolveWeakness"), id: z.number() }),
  z.object({ action: z.literal("saveAttempt"), module: z.string(), subject: z.string(), score: z.number().min(0).max(100), minutes: z.number().min(0) }),
  z.object({ action: z.literal("addFlashcard"), front: z.string().min(2), back: z.string().min(2), subject: z.string().min(1) }),
  z.object({ action: z.literal("addTask"), title: z.string().min(2), subject: z.string(), date: z.string(), minutes: z.number().min(5).max(480) }),
  z.object({ action: z.literal("saveSettings"), settings: z.record(z.string(), z.string()) }),
]);

const actions = new MentorActionsService(new SqliteMentorActions(sqliteExecutor, new LocalDocumentStorage()));

export function createActionsPost(
  useCase: UseCase<z.infer<typeof actionSchema>, void>,
  identity: () => Promise<PilotIdentity> = async () => ({ accountId: "test", learnerId: "test" }),
) {
  return async function POST(request: Request) {
    const traceId = resolveTraceId(request.headers.get("x-trace-id"));
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiValidationError("Données invalides", { traceId, module: "actions", operation: "action.execute" });
    }

    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return apiValidationError("Données invalides", { traceId, module: "actions", operation: "action.execute" });
    }

    try {
      await identity();
      await useCase.execute(parsed.data);
      return NextResponse.json({ success: true }, { headers: { "x-trace-id": traceId, "cache-control": "no-store" } });
    } catch (error) {
      return apiErrorResponse(error, { traceId, module: "actions", operation: "action.execute" });
    }
  };
}

export const POST = createActionsPost(actions, async () => (await import("@/infrastructure/pilot/server-pilot")).requirePilotIdentity());
