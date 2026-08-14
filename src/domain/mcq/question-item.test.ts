import { describe, expect, it } from "vitest";
import { defineBlueprintMapping } from "./blueprint-mapping";
import { defineQuestionItemVersion, isCorrectAnswer } from "./question-item";
import { SYNTHETIC_MCQ_MAPPING as mapping, syntheticMcqItem as item } from "@/test/fixtures/mcq-items";

describe("QuestionItemVersion", () => {
  it("creates an immutable, mapped and versioned item", () => { const value = item(); expect(value).toMatchObject({ itemId: "item-1", version: 1, correctChoiceId: "a" }); expect(Object.isFrozen(value)).toBe(true); });
  it.each([
    { itemId: "", version: 1 }, { itemId: "x", version: 0 },
  ])("rejects invalid identity/version %#", (override) => expect(() => defineQuestionItemVersion({ ...item(), ...override })).toThrow(/invariant/i));
  it("requires stable unique choices and a mapping", () => {
    expect(() => defineQuestionItemVersion({ ...item(), choices: [{ id: "a", text: "A" }, { id: "a", text: "B" }] })).toThrow();
    expect(() => defineQuestionItemVersion({ ...item(), mappings: [] })).toThrow();
  });
  it("validates and corrects answers outside React", () => { expect(isCorrectAnswer(item(), "a")).toBe(true); expect(isCorrectAnswer(item(), "b")).toBe(false); expect(() => isCorrectAnswer(item(), "x")).toThrow(); });
  it("requires every opaque blueprint reference", () => expect(() => defineBlueprintMapping({ ...mapping, competencyId: "" })).toThrow());
});
