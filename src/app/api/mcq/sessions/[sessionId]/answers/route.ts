import { NextResponse } from "next/server";
import { z } from "zod";
import type { UseCase } from "@/application/contracts";
import type { SubmitMcqAnswerInput } from "@/application/mcq/submit-mcq-answer";
import { mapErrorToHttp } from "@/presentation/api/http-error-mapper";
import { resolveTraceId } from "@/shared/observability/trace-id";
const paramsSchema = z.string().uuid(); const bodySchema = z.object({ itemId: z.string().trim().min(1).max(200), itemVersion: z.number().int().min(1), choiceId: z.string().trim().min(1).max(200), durationMs: z.number().int().min(0).max(86_400_000).nullable().optional() });
export function createAnswerPost(load: () => Promise<UseCase<SubmitMcqAnswerInput, unknown>>) { return async (request: Request, context: { params: Promise<{ sessionId: string }> }) => { const traceId = resolveTraceId(request.headers.get("x-trace-id")); const sessionId = paramsSchema.safeParse((await context.params).sessionId); let body: unknown; try { body = await request.json(); } catch { body = null; } const parsed = bodySchema.safeParse(body); if (!sessionId.success || !parsed.success) return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Réponse MCQ invalide." } }, { status: 400, headers: { "x-trace-id": traceId } }); try { return NextResponse.json(await (await load()).execute({ sessionId: sessionId.data, ...parsed.data, traceId }), { headers: { "x-trace-id": traceId } }); } catch (error) { const response = mapErrorToHttp(error); return NextResponse.json(response.body, { status: response.status, headers: { "x-trace-id": traceId } }); } }; }
export const POST = createAnswerPost(async () => (await import("@/infrastructure/mcq/server-mcq")).mcqServices.submit);
