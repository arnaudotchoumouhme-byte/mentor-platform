import { NextResponse } from "next/server";
import { z } from "zod";
import type { PilotIdentity } from "@/application/pilot/pilot-core";
import { apiErrorResponse, apiValidationError } from "@/infrastructure/observability/api-boundary";
import { all } from "@/lib/db";
import { resolveTraceId } from "@/shared/observability/trace-id";

const schema = z.object({ query: z.string().trim().min(2).max(200), subject: z.string().trim().max(120).optional() }).strict();
export function createSearchPost(identity: () => Promise<PilotIdentity>, query: typeof all = all) {
  return async (request: Request) => {
    const traceId = resolveTraceId(request.headers.get("x-trace-id"));
    try {
      await identity(); const parsed = schema.safeParse(await request.json());
      if (!parsed.success) return apiValidationError("Saisissez au moins deux caractères.", { traceId, module: "search", operation: "search.query" });
      const term = `%${parsed.data.query}%`; const subject = parsed.data.subject;
      const rows = subject && subject !== "Toutes" ? query("SELECT id,name,subject,content,status FROM documents WHERE archived=0 AND subject=? AND (name LIKE ? OR content LIKE ?) LIMIT 30", subject, term, term) : query("SELECT id,name,subject,content,status FROM documents WHERE archived=0 AND (name LIKE ? OR content LIKE ?) LIMIT 30", term, term);
      return NextResponse.json({ results: rows }, { headers: { "x-trace-id": traceId, "cache-control": "no-store" } });
    } catch (error) { return apiErrorResponse(error, { traceId, module: "search", operation: "search.query" }); }
  };
}
export const POST = createSearchPost(async () => (await import("@/infrastructure/pilot/server-pilot")).requirePilotIdentity());
