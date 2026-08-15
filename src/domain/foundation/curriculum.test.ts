import { describe, expect, it } from "vitest";
import {
  defineCurriculumBlock,
  defineCurriculumUnit,
  defineCurriculumVersion,
  defineLearningObjective,
  definePrerequisiteRule,
  publishCurriculumVersion,
} from "./curriculum";

const ids = {
  curriculum: "11111111-1111-4111-8111-111111111111",
  program: "22222222-2222-4222-8222-222222222222",
  block: "33333333-3333-4333-8333-333333333333",
  unit: "44444444-4444-4444-8444-444444444444",
  otherUnit: "55555555-5555-4555-8555-555555555555",
  objective: "66666666-6666-4666-8666-666666666666",
  rule: "77777777-7777-4777-8777-777777777777",
};

const draft = () => defineCurriculumVersion({ id: ids.curriculum, programId: ids.program, version: 1, status: "DRAFT", effectiveFrom: "2027-01-01T00:00:00.000Z", effectiveTo: null, createdAt: "2026-08-13T00:00:00.000Z", publishedAt: null });

describe("Foundation curriculum", () => {
  it("requires a positive version and a valid effective window", () => {
    expect(() => defineCurriculumVersion({ ...draft(), version: 0 })).toThrowError(expect.objectContaining({ code: "FOUNDATION_CURRICULUM_INVALID" }));
    expect(() => defineCurriculumVersion({ ...draft(), effectiveTo: "2026-01-01T00:00:00.000Z" })).toThrowError(expect.objectContaining({ code: "FOUNDATION_CURRICULUM_INVALID" }));
  });

  it("publishes a draft once without mutating it", () => {
    const original = draft();
    const published = publishCurriculumVersion(original, "2026-09-01T00:00:00.000Z");
    expect(original.status).toBe("DRAFT");
    expect(published).toMatchObject({ status: "PUBLISHED", publishedAt: "2026-09-01T00:00:00.000Z" });
    expect(() => publishCurriculumVersion(published, "2026-09-02T00:00:00.000Z")).toThrowError(expect.objectContaining({ code: "FOUNDATION_CURRICULUM_PUBLISHED" }));
    expect(defineCurriculumVersion({ ...published, status: "RETIRED" }).publishedAt).toBe(published.publishedAt);
  });

  it("validates blocks, units and objectives", () => {
    expect(Object.isFrozen(defineCurriculumBlock({ id: ids.block, curriculumVersionId: ids.curriculum, code: "BIO", title: "Biomedical", position: 0, isRequired: true }))).toBe(true);
    expect(() => defineCurriculumUnit({ id: ids.unit, blockId: ids.block, code: "U1", title: "Unit", description: "Description", estimatedDurationMinutes: 0, position: 0, status: "ACTIVE" })).toThrowError(expect.objectContaining({ code: "FOUNDATION_CURRICULUM_INVALID" }));
    expect(() => defineLearningObjective({ id: ids.objective, unitId: ids.unit, code: "O1", statement: " ", objectiveType: "KNOWLEDGE", position: 0 })).toThrowError(expect.objectContaining({ code: "FOUNDATION_CURRICULUM_INVALID" }));
  });

  it("requires exactly one prerequisite target and rejects self-dependency", () => {
    const base = { id: ids.rule, unitId: ids.unit, requiredUnitId: ids.otherUnit, requiredObjectiveId: null, minimumMasteryLevel: "N2" as const, createdAt: "2026-08-13T00:00:00.000Z" };
    expect(Object.isFrozen(definePrerequisiteRule(base))).toBe(true);
    expect(() => definePrerequisiteRule({ ...base, requiredObjectiveId: ids.objective })).toThrowError(expect.objectContaining({ code: "FOUNDATION_PREREQUISITE_INVALID" }));
    expect(() => definePrerequisiteRule({ ...base, requiredUnitId: ids.unit })).toThrowError(expect.objectContaining({ code: "FOUNDATION_PREREQUISITE_INVALID" }));
  });
});
