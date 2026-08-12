import type { ChunkingInput, DocumentChunk } from "@/domain/rag/chunk";
import type { EvidenceCitation } from "@/domain/rag/citation";
import type { EvidenceDecision, RetrievalCandidate } from "@/domain/rag/evidence";

export interface ChunkingService { chunk(input: ChunkingInput): readonly DocumentChunk[]; }
export interface EmbeddingProvider {
  readonly id: string;
  embedDocumentChunk(text: string): readonly number[];
  embedQuery(text: string): readonly number[];
}
export interface ChunkRepository {
  listPendingVersions(): readonly Readonly<{ sourceId: string; sourceVersionId: string; text: string; pageCount: number | null; language: string | null; provenance: string }>[];
  replaceVersionChunks(sourceVersionId: string, chunks: readonly DocumentChunk[], vectors: readonly (readonly number[])[]): void;
  lexicalSearch(query: string, limit: number): readonly RetrievalCandidate[];
  semanticCandidates(limit: number): readonly Readonly<{ candidate: RetrievalCandidate; vector: readonly number[] }>[];
  countIndexed(): number;
  citationTarget(chunkId: string): Readonly<{ chunk: DocumentChunk; documentId: number; displayName: string; sourceStatus: string; activeVersionId: string }> | null;
}
export interface Retriever { retrieve(query: string): readonly RetrievalCandidate[]; }
export interface Reranker { rerank(query: string, candidates: readonly RetrievalCandidate[]): readonly RetrievalCandidate[]; }
export interface EvidenceGate { evaluate(query: string, candidates: readonly RetrievalCandidate[], indexedCount: number): EvidenceDecision; }
export interface CitationBuilder { build(candidates: readonly RetrievalCandidate[]): readonly EvidenceCitation[]; }
