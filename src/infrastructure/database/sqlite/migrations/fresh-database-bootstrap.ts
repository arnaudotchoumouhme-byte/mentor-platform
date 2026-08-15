import type { SqliteExecutor } from "../sqlite-executor";
import {
  assertCoreBaselineSchema,
  coreMigrationRegistry,
} from "./definitions/mig-0001-core-baseline";
import { assertImportJournalSchema } from "./definitions/mig-0002-document-import-journal";
import { assertSourceModelSchema } from "./definitions/mig-0003-source-model";
import { assertRagIndexSchema } from "./definitions/mig-0004-rag-index";
import { assertClinicalCoachSchema } from "./definitions/mig-0005-clinical-coach";
import { assertMcqCoreSchema, MCQ_CORE_TABLE_NAMES } from "./definitions/mig-0006-mcq-core";
import { assertFoundationCoreSchema, FOUNDATION_CORE_TABLE_NAMES } from "./definitions/mig-0007-foundation-academy-core";
import { assertCanadianPracticeCoreSchema, CANADIAN_PRACTICE_TABLE_NAMES } from "./definitions/mig-0008-canadian-practice-core";
import { assertQuebecPracticeSchema } from "./definitions/mig-0009-quebec-practice-extension";
import { assertCalculationsLabSchema, CALCULATIONS_LAB_TABLE_NAMES } from "./definitions/mig-0010-calculations-lab-core";
import { assertOsceSchema, OSCE_TABLE_NAMES } from "./definitions/mig-0011-osce-text-core";
import { detectDatabaseFreshness } from "./fresh-database-detector";
import { MigrationError } from "./migration-errors";
import { validateMigrationHistory } from "./migration-history-validation";
import { MigrationRunner, type MigrationRunResult } from "./migration-runner";
import type { MigrationRegistry } from "./migration-registry";
import { SqliteMigrationHistoryStore } from "./sqlite-migration-history-store";
import { SqliteSchemaInspector } from "./sqlite-schema-inspector";

export class FreshDatabaseBootstrap {
  private readonly inspector: SqliteSchemaInspector;
  private readonly history: SqliteMigrationHistoryStore;

  constructor(
    private readonly database: SqliteExecutor,
    private readonly registry: MigrationRegistry = coreMigrationRegistry,
    private readonly applicationVersion: string | null = null,
  ) {
    this.inspector = new SqliteSchemaInspector(database);
    this.history = new SqliteMigrationHistoryStore(database);
  }

