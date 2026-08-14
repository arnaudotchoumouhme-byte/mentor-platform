import { describe, expect, it } from "vitest";
import { calculateScore } from "./scoring";
import { SYNTHETIC_MCQ_MAPPING as mapping } from "@/test/fixtures/mcq-items";

describe("MCQ scoring", () => {
  it("calculates raw, percentage, incorrect and unanswered", () => expect(calculateScore(4, [{ correct: true, mappings: [mapping] }, { correct: false, mappings: [mapping] }])).toMatchObject({ total: 4, answered: 2, correct: 1, incorrect: 1, unanswered: 2, percentage: 25 }));
  it("aggregates by domain, competency and topic without double counting an item", () => { const score = calculateScore(2, [{ correct: true, mappings: [mapping, { ...mapping, objectiveIds: ["obj-2"] }] }, { correct: false, mappings: [mapping] }]); expect(score.byDomain.care).toMatchObject({ total: 2, correct: 1, percentage: 50 }); expect(score.byCompetency.assessment.total).toBe(2); expect(score.byTopic.renal.total).toBe(2); });
  it("handles an empty assessment", () => expect(calculateScore(0, []).percentage).toBe(0));
});
