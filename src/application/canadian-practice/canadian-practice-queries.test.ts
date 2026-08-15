import { describe, expect, it, vi } from "vitest";
import type { CanadianPracticeRepository } from "./canadian-practice-ports";
import { CanadianPracticeQueries } from "./canadian-practice-queries";

const version = { id: "20000000-0000-4000-8000-000000000001", practiceRuleId: "10000000-0000-4000-8000-000000000001", ruleVersion: 1, jurisdiction: "FEDERAL" as const, province: null, sourceVersionId: "30000000-0000-4000-8000-000000000001", verifiedAt: "2026-08-14T00:00:00.000Z", effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveTo: null, status: "ACTIVE" as const, pedagogicalSummary: "TEST_FIXTURE", independenceDisclaimer: "TEST_FIXTURE not official.", createdAt: "2026-08-14T00:00:00.000Z" };
const source = { sourceId: "40000000-0000-4000-8000-000000000001", sourceVersionId: version.sourceVersionId, sourceVersion: 1, displayName: "TEST_FIXTURE source", provenanceType: "TEST_FIXTURE" };
const repository = (overrides: Partial<CanadianPracticeRepository> = {}) => ({ insertRule: vi.fn(), insertRuleVersion: vi.fn(), findRule: vi.fn(), findVersion: vi.fn(async () => version), listHistory: vi.fn(async () => [version]), resolveActive: vi.fn(async () => version), findSourceDisplay: vi.fn(async () => source), ...overrides } as CanadianPracticeRepository);

describe("CanadianPracticeQueries", () => {
  it("resolves federal and Ontario rules with traceable provenance", async () => {
    const events: unknown[] = []; const service = new CanadianPracticeQueries(repository(), { event: (event) => events.push(event) });
    const federal = await service.resolveActive({ practiceRuleId: version.practiceRuleId, jurisdiction: "FEDERAL", province: null, at: "2026-08-14T00:00:00.000Z", traceId: "trace_fixture_123" });
    expect(federal.source).toEqual(source); expect(federal.verifiedAt).toBe(version.verifiedAt); expect(JSON.stringify(events)).toContain("rule_version_loaded"); expect(JSON.stringify(events)).not.toContain("pedagogicalSummary");
    const provincialRepository = repository({ resolveActive: vi.fn(async () => ({ ...version, jurisdiction: "PROVINCIAL" as const, province: "ON" as const })) });
    expect((await new CanadianPracticeQueries(provincialRepository, { event: vi.fn() }).resolveActive({ practiceRuleId: version.practiceRuleId, jurisdiction: "PROVINCIAL", province: "ON", at: "2026-08-14T00:00:00.000Z", traceId: "trace_fixture_123" })).province).toBe("ON");
    const quebecRepository = repository({ resolveActive: vi.fn(async (input) => input.province === "QC" ? ({ ...version, jurisdiction: "PROVINCIAL" as const, province: "QC" as const }) : null) });
    expect((await new CanadianPracticeQueries(quebecRepository, { event: vi.fn() }).resolveActive({ practiceRuleId: version.practiceRuleId, jurisdiction: "PROVINCIAL", province: "QC", at: "2026-08-14T00:00:00.000Z", traceId: "trace_fixture_123" })).province).toBe("QC");
  });
  it("keeps historical reads versioned and fails closed for missing versions/rules", async () => {
    const service = new CanadianPracticeQueries(repository(), { event: vi.fn() });
    expect((await service.readHistory(version.practiceRuleId, "trace_fixture_123"))[0]?.ruleVersion).toBe(1);
    await expect(new CanadianPracticeQueries(repository({ findVersion: vi.fn(async () => null) }), { event: vi.fn() }).readVersion(version.practiceRuleId, 9, "trace_fixture_123")).rejects.toMatchObject({ code: "CANADIAN_PRACTICE_VERSION_NOT_FOUND" });
    await expect(new CanadianPracticeQueries(repository({ resolveActive: vi.fn(async () => null) }), { event: vi.fn() }).resolveActive({ practiceRuleId: version.practiceRuleId, jurisdiction: "FEDERAL", province: null, at: "2026-08-14T00:00:00.000Z", traceId: "trace_fixture_123" })).rejects.toMatchObject({ code: "CANADIAN_PRACTICE_RULE_NOT_EFFECTIVE" });
  });
});
