export type ChunkIndexStatus = "NOT_INDEXED" | "INDEXING" | "INDEXED" | "INDEX_FAILED" | "STALE";

export type DocumentChunk = Readonly<{
  chunkId: string;
  sourceId: string;
  sourceVersionId: string;
  sequence: number;
  text: string;
  charStart: number;
  charEnd: number;
  pageStart: number | null;
  pageEnd: number | null;
  sectionTitle: string | null;
  headingPath: readonly string[];
  approximateTokenCount: number;
  contentHash: string;
  indexStatus: ChunkIndexStatus;
  language: string | null;
  provenance: string;
}>;

export type ChunkingInput = Readonly<{
  sourceId: string;
  sourceVersionId: string;
  text: string;
  pages?: readonly Readonly<{ pageNumber: number; text: string }>[];
  language?: string | null;
  provenance: string;
}>;
