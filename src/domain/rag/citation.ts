export type EvidenceCitation = Readonly<{
  citationId: string;
  sourceId: string;
  documentId: number;
  sourceVersionId: string;
  chunkId: string;
  displayName: string;
  pageStart: number | null;
  pageEnd: number | null;
  sectionTitle: string | null;
  excerpt: string;
  retrievalScore: number;
  rank: number;
  provenance: string;
}>;

export type SupportedClaim = Readonly<{
  text: string;
  citationIds: readonly string[];
}>;
