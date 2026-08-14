import { NextResponse } from "next/server";
import { z } from "zod";
import type { UseCase } from "@/application/contracts";
import { mapErrorToHttp } from "@/presentation/api/http-error-mapper";
import { resolveTraceId } from "@/shared/observability/trace-id";
const id = z.string().uuid();
export function createSessionGet(load: () => Promise<UseCase<string, unknown>>) { return async (request: Request, context: { params: Promise<{ sessionId: string }> }) => { const traceId = resolveTraceId(request.headers.get("x-trace-id")); const parsed = id.safeParse((await context.params).sessionId); if (!parsed.success) return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Identifiant de session invalide." } }, { status: 400, headers: { "x-trace-id": traceId } }); try { return NextResponse.json(await (await load()).execute(parsed.data), { headers: { "x-trace-id": traceId } }); } catch (error) { const response = mapErrorToHttp(error); return NextResponse.json(response.body, { status: response.status, headers: { "x-trace-id": traceId } }); } }; }
export const GET = createSessionGet(async () => (await import("@/infrastructure/mcq/server-mcq")).mcqServices.get);
