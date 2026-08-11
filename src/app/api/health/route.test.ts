import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns only non-sensitive readiness metadata", async () => {
    const response = GET(new Request("http://localhost/api/health", { headers: { "x-trace-id": "test_trace_12345" } }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("x-trace-id")).toBe("test_trace_12345");
    expect(body).toEqual(expect.objectContaining({ status: "ok", traceId: "test_trace_12345" }));
    expect(JSON.stringify(body)).not.toMatch(/apiKey|secret|password|dataDirectory/i);
  });
});
