import { expect, it } from "vitest";
import { courseGenerationInstructions as prompt } from "@/application/mcq/course-generation";
it.each([
  ["three plausible distractors", "exactement 1 meilleure réponse et 3 distracteurs plausibles"],
  ["credible reasoning errors", "erreur de raisonnement crédible"],
  ["no caricatures", "caricature non professionnelle"],
  ["no absurd options", "absurdité évidente"],
  ["no stylistic answer leak", "Ne pas révéler la bonne réponse"],
  ["comparable granularity", "longueur, style, granularité, précision et crédibilité clinique"],
  ["plausibility justification", "pourquoi un candidat pourrait le choisir"],
  ["precise error and superiority", "son erreur précise ; pourquoi la meilleure réponse est supérieure"],
  ["no invented recommendations", "Ne pas inventer de recommandation hors source"],
  ["insufficient source review", "rester DRAFT, signaler HUMAN_REVIEW_REQUIRED: INSUFFICIENT_SOURCE"],
])("contract requires %s", (_name, instruction) => expect(prompt).toContain(instruction));
it("keeps existing justification fields and replacement instruction",()=>{
  expect(prompt).toContain("justifications A-D");
  expect(prompt).toContain("Sinon remplacer le distracteur");
  expect(prompt).toContain("ni changer la réponse correcte");
  expect(prompt).toContain("quote field MUST be copied verbatim");
});
