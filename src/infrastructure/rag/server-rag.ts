import "server-only";
import { AskAiTeacher } from "@/application/ai/ask-ai-teacher";
import { HybridRetriever } from "@/application/rag/hybrid-retriever";
import { IndexSourceVersions } from "@/application/rag/index-source-versions";
import { LocalEvidenceGate } from "@/application/rag/local-evidence-gate";
import { ParagraphChunker } from "@/application/rag/paragraph-chunker";
import { TraceableCitationBuilder } from "@/application/rag/traceable-citation-builder";
import { sqliteExecutor } from "@/infrastructure/database/sqlite/server-sqlite-executor";
import { SqliteDocumentKnowledge } from "@/infrastructure/database/sqlite/sqlite-document-knowledge";
import { structuredLogger } from "@/infrastructure/observability/structured-logger";
import { LocalFeatureEmbeddingProvider } from "./local-feature-embedding";
import { NodeChunkIdentity } from "./node-chunk-identity";
import { SqliteChunkRepository } from "./sqlite-chunk-repository";

const embeddings = new LocalFeatureEmbeddingProvider();
const chunks = new SqliteChunkRepository(sqliteExecutor, embeddings.id);
const indexer = new IndexSourceVersions(chunks, new ParagraphChunker(new NodeChunkIdentity()), embeddings);
const logger = { event: (event: { name: string; traceId?: string; status: "success" | "failure" | "degraded"; context?: Readonly<Record<string, unknown>> }) => structuredLogger.log({
  level: event.status === "failure" ? "error" : event.status === "degraded" ? "warn" : "info",
  module: "rag", operation: event.name, status: event.status, message: event.name,
  traceId: event.traceId, context: event.context,
}) };

export const askAiTeacher = new AskAiTeacher(
  new SqliteDocumentKnowledge(sqliteExecutor), indexer, new HybridRetriever(chunks, embeddings),
  new LocalEvidenceGate(), new TraceableCitationBuilder(chunks), () => chunks.countIndexed(), logger,
);
