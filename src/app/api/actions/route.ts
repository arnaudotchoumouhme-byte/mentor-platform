import { NextResponse } from "next/server";
import { z } from "zod";
import { MentorActionsService } from "@/application/actions/mentor-actions";
import type { UseCase } from "@/application/contracts";
import { SqliteMentorActions } from "@/infrastructure/database/sqlite/sqlite-mentor-actions";
import { sqliteExecutor } from "@/infrastructure/database/sqlite/server-sqlite-executor";
import { mapErrorToHttp } from "@/presentation/api/http-error-mapper";
import { AppError } from "@/shared/errors/app-error";
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

function validationFailure() {
  return mapErrorToHttp(
    new AppError({
      code: "VALIDATION_ERROR",
      userMessage: "Données invalides",
    }),
  );
}

export function createActionsPost(
  useCase: UseCase<z.infer<typeof actionSchema>, void>,
  identity: () => Promise<PilotIdentity> = async () => ({ accountId: "test", learnerId: "test" }),
) {
  return async function POST(request: Request) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      const response = validationFailure();
      return NextResponse.json(response.body, { status: response.status });
    }

    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      const response = validationFailure();
      return NextResponse.json(response.body, { status: response.status });
    }

    try {
      await identity();
      await useCase.execute(parsed.data);
      return NextResponse.json({ success: true });
    } catch (error) {
      const response = mapErrorToHttp(error);
      return NextResponse.json(response.body, { status: response.status });
    }
  };
}

export const POST = createActionsPost(actions, async () => (await import("@/infrastructure/pilot/server-pilot")).requirePilotIdentity());
