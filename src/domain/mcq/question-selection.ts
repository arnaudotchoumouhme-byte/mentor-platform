import type { QuestionItemVersion } from "./question-item";
import { McqError } from "./mcq-errors";

export type CoverageConstraint = Readonly<{ dimension: "domain" | "competency" | "topic" | "objective"; id: string; minimum: number }>;
export type SelectionRequest = Readonly<{ count: number; seed: string; blueprintVersionId: string; difficulties?: readonly QuestionItemVersion["difficulty"][]; constraints?: readonly CoverageConstraint[] }>;
const hash = (value: string): number => { let h = 2166136261; for (const char of value) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const matches = (item: QuestionItemVersion, c: CoverageConstraint): boolean => item.mappings.some((m) => c.dimension === "domain" ? m.domainId === c.id : c.dimension === "competency" ? m.competencyId === c.id : c.dimension === "topic" ? m.topicId === c.id : m.objectiveIds.includes(c.id));

export function selectQuestions(candidates: readonly QuestionItemVersion[], request: SelectionRequest): readonly QuestionItemVersion[] {
  if (!Number.isInteger(request.count) || request.count < 1 || !request.seed || !request.blueprintVersionId) throw new McqError("MCQ_SELECTION_IMPOSSIBLE", "Configuration de sélection invalide.", "Selection count, seed and blueprint are required.");
  const eligible = candidates.filter((item) => item.mappings.some((m) => m.blueprintVersionId === request.blueprintVersionId) && (!request.difficulties?.length || request.difficulties.includes(item.difficulty))).sort((a, b) => hash(`${request.seed}:${a.itemId}:${a.version}`) - hash(`${request.seed}:${b.itemId}:${b.version}`));
  if (eligible.length < request.count) throw new McqError("MCQ_SELECTION_IMPOSSIBLE", "Pas assez de questions pour cette sélection.", "Eligible item count is below requested count.");
  const selected: QuestionItemVersion[] = [];
  for (const constraint of request.constraints ?? []) {
    if (!Number.isInteger(constraint.minimum) || constraint.minimum < 0) throw new McqError("MCQ_SELECTION_IMPOSSIBLE", "Contrainte de couverture invalide.", "Coverage minimum must be a non-negative integer.");
    for (const item of eligible.filter((candidate) => matches(candidate, constraint))) { if (selected.length >= request.count || selected.filter((candidate) => matches(candidate, constraint)).length >= constraint.minimum) break; if (!selected.includes(item)) selected.push(item); }
    if (selected.filter((candidate) => matches(candidate, constraint)).length < constraint.minimum) throw new McqError("MCQ_SELECTION_IMPOSSIBLE", "Couverture blueprint impossible.", "A coverage constraint cannot be satisfied.", { dimension: constraint.dimension, id: constraint.id });
  }
  for (const item of eligible) { if (selected.length === request.count) break; if (!selected.includes(item)) selected.push(item); }
  return Object.freeze(selected);
}
