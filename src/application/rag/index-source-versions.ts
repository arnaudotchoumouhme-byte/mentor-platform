import type { ChunkRepository, ChunkingService, EmbeddingProvider } from "./rag-ports";

export class IndexSourceVersions {
  constructor(
    private readonly repository: ChunkRepository,
    private readonly chunker: ChunkingService,
    private readonly embeddings: EmbeddingProvider,
  ) {}

  execute(): number {
    let indexed = 0;
    for (const version of this.repository.listPendingVersions()) {
      const chunks = this.chunker.chunk({
        sourceId: version.sourceId, sourceVersionId: version.sourceVersionId, text: version.text,
        pages: version.pageCount === 1 ? [{ pageNumber: 1, text: version.text }] : undefined,
        language: version.language, provenance: version.provenance,
      });
      this.repository.replaceVersionChunks(
        version.sourceVersionId,
        chunks,
        chunks.map((chunk) => this.embeddings.embedDocumentChunk(chunk.text)),
      );
      indexed += chunks.length;
    }
    return indexed;
  }
}
