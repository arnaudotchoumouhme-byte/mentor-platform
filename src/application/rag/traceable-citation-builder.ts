import type { EvidenceCitation } from "@/domain/rag/citation";
import type { RetrievalCandidate } from "@/domain/rag/evidence";
import type { ChunkRepository, CitationBuilder } from "./rag-ports";

export class TraceableCitationBuilder implements CitationBuilder {
  constructor(private readonly repository: ChunkRepository) {}
  build(candidates: readonly RetrievalCandidate[]): readonly EvidenceCitation[] {
    return candidates.flatMap((candidate, index) => {
      const target = this.repository.citationTarget(candidate.chunk.chunkId);
      if (!target || target.sourceStatus === "DELETED" || target.activeVersionId !== candidate.chunk.sourceVersionId) return [];
      const excerpt = candidate.chunk.text.slice(0, 500);
      if (!target.chunk.text.includes(excerpt)) return [];
      return [{
        citationId: `citation-${candidate.chunk.chunkId}`, sourceId: candidate.chunk.sourceId, documentId: target.documentId,
        sourceVersionId: candidate.chunk.sourceVersionId, chunkId: candidate.chunk.chunkId,
        displayName: target.displayName, pageStart: candidate.chunk.pageStart, pageEnd: candidate.chunk.pageEnd,
        sectionTitle: candidate.chunk.sectionTitle, excerpt, retrievalScore: candidate.score,
        rank: index + 1, provenance: candidate.chunk.provenance,
      }];
    });
  }
}
