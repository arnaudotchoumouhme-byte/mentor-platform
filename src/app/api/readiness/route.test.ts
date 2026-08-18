import { describe, expect, it, vi } from "vitest";
import { createReadinessGet } from "./route";

const checks = { persistentStorage: "ready", database: "ready", schema: { status: "ready", currentVersion: 13, targetVersion: 13 }, migrations: { status: "ready", pending: 0 }, auth0: "ready", foundation: "ready", mcq: "ready", osce: "ready", calculations: "ready", imports: "ready", ai: "disabled" } as const;
describe("GET /api/readiness", () => {
  it("returns non-sensitive readiness with a correlated trace", async () => { vi.spyOn(console, "info").mockImplementation(() => undefined); const response = createReadinessGet(() => ({ status: "ready", checks }))(new Request("http://localhost/api/readiness", { headers: { "x-trace-id": "trace_test_12345" } })); const body = await response.json(); expect(response.status).toBe(200); expect(response.headers.get("x-trace-id")).toBe("trace_test_12345"); expect(body.traceId).toBe("trace_test_12345"); expect(JSON.stringify(body)).not.toMatch(/secret|token|cookie|dataDirectory/i); });
  it("returns 503 when an indispensable check fails", async () => { vi.spyOn(console, "error").mockImplementation(() => undefined); const response = createReadinessGet(() => ({ status: "not-ready", checks: { ...checks, database: "not-ready" } }))(new Request("http://localhost/api/readiness")); expect(response.status).toBe(503); });
});
