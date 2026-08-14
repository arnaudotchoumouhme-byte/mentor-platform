import type { BlueprintMapping } from "./blueprint-mapping";

export type ScoredAnswer = Readonly<{ correct: boolean; mappings: readonly BlueprintMapping[] }>;
export type ScoreBucket = Readonly<{ total: number; correct: number; incorrect: number; unanswered: number; percentage: number }>;
export type McqScore = ScoreBucket & Readonly<{ answered: number; byDomain: Readonly<Record<string, ScoreBucket>>; byCompetency: Readonly<Record<string, ScoreBucket>>; byTopic: Readonly<Record<string, ScoreBucket>> }>;

const bucket = (total: number, correct: number): ScoreBucket => Object.freeze({ total, correct, incorrect: total - correct, unanswered: 0, percentage: total === 0 ? 0 : Math.round(correct / total * 10000) / 100 });
function aggregate(answers: readonly ScoredAnswer[], key: (mapping: BlueprintMapping) => string): Readonly<Record<string, ScoreBucket>> {
  const values = new Map<string, { total: number; correct: number }>();
  for (const answer of answers) for (const id of new Set(answer.mappings.map(key))) { const value = values.get(id) ?? { total: 0, correct: 0 }; value.total++; if (answer.correct) value.correct++; values.set(id, value); }
  return Object.freeze(Object.fromEntries([...values].map(([id, value]) => [id, bucket(value.total, value.correct)])));
}
export function calculateScore(total: number, answers: readonly ScoredAnswer[]): McqScore {
  const correct = answers.filter(({ correct: value }) => value).length;
  const answered = answers.length;
  return Object.freeze({ total, answered, correct, incorrect: answered - correct, unanswered: Math.max(0, total - answered), percentage: total === 0 ? 0 : Math.round(correct / total * 10000) / 100,
    byDomain: aggregate(answers, (m) => m.domainId), byCompetency: aggregate(answers, (m) => m.competencyId), byTopic: aggregate(answers, (m) => m.topicId) });
}
