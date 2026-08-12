import { describe, expect, it } from "vitest";
import { evaluateRetrieval } from "./retrieval-evaluator";

describe("evaluateRetrieval", () => {
  it("computes deterministic Recall@K, Precision@K and MRR", () => {
    expect(evaluateRetrieval([
      { query: "pharmacocinétique", expectedChunkIds: ["pk"], returnedChunkIds: ["pk", "other"], shouldAnswer: true, citationValid: true },
      { query: "preuve absente", expectedChunkIds: [], returnedChunkIds: [], shouldAnswer: false, citationValid: true },
    ])).toEqual({ recallAtK: 1, precisionAtK: 0.75, meanReciprocalRank: 0.5, noEvidenceAccuracy: 1, citationAccuracy: 1 });
  });
});
