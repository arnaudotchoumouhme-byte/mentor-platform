import { NextResponse } from "next/server";
import type { ReadCatalog } from "@/application/mle/catalog-use-cases";

import { mapErrorToHttp } from "@/presentation/api/http-error-mapper";
import { resolveTraceId } from "@/shared/observability/trace-id";



export function createCatalogGet(enabled: () => boolean, authorize: () => Promise<void>, load: () => Promise<Pick<ReadCatalog, "execute">>) {
  return async (request: Request) => {
    const traceId = resolveTraceId(request.headers.get("x-trace-id"));
    const headers = { "cache-control": "no-store", "x-trace-id": traceId };
    if (!enabled()) return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Ressource indisponible." } }, { status: 404, headers });
    try {
      await authorize();
      const catalog = (await load()).execute();
      return NextResponse.json({ success: true, data: catalog }, { headers });
    } catch (error) {
      const mapped = mapErrorToHttp(error, traceId);
      return NextResponse.json(mapped.body, { status: mapped.status, headers });
    }
  };
}
