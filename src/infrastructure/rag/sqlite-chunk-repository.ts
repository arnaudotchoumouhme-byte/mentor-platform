import "server-only";
import type { ChunkRepository } from "@/application/rag/rag-ports";
import type { DocumentChunk } from "@/domain/rag/chunk";
import type { RetrievalCandidate } from "@/domain/rag/evidence";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";

type ChunkRow = Readonly<{ chunk_id: string; source_version_id: string; source_id: string; sequence: number; text: string; char_start: number; char_end: number; page_start: number | null; page_end: number | null; section_title: string | null; heading_path: string; token_count: number; content_hash: string; index_status: DocumentChunk["indexStatus"]; language: string | null; provenance_type: string; display_name: string; vector_json: string; lexical_rank?: number }>;
const toChunk = (row: ChunkRow): DocumentChunk => ({
  chunkId: row.chunk_id, sourceVersionId: row.source_version_id, sourceId: row.source_id,
  sequence: row.sequence, text: row.text, charStart: row.char_start, charEnd: row.char_end,
  pageStart: row.page_start, pageEnd: row.page_end, sectionTitle: row.section_title,
  headingPath: JSON.parse(row.heading_path) as string[], approximateTokenCount: row.token_count,
  contentHash: row.content_hash, indexStatus: row.index_status, language: row.language, provenance: row.provenance_type,
});
const toCandidate = (row: ChunkRow, lexicalScore = 0): RetrievalCandidate => ({
  chunk: toChunk(row), displayName: row.display_name, lexicalScore, semanticScore: 0, score: lexicalScore, rank: 0,
});
const SELECT_ACTIVE = `SELECT c.*,s.display_name FROM document_chunks c
  JOIN source_versions sv ON sv.source_version_id=c.source_version_id
  JOIN sources s ON s.source_id=c.source_id AND s.version=sv.version
  WHERE s.status<>'DELETED' AND sv.index_status='INDEXED'`;

export class SqliteChunkRepository implements ChunkRepository {
  constructor(private readonly database: SqliteExecutor, private readonly embeddingProviderId: string) {}

  listPendingVersions() {
    return this.database.all<{ sourceId: string; sourceVersionId: string; text: string; pageCount: number | null; language: string | null; provenance: string }>(
      `SELECT s.source_id AS sourceId,sv.source_version_id AS sourceVersionId,sv.extracted_content AS text,
       sv.page_count AS pageCount,s.language,s.provenance_type AS provenance
       FROM source_versions sv JOIN sources s ON s.source_id=sv.source_id AND s.version=sv.version
       WHERE s.status='READY' AND sv.extraction_status='COMPLETED' AND sv.index_status IN ('NOT_INDEXED','STALE','INDEX_FAILED')`,
    );
  }

  replaceVersionChunks(sourceVersionId: string, chunks: readonly DocumentChunk[], vectors: readonly (readonly number[])[]): void {
    this.database.run("BEGIN IMMEDIATE");
    try {
      const old = this.database.all<{ chunk_id: string }>("SELECT chunk_id FROM document_chunks WHERE source_version_id=?", sourceVersionId);
      for (const row of old) this.database.run("DELETE FROM document_chunks_fts WHERE chunk_id=?", row.chunk_id);
      this.database.run("DELETE FROM document_chunks WHERE source_version_id=?", sourceVersionId);
      for (const [index, chunk] of chunks.entries()) {
        this.database.run(`INSERT INTO document_chunks (
          chunk_id,source_version_id,source_id,sequence,text,char_start,char_end,page_start,page_end,section_title,
          heading_path,token_count,content_hash,vector_json,embedding_provider,index_status,language,provenance_type
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        chunk.chunkId, chunk.sourceVersionId, chunk.sourceId, chunk.sequence, chunk.text, chunk.charStart, chunk.charEnd,
        chunk.pageStart, chunk.pageEnd, chunk.sectionTitle, JSON.stringify(chunk.headingPath), chunk.approximateTokenCount,
        chunk.contentHash, JSON.stringify(vectors[index]), this.embeddingProviderId, "INDEXED", chunk.language, chunk.provenance);
        this.database.run("INSERT INTO document_chunks_fts(chunk_id,text) VALUES(?,?)", chunk.chunkId, chunk.text);
      }
      this.database.run("UPDATE source_versions SET index_status='INDEXED' WHERE source_version_id=?", sourceVersionId);
      this.database.run("COMMIT");
    } catch (error) { this.database.run("ROLLBACK"); throw error; }
  }

  lexicalSearch(query: string, limit: number): readonly RetrievalCandidate[] {
    const terms = query.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
    if (!terms.length) return [];
    const expression = [...new Set(terms)].map((term) => `"${term.replaceAll('"', '""')}"`).join(" OR ");
    const rows = this.database.all<ChunkRow>(`SELECT c.*,s.display_name,bm25(document_chunks_fts) AS lexical_rank
      FROM document_chunks_fts JOIN document_chunks c ON c.chunk_id=document_chunks_fts.chunk_id
      JOIN source_versions sv ON sv.source_version_id=c.source_version_id
      JOIN sources s ON s.source_id=c.source_id AND s.version=sv.version
      WHERE document_chunks_fts MATCH ? AND s.status<>'DELETED' AND sv.index_status='INDEXED'
      ORDER BY lexical_rank ASC LIMIT ?`, expression, limit);
    return rows.map((row) => toCandidate(row, 1 / (1 + Math.abs(row.lexical_rank ?? 0))));
  }

  semanticCandidates(limit: number) {
    return this.database.all<ChunkRow>(`${SELECT_ACTIVE} AND c.embedding_provider=? LIMIT ?`, this.embeddingProviderId, limit)
      .map((row) => ({ candidate: toCandidate(row), vector: JSON.parse(row.vector_json) as number[] }));
  }
  countIndexed(): number { return this.database.all<{ count: number }>(`${SELECT_ACTIVE.replace("SELECT c.*,s.display_name", "SELECT COUNT(*) AS count")}`)[0]?.count ?? 0; }
  citationTarget(chunkId: string) {
    const row = this.database.all<ChunkRow & { document_id: number; source_status: string; active_version_id: string }>(`SELECT c.*,s.document_id,s.display_name,s.status AS source_status,active.source_version_id AS active_version_id
      FROM document_chunks c JOIN sources s ON s.source_id=c.source_id
      JOIN source_versions active ON active.source_id=s.source_id AND active.version=s.version WHERE c.chunk_id=? LIMIT 1`, chunkId)[0];
    return row ? { chunk: toChunk(row), documentId: row.document_id, displayName: row.display_name, sourceStatus: row.source_status, activeVersionId: row.active_version_id } : null;
  }
}
