import { describe, expect, it } from "vitest";
import {
  completeFoundationDiagnostic,
  createFoundationDiagnostic,
  defineDiagnosticObservation,
  recordDiagnosticObservation,
} from "./diagnostic";

const id = (digit: string) => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
const ids = { diagnostic: id("1"), learner: id("2"), curriculum: id("3"), block: id("4"), observation: id("5") };
const diagnostic = () => createFoundationDiagnostic({ id: ids.diagnostic, learnerId: ids.learner, curriculumVersionId: ids.curriculum, targetBlockIds: [ids.block], startedAt: "2026-08-13T00:00:00.000Z", expectedCount: 1 });
const observation = () => defineDiagnosticObservation({ id: ids.observation, diagnosticId: ids.diagnostic, learnerId: ids.learner, curriculumVersionId: ids.curriculum, blockId: ids.block, unitId: null, objectiveId: null, activityType: "PRE_TEST", outcome: { correct: true }, confidence: 0.8, durationMs: 1000, criticalErrorCategory: null, evidenceType: "FOUNDATION", evidenceRefId: null, evidenceRefVersion: null, observedAt: "2026-08-13T00:01:00.000Z" });

describe("Foundation diagnostic", () => {
  it("requires a non-empty scope", () => { expect(() => createFoundationDiagnostic({ ...diagnostic(), targetBlockIds: [] })).toThrowError(expect.objectContaining({ code: "FOUNDATION_DIAGNOSTIC_INVALID" })); });
  it("validates confidence, duration and paired external references", () => {
    expect(() => defineDiagnosticObservation({ ...observation(), confidence: 1.1 })).toThrowError(expect.objectContaining({ code: "FOUNDATION_OBSERVATION_INVALID" }));
    expect(() => defineDiagnosticObservation({ ...observation(), durationMs: -1 })).toThrowError(expect.objectContaining({ code: "FOUNDATION_OBSERVATION_INVALID" }));
    expect(() => defineDiagnosticObservation({ ...observation(), evidenceRefId: "item", evidenceRefVersion: null })).toThrowError(expect.objectContaining({ code: "FOUNDATION_OBSERVATION_INVALID" }));
    expect(() => defineDiagnosticObservation({ ...observation(), evidenceRefId: "item", evidenceRefVersion: " " })).toThrowError(expect.objectContaining({ code: "FOUNDATION_OBSERVATION_INVALID" }));
  });
  it("advances monotonically and closes coherently", () => {
    const observed = recordDiagnosticObservation(diagnostic(), observation());
    expect(observed.observedCount).toBe(1);
    const completed = completeFoundationDiagnostic(observed, "2026-08-13T00:02:00.000Z");
    expect(completed.status).toBe("COMPLETED");
    expect(() => recordDiagnosticObservation(completed, observation())).toThrowError(expect.objectContaining({ code: "FOUNDATION_DIAGNOSTIC_CLOSED" }));
  });
  it("does not complete without expected observations", () => { expect(() => completeFoundationDiagnostic(diagnostic(), "2026-08-13T00:02:00.000Z")).toThrowError(expect.objectContaining({ code: "FOUNDATION_DIAGNOSTIC_INVALID" })); });
});
