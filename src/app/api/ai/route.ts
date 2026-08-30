import { NextResponse } from "next/server";
import { z } from "zod";
import {
  type AskAiTeacherInput,
  type AskAiTeacherOutput,
} from "@/application/ai/ask-ai-teacher";
import type { UseCase } from "@/application/contracts";
import { askAiTeacher } from "@/infrastructure/rag/server-rag";
import { mapErrorToHttp } from "@/presentation/api/http-error-mapper";
import { AppError } from "@/shared/errors/app-error";
import { resolveTraceId } from "@/shared/observability/trace-id";
import type { PilotIdentity } from "@/application/pilot/pilot-core";

const schema = z.object({ question: z.string().trim().min(3).max(2_000), mode: z.string().max(80).default("Explication") });

function validationFailure(traceId: string) {
  return mapErrorToHttp(
    new AppError({
      code: "VALIDATION_ERROR",
      userMessage: "La question doit être précisée.",
    }), traceId,
  );
}

export function createAiPost(
  useCase: UseCase<AskAiTeacherInput, AskAiTeacherOutput>,
  identity: () => Promise<PilotIdentity> = async () => ({ accountId: "test", learnerId: "test" }),
  meter: <T>(identity: PilotIdentity, traceId: string, operation: () => Promise<T>) => Promise<T> = async (_identity, _traceId, operation) => operation(),
) {
  return async function POST(request: Request) {
    const traceId = resolveTraceId(request.headers.get("x-trace-id"));
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      const response = validationFailure(traceId);
      return NextResponse.json(response.body, { status: response.status, headers: { "x-trace-id": traceId, "cache-control": "no-store" } });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const response = validationFailure(traceId);
      return NextResponse.json(response.body, { status: response.status, headers: { "x-trace-id": traceId, "cache-control": "no-store" } });
    }

    try {
      const caller = await identity();
      return NextResponse.json(await meter(caller, traceId, () => useCase.execute({ ...parsed.data, traceId, learnerId: caller.learnerId })), { headers: { "x-trace-id": traceId } });
    } catch (error) {
      const response = mapErrorToHttp(error, traceId);
      return NextResponse.json(response.body, { status: response.status, headers: { "x-trace-id": traceId, "cache-control": "no-store" } });
    }
  };
}

export const POST = createAiPost(askAiTeacher, async () => (await import("@/infrastructure/pilot/server-pilot")).requirePilotIdentity(), async (identity, traceId, operation) => (await import("@/infrastructure/pilot/server-pilot")).meterAiRequest(identity, traceId, operation));
