import { expect, it } from "vitest";
import { generatedCourseItems } from "./course-generation";
import { validateCourseReview } from "./course-review-validation";

const text = "Passage synthétique suffisamment long pour une citation documentaire.";
const source = { documentId: 1, name: "Cours synthétique", text, sourceVersionId: "00000000-0000-4000-8000-000000000001" };
const [item] = generatedCourseItems({ questions: [{ stem: "Question", options: ["Un", "Deux", "Trois", "Quatre"], correct: "a", explanation: text, simple: text, analogy: "NOT_SUPPORTED_BY_SOURCE", mechanism: text, reasoning: text, clue: text, justifications: [text, text, text, text], trap: text, takeaway: text, transfer: text, quote: text, competency: "1.1" }] }, source);

it("accepts the current Mentor V2 format without rewriting it", () => {
  const before = JSON.stringify(item);
  expect(() => validateCourseReview(item, source)).not.toThrow();
  expect(JSON.stringify(item)).toBe(before);
});
it.each(["Comme à un enfant", "Analogie", "Mécanisme / concept à comprendre", "Raisonnement du pharmacien", "Indice discriminant", "A — VRAI", "B — FAUX", "C — FAUX", "D — FAUX", "Piège classique", "Point PEBC à retenir", "Application clinique", "Source"])("rejects a removed section %s", heading => {
  expect(() => validateCourseReview({ ...item, explanation: item.explanation.replace(heading, "") }, source)).toThrow();
});
it("rejects empty sections, duplicate headings and inconsistent answer labels", () => {
  for (const explanation of [
    item.explanation.replace(`Comme à un enfant\n\n${text}`, "Comme à un enfant"),
    item.explanation.replace("Analogie", "Analogie\n\nAnalogie"),
    item.explanation.replace("B — FAUX", "B — VRAI"),
  ]) expect(() => validateCourseReview({ ...item, explanation }, source)).toThrow();
});
it("preserves provenance and refuses an edited invented citation", () => {
  expect(() => validateCourseReview({ ...item, source: { ...item.source, sourceVersionId: "other" } }, source)).toThrow();
  expect(() => validateCourseReview({ ...item, explanation: item.explanation.replace(`Source\n\n${source.name}\n${text}`, `Source\n\n${source.name}\nCitation inventée sans correspondance documentaire.`) }, source)).toThrow();
});
