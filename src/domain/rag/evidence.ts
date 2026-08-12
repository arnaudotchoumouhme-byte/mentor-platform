import type { DocumentChunk } from "./chunk";

export type RetrievalCandidate = Readonly<{
  chunk: DocumentChunk;
  displayName: string;
  lexicalScore: number;
  semanticScore: number;
  score: number;
  rank: number;
}>;

export type EvidenceDecision = Readonly<{
  status: "SUFFICIENT" | "INSUFFICIENT" | "NONE";
  reason: "EVIDENCE_FOUND" | "NO_INDEXED_DOCUMENTS" | "NO_CANDIDATES" | "BELOW_THRESHOLD";
  evidence: readonly RetrievalCandidate[];
}>;
