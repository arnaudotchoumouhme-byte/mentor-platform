import type { SqliteExecutor } from "../../sqlite-executor";
import { MigrationError } from "../migration-errors";

export const MLE_CATALOG_TABLES = ["mle_blueprints", "mle_categories", "mle_competencies", "mle_concepts", "mle_concept_mappings", "mle_resource_links", "mle_dependencies"] as const;
export const MLE_CATALOG_STATEMENTS = [
  `CREATE TABLE mle_blueprints (id TEXT PRIMARY KEY NOT NULL, version TEXT NOT NULL, effective_from TEXT NOT NULL, source_url TEXT NOT NULL, created_at TEXT NOT NULL, provenance TEXT NOT NULL)`,
  `CREATE TABLE mle_categories (blueprint_id TEXT NOT NULL, code TEXT NOT NULL, label TEXT NOT NULL, total REAL NOT NULL CHECK(total BETWEEN 0 AND 100), mcq REAL NOT NULL CHECK(mcq BETWEEN 0 AND 100), osce REAL NOT NULL CHECK(osce BETWEEN 0 AND 100), PRIMARY KEY(blueprint_id,code), FOREIGN KEY(blueprint_id) REFERENCES mle_blueprints(id) ON DELETE RESTRICT)`,
  `CREATE TABLE mle_competencies (blueprint_id TEXT NOT NULL, code TEXT NOT NULL, category_code TEXT NOT NULL, PRIMARY KEY(blueprint_id,code), FOREIGN KEY(blueprint_id,category_code) REFERENCES mle_categories(blueprint_id,code) ON DELETE RESTRICT)`,
  `CREATE TABLE mle_concepts (concept_id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version>0), title TEXT NOT NULL, priority TEXT NOT NULL CHECK(priority IN ('CORE','HIGH-YIELD','SECONDARY','ADVANCED')), blueprint_id TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('DRAFT','PUBLISHED','RETIRED')), provenance TEXT NOT NULL, created_at TEXT NOT NULL, author_id TEXT NOT NULL, reviewed_at TEXT, reviewer_id TEXT, PRIMARY KEY(concept_id,version), UNIQUE(concept_id,version,blueprint_id), CHECK((reviewed_at IS NULL)=(reviewer_id IS NULL)), CHECK(status='DRAFT' OR reviewer_id IS NOT NULL), CHECK(reviewed_at IS NULL OR reviewed_at>=created_at), FOREIGN KEY(blueprint_id) REFERENCES mle_blueprints(id) ON DELETE RESTRICT)`,
  `CREATE TABLE mle_concept_mappings (concept_id TEXT NOT NULL, concept_version INTEGER NOT NULL, blueprint_id TEXT NOT NULL, competency_code TEXT NOT NULL, PRIMARY KEY(concept_id,concept_version,competency_code), FOREIGN KEY(concept_id,concept_version,blueprint_id) REFERENCES mle_concepts(concept_id,version,blueprint_id) ON DELETE RESTRICT, FOREIGN KEY(blueprint_id,competency_code) REFERENCES mle_competencies(blueprint_id,code) ON DELETE RESTRICT)`,
  `CREATE TABLE mle_resource_links (
    concept_id TEXT NOT NULL, concept_version INTEGER NOT NULL, position INTEGER NOT NULL CHECK(position>=0),
    kind TEXT NOT NULL CHECK(kind IN ('LEARNING_OBJECTIVE','CHAPTER','SOURCE','QUESTION','CASE','FLASHCARD')),
    label TEXT NOT NULL, target_id TEXT, target_version TEXT, provenance TEXT NOT NULL,
    objective_id TEXT GENERATED ALWAYS AS (CASE WHEN kind='LEARNING_OBJECTIVE' THEN target_id END) VIRTUAL,
    unit_id TEXT GENERATED ALWAYS AS (CASE WHEN kind='CHAPTER' THEN target_id END) VIRTUAL,
    source_version_id TEXT GENERATED ALWAYS AS (CASE WHEN kind='SOURCE' THEN target_id END) VIRTUAL,
    question_id TEXT GENERATED ALWAYS AS (CASE WHEN kind='QUESTION' THEN target_id END) VIRTUAL,
    question_version TEXT GENERATED ALWAYS AS (CASE WHEN kind='QUESTION' THEN target_version END) VIRTUAL,
    station_version_id TEXT GENERATED ALWAYS AS (CASE WHEN kind='CASE' THEN target_id END) VIRTUAL,
    flashcard_id TEXT GENERATED ALWAYS AS (CASE WHEN kind='FLASHCARD' THEN target_id END) VIRTUAL,
    PRIMARY KEY(concept_id,concept_version,position), CHECK((target_id IS NULL)=(target_version IS NULL)),
    FOREIGN KEY(concept_id,concept_version) REFERENCES mle_concepts(concept_id,version) ON DELETE RESTRICT,
    FOREIGN KEY(objective_id) REFERENCES learning_objectives(learning_objective_id) ON DELETE RESTRICT,
    FOREIGN KEY(unit_id) REFERENCES curriculum_units(unit_id) ON DELETE RESTRICT,
    FOREIGN KEY(source_version_id) REFERENCES source_versions(source_version_id) ON DELETE RESTRICT,
    FOREIGN KEY(question_id,question_version) REFERENCES mcq_question_versions(item_id,version) ON DELETE RESTRICT,
    FOREIGN KEY(station_version_id) REFERENCES osce_station_versions(station_version_id) ON DELETE RESTRICT,
    FOREIGN KEY(flashcard_id) REFERENCES flashcards(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE mle_dependencies (from_id TEXT NOT NULL, from_version INTEGER NOT NULL, to_id TEXT NOT NULL, to_version INTEGER NOT NULL, relation TEXT NOT NULL CHECK(relation IN ('PREREQUISITE_OF','EXPLAINS','RELATED_TO')), provenance TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(from_id,from_version,to_id,to_version,relation), CHECK(from_id<>to_id), FOREIGN KEY(from_id,from_version) REFERENCES mle_concepts(concept_id,version) ON DELETE RESTRICT, FOREIGN KEY(to_id,to_version) REFERENCES mle_concepts(concept_id,version) ON DELETE RESTRICT)`,
  "CREATE INDEX mle_mapping_competency ON mle_concept_mappings(blueprint_id,competency_code)",
  "CREATE INDEX mle_dependencies_target ON mle_dependencies(to_id,to_version)",
] as const;

/** Exact canonical DDL check also detects missing FK/CHECK/index definitions. */
export function assertMleCatalogSchema(database: SqliteExecutor): void {
  const normalize = (sql: string) => sql.replace(/\s+/g, " ").trim();
  for (const statement of MLE_CATALOG_STATEMENTS) {
    const name = statement.match(/^CREATE (?:TABLE|INDEX) (\w+)/)![1]!;
    const actual = database.all<{ sql: string }>("SELECT sql FROM sqlite_schema WHERE name=?", name)[0]?.sql;
    if (!actual || normalize(actual) !== normalize(statement)) throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED", "MLE catalog schema is incomplete.");
  }
}
export const mleConceptCatalogMigration = {
  id: "MIG-0018", fromVersion: 17, toVersion: 18,
  description: "Add draft MLE concept catalog and official blueprint mappings",
  checksumMaterial: [...MLE_CATALOG_STATEMENTS, "postcondition:mle-catalog-v1"],
  up(database: SqliteExecutor) { for (const statement of MLE_CATALOG_STATEMENTS) database.run(statement); },
  validate: assertMleCatalogSchema,
} as const;
