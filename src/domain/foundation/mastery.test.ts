import { describe, expect, it } from "vitest";
import {
  completeExitAssessment,
  createExitAssessment,
  defineFoundationRecommendation,
  defineMasteryEstimate,
} from "./mastery";

const id = (digit: string) => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
const ids = { entity: id("1"), learner: id("2"), curriculum: id("3"), block: id("4"), unit: id("5"), observation: id("6") };
const scope = { learnerId: ids.learner, curriculumVersionId: ids.curriculum, blockId: ids.block, unitId: ids.unit, objectiveId: null };

describe("Foundation mastery and decisions", () => {
  it("allows N0 without evidence but requires evidence for observed mastery", () => {
    expect(Object.isFrozen(defineMasteryEstimate({ ...scope, id: ids.entity, level: "N0", confidence: 0, calculatedAt: "2026-08-13T00:00:00.000Z", evidenceObservationIds: [], ruleVersion: "rules-v1" }))).toBe(true);
    expect(() => defineMasteryEstimate({ ...scope, id: ids.entity, level: "N2", confidence: 0.7, calculatedAt: "2026-08-13T00:00:00.000Z", evidenceObservationIds: [], ruleVersion: "rules-v1" })).toThrowError(expect.objectContaining({ code: "FOUNDATION_MASTERY_INVALID" }));
  });
  it("requires bounded confidence and a rule version", () => {
    expect(() => defineMasteryEstimate({ ...scope, id: ids.entity, level: "N2", confidence: -0.1, calculatedAt: "2026-08-13T00:00:00.000Z", evidenceObservationIds: [ids.observation], ruleVersion: "rules-v1" })).toThrowError(expect.objectContaining({ code: "FOUNDATION_OBSERVATION_INVALID" }));
    expect(() => defineMasteryEstimate({ ...scope, id: ids.entity, level: "N2", confidence: 0.7, calculatedAt: "2026-08-13T00:00:00.000Z", evidenceObservationIds: [ids.observation], ruleVersion: " " })).toThrowError();
  });
  it("keeps recommendation evidence, justification and supersession", () => {
    const recommendation = defineFoundationRecommendation({ id: ids.entity, learnerId: ids.learner, curriculumVersionId: ids.curriculum, blockId: ids.block, unitId: ids.unit, decision: "EXEMPTED", justification: "Observed mastery", evidenceObservationIds: [ids.observation], ruleVersion: "rules-v1", decidedAt: "2026-08-13T00:00:00.000Z", supersedesId: null });
    expect(recommendation).toMatchObject({ decision: "EXEMPTED", justification: "Observed mastery" });
    expect(Object.isFrozen(recommendation.evidenceObservationIds)).toBe(true);
  });
  it("assigns a decision only on completion and forces re-test for critical errors", () => {
    const assessment = createExitAssessment({ id: ids.entity, learnerId: ids.learner, curriculumVersionId: ids.curriculum, unitId: ids.unit, startedAt: "2026-08-13T00:00:00.000Z", ruleVersion: "rules-v1" });
    expect(assessment.pedagogicalDecision).toBeNull();
    const completed = completeExitAssessment(assessment, { completedAt: "2026-08-13T00:01:00.000Z", observationIds: [ids.observation], result: { passed: true }, unresolvedCriticalErrors: ["SAFETY"], decision: "READY_FOR_MCQ" });
    expect(completed.pedagogicalDecision).toBe("RETEST_REQUIRED");
    expect(() => completeExitAssessment(completed, { completedAt: "2026-08-13T00:02:00.000Z", observationIds: [ids.observation], result: {}, unresolvedCriticalErrors: [], decision: "READY_FOR_MCQ" })).toThrowError(expect.objectContaining({ code: "FOUNDATION_EXIT_ASSESSMENT_INVALID" }));
  });
});
