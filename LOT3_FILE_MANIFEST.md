# LOT 3 file manifest

Snapshot base: `f2cfe35`. Classification performed before staging. `A` means untracked/new; `M` means tracked/modified.

| FILE | STATUS | LOT | RATIONALE | DEPENDENCIES |
|---|---:|---|---|---|
| `src/app/ai/page.tsx` | M | LOT3 | Citation and no-evidence rendering | `/api/ai`, library detail |
| `src/app/api/ai/route.ts`, `route.test.ts` | M | LOT3 | RAG route composition and trace ID | server-rag |
| `src/application/ai/ask-ai-teacher.ts`, `ask-ai-teacher.test.ts` | M | LOT3 | Evidence-first orchestration | RAG ports |
| `src/application/rag/hybrid-retriever.ts` | A | LOT3 | Lexical/vector fusion | ChunkRepository, embeddings |
| `src/application/rag/index-source-versions.ts` | A | LOT3 | Indexing pipeline | Chunker, repository |
| `src/application/rag/local-evidence-gate.ts`, `local-evidence-gate.test.ts` | A | LOT3 | Central evidence policy | Retrieval candidates |
| `src/application/rag/paragraph-chunker.ts`, `paragraph-chunker.test.ts` | A | LOT3 | Reproducible semantic-aware chunking | Chunk model |
| `src/application/rag/rag-ports.ts` | A | LOT3 | RAG ports and adapters boundary | Domain RAG |
| `src/application/rag/retrieval-evaluator.ts`, `retrieval-evaluator.test.ts` | A | LOT3 | Recall/precision/MRR evaluation | Evaluation fixtures |
| `src/application/rag/traceable-citation-builder.ts` | A | LOT3 | Reconstructible citation validation | ChunkRepository |
| `src/domain/rag/chunk.ts` | A | LOT3 | Chunk model | None |
| `src/domain/rag/citation.ts` | A | LOT3 | Citation and claim support model | None |
| `src/domain/rag/evidence.ts` | A | LOT3 | Evidence decision model | Chunk model |
| `src/infrastructure/rag/local-feature-embedding.ts`, `local-feature-embedding.test.ts` | A | LOT3 | Local deterministic embeddings | EmbeddingProvider |
| `src/infrastructure/rag/node-chunk-identity.ts` | A | LOT3 | UUID/hash adapter | Node crypto |
| `src/infrastructure/rag/sqlite-chunk-repository.ts` | A | LOT3 | FTS5, BM25 and vector persistence | MIG-0004 |
| `src/infrastructure/rag/server-rag.ts` | A | LOT3 | Server composition root | RAG adapters |
| `src/infrastructure/rag/rag-pipeline.integration.test.ts` | A | LOT3 | End-to-end retrieval/citation tests | SQLite, RAG pipeline |
| `src/test/fixtures/rag-evaluation.ts` | A | LOT3 | Synthetic RAG evaluation dataset | Evaluator |
| `docs/adr/ADR-0003-local-hybrid-rag.md` | A | LOT3 | Hybrid RAG decision | LOT3 implementation |
| `docs/modules/rag.md`, `docs/modules/retrieval.md`, `docs/modules/citations.md` | A | LOT3 | RAG documentation | LOT3 implementation |
| `docs/runbooks/RUN-RAG.md` | A | LOT3 | RAG operations | LOT3 implementation |
| `src/infrastructure/database/sqlite/migrations/definitions/mig-0004-rag-index.ts` | A | SHARED_LOT2_LOT3 | RAG schema embedded in the finalized migration chain | MIG-0003 |
| `src/infrastructure/database/sqlite/sqlite-mentor-actions.ts`, `sqlite-mentor-actions.test.ts` | M | SHARED_LOT2_LOT3 | FTS/chunk cleanup appended to LOT2 deletion | MIG-0004 |
| `src/lib/db.ts` and migration registry/tests | M/A | SHARED_LOT2_LOT3 | Current schema version and startup are coupled to MIG-0004 | Migration framework |

Separation decision: shared files are committed with the recovered LOT2 foundation because an isolated hunk split would leave the migration registry or deletion transaction incomplete. Their LOT3 responsibility is explicitly documented here.
