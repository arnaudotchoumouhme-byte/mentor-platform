import { describe, expect, it } from "vitest";
import { selectQuestions } from "./question-selection";
import { SYNTHETIC_MCQ_MAPPING as mapping, syntheticMcqItem as item } from "@/test/fixtures/mcq-items";

const candidates = [
  item("a"),
  { ...item("b"), mappings: [{ ...mapping, domainId: "distribution", topicId: "dispensing" }] },
  { ...item("c"), difficulty: "ADVANCED" as const },
  item("d"),
];
describe("blueprint-aware selection", () => {
  it("is deterministic for a seed", () => { const request = { count: 3, seed: "stable", blueprintVersionId: "bp-v1" }; expect(selectQuestions(candidates, request).map((x) => x.itemId)).toEqual(selectQuestions(candidates, request).map((x) => x.itemId)); });
  it("enforces coverage constraints", () => { const selected = selectQuestions(candidates, { count: 2, seed: "s", blueprintVersionId: "bp-v1", constraints: [{ dimension: "domain", id: "distribution", minimum: 1 }] }); expect(selected.some((x) => x.itemId === "b")).toBe(true); });
  it("filters by difficulty", () => expect(selectQuestions(candidates, { count: 1, seed: "s", blueprintVersionId: "bp-v1", difficulties: ["ADVANCED"] })[0]?.itemId).toBe("c"));
  it("fails explicitly when coverage or count is impossible", () => { for (const request of [{ count: 5, seed: "s", blueprintVersionId: "bp-v1" }, { count: 1, seed: "s", blueprintVersionId: "bp-v1", constraints: [{ dimension: "domain" as const, id: "missing", minimum: 1 }] }]) { try { selectQuestions(candidates, request); } catch (error) { expect(error).toMatchObject({ code: "MCQ_SELECTION_IMPOSSIBLE" }); continue; } throw new Error("Expected MCQ_SELECTION_IMPOSSIBLE"); } });
});
