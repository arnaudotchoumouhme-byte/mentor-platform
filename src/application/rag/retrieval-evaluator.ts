export type RetrievalEvaluationCase = Readonly<{
  query: string;
  expectedChunkIds: readonly string[];
  returnedChunkIds: readonly string[];
  shouldAnswer: boolean;
  citationValid: boolean;
}>;

export type RetrievalMetrics = Readonly<{
  recallAtK: number;
  precisionAtK: number;
  meanReciprocalRank: number;
  noEvidenceAccuracy: number;
  citationAccuracy: number;
}>;

export function evaluateRetrieval(cases: readonly RetrievalEvaluationCase[]): RetrievalMetrics {
  if (cases.length === 0) return { recallAtK: 0, precisionAtK: 0, meanReciprocalRank: 0, noEvidenceAccuracy: 0, citationAccuracy: 0 };
  let recall = 0;
  let precision = 0;
  let reciprocalRank = 0;
  let noEvidenceCorrect = 0;
  let citationsCorrect = 0;
  for (const item of cases) {
    const expected = new Set(item.expectedChunkIds);
    const relevant = item.returnedChunkIds.filter((id) => expected.has(id));
    recall += expected.size === 0 ? Number(item.returnedChunkIds.length === 0) : relevant.length / expected.size;
    precision += item.returnedChunkIds.length === 0 ? Number(expected.size === 0) : relevant.length / item.returnedChunkIds.length;
    const firstRelevant = item.returnedChunkIds.findIndex((id) => expected.has(id));
    reciprocalRank += firstRelevant < 0 ? 0 : 1 / (firstRelevant + 1);
    noEvidenceCorrect += Number(item.shouldAnswer === (item.returnedChunkIds.length > 0));
    citationsCorrect += Number(item.citationValid);
  }
  return { recallAtK: recall / cases.length, precisionAtK: precision / cases.length, meanReciprocalRank: reciprocalRank / cases.length, noEvidenceAccuracy: noEvidenceCorrect / cases.length, citationAccuracy: citationsCorrect / cases.length };
}
