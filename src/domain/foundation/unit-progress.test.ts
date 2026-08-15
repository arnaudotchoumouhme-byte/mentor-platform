import { describe, expect, it } from "vitest";
import {
  FOUNDATION_UNIT_STAGES,
  advanceFoundationUnitProgress,
  completeFoundationUnitProgress,
  createFoundationUnitProgress,
} from "./unit-progress";

const id = (digit: string) => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
const start = () => createFoundationUnitProgress({ id: id("1"), learnerId: id("2"), curriculumVersionId: id("3"), unitId: id("4"), startedAt: "2026-08-13T00:00:00.000Z" });

describe("Foundation unit progress", () => {
  it("starts at pre-test and resumes idempotently", () => {
    const progress = start();
    expect(progress.currentStage).toBe("PRE_TEST");
    expect(advanceFoundationUnitProgress(progress, "PRE_TEST", "2026-08-13T00:01:00.000Z")).toBe(progress);
  });
  it("allows only the next stage", () => {
    expect(() => advanceFoundationUnitProgress(start(), "APPLICATION", "2026-08-13T00:01:00.000Z")).toThrowError(expect.objectContaining({ code: "FOUNDATION_PROGRESS_INVALID_TRANSITION" }));
  });
  it("completes only after the re-test without representing mastery", () => {
    let progress = start();
    for (const stage of FOUNDATION_UNIT_STAGES.slice(1)) progress = advanceFoundationUnitProgress(progress, stage, "2026-08-13T00:01:00.000Z");
    const completed = completeFoundationUnitProgress(progress, "2026-08-13T00:02:00.000Z");
    expect(completed.status).toBe("COMPLETED");
    expect(completed).not.toHaveProperty("masteryLevel");
  });
});
