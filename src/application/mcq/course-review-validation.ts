import { AppError } from "@/shared/errors/app-error";
import { quoteInSource } from "./course-generation";
import type { CourseQuestion, CourseSource } from "./course-training-contract";

/** Checks the existing generated explanation format; does not assess clinical
 * correctness or rewrite an editor's content. Optional unsupported sections
 * keep their explicit NOT_SUPPORTED_BY_SOURCE marker.
 */
export function validateCourseReview(item: CourseQuestion, source: CourseSource) {
  const fail = (): never => { throw new AppError({ code: "VALIDATION_ERROR", category: "validation",
    userMessage: "Conservez toutes les sections Mentor V2, les justifications A–D cohérentes avec la bonne réponse et la citation du cours." }); };
  if (item.choices.length !== 4 || item.choices.some((choice, i) => choice.id !== ["a", "b", "c", "d"][i]) ||
    !item.choices.some(choice => choice.id === item.correctChoiceId) || item.source.sourceVersionId !== source.sourceVersionId) fail();
  const expected = ["Pourquoi cette réponse est correcte", "Comme à un enfant", "Analogie",
    "Mécanisme / concept à comprendre", "Raisonnement du pharmacien", "Indice discriminant",
    ...item.choices.map(c => `${c.id.toUpperCase()} — ${c.id === item.correctChoiceId ? "VRAI" : "FAUX"}`),
    "Piège classique", "Point PEBC à retenir", "Application clinique", "Source"];
  const sections: { title: string; lines: string[] }[] = [];
  for (const line of item.explanation.split(/\r?\n/)) {
    const title = line.trim();
    if (expected.includes(title) || /^[A-D]\s*[—–-]\s*(VRAI|FAUX)$/i.test(title)) sections.push({ title, lines: [] });
    else if (sections.length) sections[sections.length - 1].lines.push(line);
    else if (title) fail();
  }
  if (sections.length !== expected.length || sections.some((s, i) => s.title !== expected[i] || !s.lines.join("\n").trim())) fail();
  const reference = sections[sections.length - 1].lines.join("\n").trim();
  const prefix = `${source.name}\n`;
  if (!reference.startsWith(prefix) || !quoteInSource(source.text, reference.slice(prefix.length))) fail();
}
