import { NextResponse } from "next/server";
import { z } from "zod";
import type { CanadianPracticeQueries } from "@/application/canadian-practice/canadian-practice-queries";
import { mapErrorToHttp } from "@/presentation/api/http-error-mapper";
import { apiSuccess } from "@/shared/api/contracts";
import { resolveTraceId } from "@/shared/observability/trace-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = z.string().uuid();
const query = z.discriminatedUnion("resource", [
  z.object({ resource: z.literal("rule"), practiceRuleId: uuid }),
  z.object({ resource: z.literal("version"), practiceRuleId: uuid, ruleVersion: z.coerce.number().int().positive() }),
  z.object({ resource: z.literal("history"), practiceRuleId: uuid }),
  z.object({ resource: z.literal("active"), practiceRuleId: uuid, jurisdiction: z.enum(["FEDERAL", "PROVINCIAL"]), province: z.preprocess((value) => value === undefined || value === "" ? null : value, z.enum(["ON"]).nullable()), at: z.string().datetime() }),
]);
const invalid = (traceId: string) => NextResponse.json({ success: false, error: { code: "CANADIAN_PRACTICE_RULE_INVALID", message: "Requête de pratique canadienne invalide." } }, { status: 400, headers: { "x-trace-id": traceId, "cache-control": "no-store" } });

export function createCanadianPracticeGet(load: () => Promise<CanadianPracticeQueries>) {
  return async (request: Request) => {
    const traceId = resolveTraceId(request.headers.get("x-trace-id"));
    const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success || (parsed.data.resource === "active" && ((parsed.data.jurisdiction === "FEDERAL" && parsed.data.province !== null) || (parsed.data.jurisdiction === "PROVINCIAL" && parsed.data.province !== "ON")))) return invalid(traceId);
    try {
      const service = await load(); const input = parsed.data;
      const data = input.resource === "rule" ? await service.readRule(input.practiceRuleId)
        : input.resource === "version" ? await service.readVersion(input.practiceRuleId, input.ruleVersion, traceId)
        : input.resource === "history" ? await service.readHistory(input.practiceRuleId, traceId)
        : await service.resolveActive({ ...input, traceId });
      return NextResponse.json(apiSuccess(data), { headers: { "x-trace-id": traceId, "cache-control": "no-store" } });
    } catch (error) { const mapped = mapErrorToHttp(error); return NextResponse.json(mapped.body, { status: mapped.status, headers: { "x-trace-id": traceId, "cache-control": "no-store" } }); }
  };
}

export const GET = createCanadianPracticeGet(async () => (await import("@/infrastructure/canadian-practice/server-canadian-practice")).canadianPracticeQueries);