  run(): MigrationRunResult {
    const initialSnapshot = this.inspector.inspect();
    const state = detectDatabaseFreshness(initialSnapshot);
    const applicationTables = initialSnapshot.tables.filter(
      (table) => table.kind === "APPLICATION_TABLE",
    );

    if (state === "FRESH") {
      this.history.ensureStorage();
    } else if (state === "VERSIONED") {
      const applied = this.history.list();
      validateMigrationHistory(applied, this.registry);
      if (applied.length === 0 && applicationTables.length > 0) {
        throw new MigrationError(
          "DATABASE_NOT_FRESH",
          "An unrecorded non-empty schema cannot use fresh database bootstrap.",
        );
      }
      if (applied.length === 1) assertCoreBaselineSchema(this.database);
    } else {
      throw new MigrationError(
        "DATABASE_NOT_FRESH",
        `Fresh database bootstrap refused database state ${state}.`,
      );
    }

    const result = new MigrationRunner(this.database, this.history).runPending(
      this.registry,
      this.applicationVersion,
    );
    if (result.currentVersion === 1) assertCoreBaselineSchema(this.database);
    if (result.currentVersion >= 2) {
      assertCoreBaselineSchema(this.database, result.currentVersion >= 11
        ? ["coach_learner_signals", "coaching_sessions", "document_chunks", "document_chunks_fts", "document_chunks_fts_config", "document_chunks_fts_content", "document_chunks_fts_data", "document_chunks_fts_docsize", "document_chunks_fts_idx", "document_import_journal", ...OSCE_TABLE_NAMES, ...CALCULATIONS_LAB_TABLE_NAMES, ...CANADIAN_PRACTICE_TABLE_NAMES, ...FOUNDATION_CORE_TABLE_NAMES, ...MCQ_CORE_TABLE_NAMES, "source_versions", "sources"].sort()
        : result.currentVersion >= 10
        ? ["coach_learner_signals", "coaching_sessions", "document_chunks", "document_chunks_fts", "document_chunks_fts_config", "document_chunks_fts_content", "document_chunks_fts_data", "document_chunks_fts_docsize", "document_chunks_fts_idx", "document_import_journal", ...CALCULATIONS_LAB_TABLE_NAMES, ...CANADIAN_PRACTICE_TABLE_NAMES, ...FOUNDATION_CORE_TABLE_NAMES, ...MCQ_CORE_TABLE_NAMES, "source_versions", "sources"].sort()
        : result.currentVersion >= 8
        ? ["coach_learner_signals", "coaching_sessions", "document_chunks", "document_chunks_fts", "document_chunks_fts_config", "document_chunks_fts_content", "document_chunks_fts_data", "document_chunks_fts_docsize", "document_chunks_fts_idx", "document_import_journal", ...CANADIAN_PRACTICE_TABLE_NAMES, ...FOUNDATION_CORE_TABLE_NAMES, ...MCQ_CORE_TABLE_NAMES, "source_versions", "sources"].sort()
        : result.currentVersion >= 7
        ? ["coach_learner_signals", "coaching_sessions", "document_chunks", "document_chunks_fts", "document_chunks_fts_config", "document_chunks_fts_content", "document_chunks_fts_data", "document_chunks_fts_docsize", "document_chunks_fts_idx", "document_import_journal", ...FOUNDATION_CORE_TABLE_NAMES, ...MCQ_CORE_TABLE_NAMES, "source_versions", "sources"].sort()
        : result.currentVersion >= 6
        ? ["coach_learner_signals", "coaching_sessions", "document_chunks", "document_chunks_fts", "document_chunks_fts_config", "document_chunks_fts_content", "document_chunks_fts_data", "document_chunks_fts_docsize", "document_chunks_fts_idx", "document_import_journal", ...MCQ_CORE_TABLE_NAMES, "source_versions", "sources"].sort()
        : result.currentVersion >= 5
        ? ["coach_learner_signals", "coaching_sessions", "document_chunks", "document_chunks_fts", "document_chunks_fts_config", "document_chunks_fts_content", "document_chunks_fts_data", "document_chunks_fts_docsize", "document_chunks_fts_idx", "document_import_journal", "source_versions", "sources"]
        : result.currentVersion >= 4
        ? ["document_chunks", "document_chunks_fts", "document_chunks_fts_config", "document_chunks_fts_content", "document_chunks_fts_data", "document_chunks_fts_docsize", "document_chunks_fts_idx", "document_import_journal", "source_versions", "sources"]
        : result.currentVersion >= 3
          ? ["document_import_journal", "source_versions", "sources"]
        : ["document_import_journal"]);
      assertImportJournalSchema(this.database);
    }
    if (result.currentVersion >= 3) assertSourceModelSchema(this.database);
    if (result.currentVersion >= 4) assertRagIndexSchema(this.database);
    if (result.currentVersion >= 5) assertClinicalCoachSchema(this.database);
    if (result.currentVersion >= 6) assertMcqCoreSchema(this.database);
    if (result.currentVersion >= 7) assertFoundationCoreSchema(this.database);
    if (result.currentVersion >= 8) assertCanadianPracticeCoreSchema(this.database);
    if (result.currentVersion >= 9) assertQuebecPracticeSchema(this.database);
    if (result.currentVersion >= 10) assertCalculationsLabSchema(this.database);
    if (result.currentVersion >= 11) assertOsceSchema(this.database);
    validateMigrationHistory(this.history.list(), this.registry);

    if (result.currentVersion !== this.registry.currentVersion) {
      throw new MigrationError(
        "FRESH_BOOTSTRAP_VALIDATION_ERROR",
        "Fresh database did not reach the registry version.",
      );
    }
    return result;
  }
}
