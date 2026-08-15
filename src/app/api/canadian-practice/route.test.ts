import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/shared/errors/app-error";
import type { CanadianPracticeQueries } from "@/application/canadian-practice/canadian-practice-queries";
import { createCanadianPracticeGet } from "./route";

const ruleId = "10000000-0000-4000-8000-000000000001";
const view = { id: "20000000-0000-4000-8000-000000000001", practiceRuleId: ruleId, ruleVersion: 1, jurisdiction: "PROVINCIAL", province: "ON", sourceVersionId: "30000000-0000-4000-8000-000000000001", verifiedAt: "2026-08-14T00:00:00.000Z", effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveTo: null, status: "ACTIVE", pedagogicalSummary: "TEST_FIXTURE", independenceDisclaimer: "TEST_FIXTURE not official guidance.", createdAt: "2026-08-14T00:00:00.000Z", source: { sourceId: "40000000-0000-4000-8000-000000000001", sourceVersionId: "30000000-0000-4000-8000-000000000001", sourceVersion: 1, displayName: "TEST_FIXTURE source", provenanceType: "TEST_FIXTURE" } };
const service = () => ({ readRule: vi.fn(async () => ({ practiceRuleId: ruleId })), readVersion: vi.fn(async () => view), readHistory: vi.fn(async () => [view]), resolveActive: vi.fn(async () => view) });
const request = (params: string, trace = "trace_canadian_123") => new Request(`http://local/api/canadian-practice?${params}`, { headers: { "x-trace-id": trace } });

describe("GET /api/canadian-practice", () => {
  it("returns Ontario provenance, version, verification and trace ID", async () => {
    const response = await createCanadianPracticeGet(async () => service() as unknown as CanadianPracticeQueries)(request(`resource=active&practiceRuleId=${ruleId}&jurisdiction=PROVINCIAL&province=ON&at=2026-08-14T00%3A00%3A00.000Z`));
    expect(response.status).toBe(200); expect(response.headers.get("x-trace-id")).toBe("trace_canadian_123"); const body = await response.json(); expect(body.data).toMatchObject({ province: "ON", ruleVersion: 1, verifiedAt: view.verifiedAt, source: { sourceVersion: 1 } }); expect(body.data.independenceDisclaimer).toContain("not official");
  });
  it("supports federal, precise-version and history reads", async () => {
    const api = service(); const get = createCanadianPracticeGet(async () => api as unknown as CanadianPracticeQueries);
    expect((await get(request(`resource=active&practiceRuleId=${ruleId}&jurisdiction=FEDERAL&at=2026-08-14T00%3A00%3A00.000Z`))).status).toBe(200);
    expect((await get(request(`resource=version&practiceRuleId=${ruleId}&ruleVersion=1`))).status).toBe(200);
    expect((await get(request(`resource=history&practiceRuleId=${ruleId}`))).status).toBe(200);
  });
  it("accepts Quebec while preserving provenance and jurisdiction metadata", async () => {
    const api = service(); api.resolveActive.mockResolvedValue({ ...view, province: "QC" });
    const response = await createCanadianPracticeGet(async () => api as unknown as CanadianPracticeQueries)(request(`resource=active&practiceRuleId=${ruleId}&jurisdiction=PROVINCIAL&province=QC&at=2026-08-14T00%3A00%3A00.000Z`));
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ data: { jurisdiction: "PROVINCIAL", province: "QC", ruleVersion: 1, verifiedAt: view.verifiedAt, effectiveFrom: view.effectiveFrom, source: { sourceVersion: 1 }, independenceDisclaimer: view.independenceDisclaimer } });
  });
  it("fails closed for invalid and unsupported provinces before loading infrastructure", async () => {
    const load = vi.fn(); const get = createCanadianPracticeGet(load);
    expect((await get(request(`resource=active&practiceRuleId=${ruleId}&jurisdiction=PROVINCIAL&province=BC&at=2026-08-14T00%3A00%3A00.000Z`))).status).toBe(400); expect(load).not.toHaveBeenCalled();
  });
  it("maps not-effective and missing-version errors without exposing internals", async () => {
    const api = service(); api.resolveActive.mockRejectedValue(new AppError({ code: "CANADIAN_PRACTICE_RULE_NOT_EFFECTIVE", userMessage: "Règle non effective.", internalMessage: "secret database detail" }));
    const response = await createCanadianPracticeGet(async () => api as unknown as CanadianPracticeQueries)(request(`resource=active&practiceRuleId=${ruleId}&jurisdiction=PROVINCIAL&province=ON&at=2026-08-14T00%3A00%3A00.000Z`));
    expect(response.status).toBe(422); expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});
