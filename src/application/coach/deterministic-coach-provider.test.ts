import { describe, expect, it } from "vitest";
import { DeterministicCoachProvider } from "./deterministic-coach-provider";

const base = { mode: "CLINICAL_PHARMACIST" as const, step: "CASE" as const, objective: "Sécurité", hintLevel: 0, safetySignals: [], evidenceRefs: [] };

describe("DeterministicCoachProvider evidence policy", () => {
  it("states documentary insufficiency instead of inventing support", () => {
    const step = new DeterministicCoachProvider().generateStep({ ...base, evidenceStatus: "INSUFFICIENT" });
    expect(step.message).toContain("pas suffisamment de preuves documentaires");
    expect(step.evidenceRefs).toEqual([]);
  });

  it("surfaces conflicting sources without choosing one", () => {
    const step = new DeterministicCoachProvider().generateStep({ ...base, evidenceStatus: "CONFLICT", evidenceRefs: ["source-a", "source-b"] });
    expect(step.message).toContain("contradictoires");
    expect(step.message).toContain("aucune conclusion clinique");
  });
});
