# LOT 2 file manifest

Snapshot base: `f2cfe35`. Classification performed before staging. `A` means untracked/new; `M` means tracked/modified.

| FILE | STATUS | LOT | RATIONALE | DEPENDENCIES |
|---|---:|---|---|---|
| `README.md` | M | LOT2 | Library/import documentation links | LOT2 docs |
| `package.json`, `pnpm-lock.yaml` | M | LOT2 | PDF/DOCX extraction dependencies | pdfjs-dist, mammoth |
| `src/app/api/actions/route.ts` | M | LOT2 | Storage-aware document deletion | Library adapters |
| `src/app/api/documents/route.ts`, `route.test.ts` | M | LOT2 | Real import API | Import use case |
| `src/app/api/documents/[id]/route.ts` | A | LOT2 | Source detail API | Library source port |
| `src/app/api/state/route.ts` | M | LOT2 | Real/demo state separation | SQLite readiness |
| `src/app/library/page.tsx` | M | LOT2 | Real library UI | Documents API |
| `src/app/library/[id]/page.tsx` | A | LOT2 | Source detail UI | Source detail API |
| `src/application/documents/import-documents.ts`, `import-documents.test.ts` | M | LOT2 | Ingestion orchestration | Domain policy, storage |
| `src/application/documents/document-extractor-port.ts` | A | LOT2 | Extraction port | ExtractedContent |
| `src/application/documents/library-source-port.ts` | A | LOT2 | Source persistence port | Source model |
| `src/hooks/use-state.ts` | M | LOT2 | State contract update | API state |
| `src/domain/documents/extracted-content.ts`, `extracted-content.test.ts` | A | LOT2 | Extraction domain result | None |
| `src/domain/documents/source.ts` | A | LOT2 | Source/SourceVersion model | None |
| `src/infrastructure/documents/**` | A/M | LOT2 | Storage, validation, extraction, checksum, crash safety | Node fs, pdfjs, mammoth |
| `src/infrastructure/database/sqlite/sqlite-library-sources.ts`, `sqlite-library-sources.test.ts` | A | LOT2 | Source persistence adapter | MIG-0003 |
| `src/infrastructure/database/sqlite/activation/**` | A | LOT2 | Controlled migration activation | Migration framework |
| `src/infrastructure/database/sqlite/backup/**` | A | LOT2 | Database safety backup | SQLite |
| `src/infrastructure/database/sqlite/preflight/**` | A | LOT2 | Read-only migration preflight | Migration framework |
| `src/infrastructure/database/sqlite/server-database-startup.ts`, `server-database-startup.test.ts` | A | LOT2 | Fail-closed database startup | Preflight, migrations |
| `src/infrastructure/database/sqlite/migrations/**` except `definitions/mig-0004-rag-index.ts` | A | LOT2 | Baseline, journal and Source model migrations | SQLite |
| `src/infrastructure/database/sqlite/migrations/definitions/mig-0004-rag-index.ts` | A | SHARED_LOT2_LOT3 | Registry/tests were finalized at schema v4; splitting the registry hunks is unsafe | MIG-0003, LOT3 chunks |
| `src/infrastructure/database/sqlite/sqlite-mentor-actions.ts`, `sqlite-mentor-actions.test.ts` | M | SHARED_LOT2_LOT3 | LOT2 physical deletion plus LOT3 FTS cleanup in one transaction | Storage, MIG-0004 |
| `src/lib/db.ts` | M | SHARED_LOT2_LOT3 | LOT2 safe startup loads registry finalized with MIG-0004 | Demo seed, migrations |
| `src/demo/**` | A | LOT2 | Explicit demo seed isolation | App config |
| `src/instrumentation.ts` | A | LOT2 | Database startup observability | Server startup |
| `src/presentation/api/http-error-mapper.ts` | M | LOT2 | Import/library failure mapping | AppError |
| `src/test/fixtures/synthetic-documents.ts`, `valid-text.txt` | A | LOT2 | Extraction fixtures | Tests |
| `docs/adr/ADR-0002-source-version-extraction.md` | A | LOT2 | SourceVersion decision | Source model |
| `docs/modules/ingestion.md`, `docs/modules/library.md` | A | LOT2 | Module documentation | LOT2 implementation |
| `docs/runbooks/RUN-IMPORT.md` | A | LOT2 | Import operations | LOT2 implementation |

Protected and excluded: `DOCS1/`, `dossier evolution/`, `mentor-platform-restaure/`.
