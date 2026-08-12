import type { RetrievalCandidate } from "@/domain/rag/evidence";
import type { ChunkRepository, EmbeddingProvider, Retriever } from "./rag-ports";

export const HYBRID_CONFIG = Object.freeze({ candidateK: 20, finalK: 5, semanticWeight: 0.55, lexicalWeight: 0.45 });
function cosine(left: readonly number[], right: readonly number[]): number {
  let dot = 0; let leftNorm = 0; let rightNorm = 0;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    dot += left[index] * right[index]; leftNorm += left[index] ** 2; rightNorm += right[index] ** 2;
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}

export class HybridRetriever implements Retriever {
  constructor(private readonly repository: ChunkRepository, private readonly embeddings: EmbeddingProvider) {}

  retrieve(query: string): readonly RetrievalCandidate[] {
    const lexical = this.repository.lexicalSearch(query, HYBRID_CONFIG.candidateK);
    const queryVector = this.embeddings.embedQuery(query);
    const merged = new Map<string, RetrievalCandidate>();
    for (const item of lexical) merged.set(item.chunk.chunkId, item);
    for (const entry of this.repository.semanticCandidates(5_000)) {
      const semanticScore = Math.max(0, cosine(queryVector, entry.vector));
      const prior = merged.get(entry.candidate.chunk.chunkId) ?? entry.candidate;
      merged.set(entry.candidate.chunk.chunkId, { ...prior, semanticScore });
    }
    return [...merged.values()]
      .map((item) => ({ ...item, score: HYBRID_CONFIG.semanticWeight * item.semanticScore + HYBRID_CONFIG.lexicalWeight * item.lexicalScore }))
      .sort((left, right) => right.score - left.score)
      .slice(0, HYBRID_CONFIG.finalK)
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }
}
