import { NextResponse } from "next/server";
import { z } from "zod";
import type { UseCase } from "@/application/contracts";
import type { CreateMcqSessionInput } from "@/application/mcq/create-mcq-session";
import { mapErrorToHttp } from "@/presentation/api/http-error-mapper";
import { resolveTraceId } from "@/shared/observability/trace-id";

const constraint = z.object({ dimension: z.enum(["domain", "competency", "topic", "objective"]), id: z.string().trim().min(1).max(200), minimum: z.number().int().min(0).max(500) });
const schema = z.object({ mode: z.enum(["STUDY", "QUIZ"]), count: z.number().int().min(1).max(500), seed: z.string().trim().min(1).max(200), blueprintVersionId: z.string().trim().min(1).max(200), difficulties: z.array(z.enum(["FOUNDATION", "INTERMEDIATE", "ADVANCED"])).max(3).optional(), constraints: z.array(constraint).max(100).optional() });
export function createSessionsPost(load: () => Promise<UseCase<CreateMcqSessionInput, unknown>>) { return async (request: Request) => { const traceId = resolveTraceId(request.headers.get("x-trace-id")); let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Requête MCQ invalide." } }, { status: 400, headers: { "x-trace-id": traceId } }); } const parsed = schema.safeParse(body); if (!parsed.success) return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Requête MCQ invalide." } }, { status: 400, headers: { "x-trace-id": traceId } }); try { const useCase = await load(); return NextResponse.json(await useCase.execute({ ...parsed.data, traceId }), { status: 201, headers: { "x-trace-id": traceId } }); } catch (error) { const response = mapErrorToHttp(error); return NextResponse.json(response.body, { status: response.status, headers: { "x-trace-id": traceId } }); } }; }
export const POST = createSessionsPost(async () => (await import("@/infrastructure/mcq/server-mcq")).mcqServices.create);
