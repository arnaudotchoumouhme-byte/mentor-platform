import "server-only";
import { randomUUID } from "node:crypto";
import { ClinicalCoachOrchestrator } from "@/application/coach/clinical-coach-orchestrator";
import { DeterministicCoachProvider } from "@/application/coach/deterministic-coach-provider";
import { HybridRetriever } from "@/application/rag/hybrid-retriever";
import { LocalEvidenceGate } from "@/application/rag/local-evidence-gate";
import { TraceableCitationBuilder } from "@/application/rag/traceable-citation-builder";
import { sqliteExecutor } from "@/infrastructure/database/sqlite/server-sqlite-executor";
import { structuredLogger } from "@/infrastructure/observability/structured-logger";
import { LocalFeatureEmbeddingProvider } from "@/infrastructure/rag/local-feature-embedding";
import { SqliteChunkRepository } from "@/infrastructure/rag/sqlite-chunk-repository";
import { RagClinicalEvidenceService } from "./rag-clinical-evidence-service";
import { SqliteClinicalCaseRepository, SqliteCoachingSessionRepository, SqliteCoachStore, SqliteLearnerSignalRepository } from "./sqlite-coach-repository";

const embeddings = new LocalFeatureEmbeddingProvider(); const chunks = new SqliteChunkRepository(sqliteExecutor, embeddings.id); const store = new SqliteCoachStore(sqliteExecutor);
const logger = { event: (event: { name: string; traceId: string; sessionId: string; status: "success"|"failure"|"degraded"; context?: Readonly<Record<string,unknown>> }) => structuredLogger.log({ level: event.status === "failure" ? "error" : event.status === "degraded" ? "warn" : "info", module: "clinical-coach", operation: event.name, status: event.status, message: event.name, traceId: event.traceId, context: { sessionId: event.sessionId, ...event.context } }) };
export const clinicalCoach = new ClinicalCoachOrchestrator(new SqliteCoachingSessionRepository(store), new SqliteClinicalCaseRepository(store), new RagClinicalEvidenceService(new HybridRetriever(chunks, embeddings), new LocalEvidenceGate(), new TraceableCitationBuilder(chunks), () => chunks.countIndexed()), new SqliteLearnerSignalRepository(store), { id: randomUUID, now: () => new Date().toISOString() }, new DeterministicCoachProvider(), logger);
