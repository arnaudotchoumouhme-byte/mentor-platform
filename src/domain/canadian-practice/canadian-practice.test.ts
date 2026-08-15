import { describe, expect, it } from "vitest";
import { definePracticeRule, definePracticeRuleVersion, isPracticeRuleVersionEffective } from "./canadian-practice";

const ids = { rule: "10000000-0000-4000-8000-000000000001", objective: "20000000-0000-4000-8000-000000000001", version: "30000000-0000-4000-8000-000000000001", source: "40000000-0000-4000-8000-000000000001" };
const version = (overrides = {}) => definePracticeRuleVersion({ id: ids.version, practiceRuleId: ids.rule, ruleVersion: 1, jurisdiction: "FEDERAL", province: null, sourceVersionId: ids.source, verifiedAt: "2026-08-14T00:00:00.000Z", effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveTo: null, status: "ACTIVE", pedagogicalSummary: "TEST_FIXTURE summary", independenceDisclaimer: "TEST_FIXTURE — not official guidance.", createdAt: "2026-08-14T00:00:00.000Z", ...overrides });

describe("Canadian Practice domain", () => {
  it("defines an immutable rule and federal version", () => {
    expect(Object.isFrozen(definePracticeRule({ practiceRuleId: ids.rule, code: "TEST_FIXTURE", learningObjectiveId: ids.objective }))).toBe(true);
    expect(version().province).toBeNull();
  });
  it("enforces federal, Ontario and Quebec jurisdiction invariants", () => {
    expect(() => version({ province: "ON" })).toThrowError(/Federal/);
    expect(() => version({ jurisdiction: "PROVINCIAL", province: null })).toThrowError(/Ontario/);
    expect(version({ jurisdiction: "PROVINCIAL", province: "ON" }).province).toBe("ON");
    expect(version({ jurisdiction: "PROVINCIAL", province: "QC" }).province).toBe("QC");
    expect(() => version({ jurisdiction: "PROVINCIAL", province: "BC" })).toThrowError(/Ontario and Quebec/);
    expect(() => version({ province: "QC" })).toThrowError(/Federal/);
  });
  it("requires provenance, positive versions, verification and coherent dates", () => {
    expect(() => version({ sourceVersionId: "" })).toThrow();
    expect(() => version({ ruleVersion: 0 })).toThrow();
    expect(() => version({ verifiedAt: "" })).toThrow();
    expect(() => version({ effectiveTo: "2025-01-01T00:00:00.000Z" })).toThrow();
  });
  it("excludes expired, draft and retired versions from active resolution", () => {
    expect(isPracticeRuleVersionEffective(version(), "2026-08-14T00:00:00.000Z")).toBe(true);
    expect(isPracticeRuleVersionEffective(version({ effectiveTo: "2026-02-01T00:00:00.000Z" }), "2026-08-14T00:00:00.000Z")).toBe(false);
    expect(isPracticeRuleVersionEffective(version({ status: "RETIRED" }), "2026-08-14T00:00:00.000Z")).toBe(false);
    expect(isPracticeRuleVersionEffective(version({ status: "DRAFT" }), "2026-08-14T00:00:00.000Z")).toBe(false);
  });
});
