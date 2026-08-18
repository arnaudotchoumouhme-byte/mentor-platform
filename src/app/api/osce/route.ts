import { NextResponse } from "next/server";
import { z } from "zod";
import type { PilotIdentity } from "@/application/pilot/pilot-core";
import type { OsceApi } from "@/infrastructure/osce/server-osce";
import { apiErrorResponse, apiValidationError } from "@/infrastructure/observability/api-boundary";
import { apiSuccess } from "@/shared/api/contracts";
import { resolveTraceId } from "@/shared/observability/trace-id";

export const runtime = "nodejs"; export const dynamic = "force-dynamic";
const uuid = z.string().uuid();
const body = z.discriminatedUnion("action", [z.object({ action: z.literal("start"), learnerId: uuid, stationVersionId: uuid }).strict(), z.object({ action: z.literal("interact"), sessionId: uuid, callerLearnerId: uuid, roleId: uuid, text: z.string().trim().min(1).max(4000), disclosureId: uuid.nullish() }).strict(), z.object({ action: z.literal("reveal"), sessionId: uuid, callerLearnerId: uuid, disclosureId: uuid }).strict(), z.object({ action: z.literal("complete"), sessionId: uuid, callerLearnerId: uuid }).strict()]);
const invalid = (traceId: string) => apiValidationError("Requête OSCE invalide.", { traceId, module: "osce", operation: "osce.request" });
const respond = async (traceId: string, operation: () => Promise<unknown>, status = 200) => { try { return NextResponse.json(apiSuccess(await operation()), { status, headers: { "x-trace-id": traceId, "cache-control": "no-store" } }); } catch (error) { return apiErrorResponse(error, { traceId, module: "osce", operation: "osce.request" }); } };
const testIdentity = async (): Promise<PilotIdentity> => ({ accountId: "test", learnerId: "10000000-0000-4000-8000-000000000009" });
type Meter = <T>(identity: PilotIdentity, traceId: string, operation: () => Promise<T>) => Promise<T>;
const direct: Meter = async (_identity, _traceId, operation) => operation();

export function createOsceHandlers(load: () => Promise<OsceApi>, identity: () => Promise<PilotIdentity> = testIdentity, meter: Meter = direct) {
  return {
    GET: async (request: Request) => { const traceId = resolveTraceId(request.headers.get("x-trace-id")); const url = new URL(request.url); const id = uuid.safeParse(url.searchParams.get("id")); if (!id.success) return invalid(traceId); const view = url.searchParams.get("view") ?? "state"; return respond(traceId, async () => { const api = await load(); const caller = await identity(); if (view === "station") return api.getStation(id.data); if (view === "replay") return api.replay(id.data, caller.learnerId); return api.state(id.data, caller.learnerId); }); },
    POST: async (request: Request) => { const traceId = resolveTraceId(request.headers.get("x-trace-id")); let raw: unknown; try { raw = await request.json(); } catch { return invalid(traceId); } const parsed = body.safeParse(raw); if (!parsed.success) return invalid(traceId); return respond(traceId, async () => { const api = await load(); const caller = await identity(); const input = parsed.data; if (input.action === "start") return meter(caller, traceId, () => api.start({ ...input, learnerId: caller.learnerId, traceId })); if (input.action === "interact") return api.interact({ ...input, callerLearnerId: caller.learnerId, traceId }); if (input.action === "reveal") return api.reveal({ ...input, callerLearnerId: caller.learnerId, traceId }); return api.complete({ ...input, callerLearnerId: caller.learnerId, traceId }); }, 201); },
  };
}
const handlers = createOsceHandlers(async () => (await import("@/infrastructure/osce/server-osce")).osceApi, async () => (await import("@/infrastructure/pilot/server-pilot")).requirePilotIdentity(), async (identity, traceId, operation) => (await import("@/infrastructure/pilot/server-pilot")).meterOsceSession(identity, traceId, operation)); export const GET = handlers.GET; export const POST = handlers.POST;
