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
      const caller = await identity(); const parsed = schema.safeParse(await request.json());
      if (!parsed.success) return apiValidationError("Saisissez au moins deux caractères.", { traceId, module: "search", operation: "search.query" });
      const term = `%${parsed.data.query}%`; const subject = parsed.data.subject;
      const rows = subject && subject !== "Toutes" ? query("SELECT d.id,d.name,d.subject,d.content,d.status FROM documents d JOIN learner_document_ownership o ON o.document_id=d.id WHERE o.learner_id=? AND d.archived=0 AND d.subject=? AND (d.name LIKE ? OR d.content LIKE ?) LIMIT 30", caller.learnerId, subject, term, term) : query("SELECT d.id,d.name,d.subject,d.content,d.status FROM documents d JOIN learner_document_ownership o ON o.document_id=d.id WHERE o.learner_id=? AND d.archived=0 AND (d.name LIKE ? OR d.content LIKE ?) LIMIT 30", caller.learnerId, term, term);
      return NextResponse.json({ results: rows }, { headers: { "x-trace-id": traceId, "cache-control": "no-store" } });
    } catch (error) { return apiErrorResponse(error, { traceId, module: "search", operation: "search.query" }); }
  };
}
export const POST = createSearchPost(async () => (await import("@/infrastructure/pilot/server-pilot")).requirePilotIdentity());
