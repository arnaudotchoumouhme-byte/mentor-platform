import type { SqliteExecutor } from "../../sqlite-executor";
import { MigrationError } from "../migration-errors";
import { assertMleCatalogSchema, MLE_CATALOG_STATEMENTS } from "./mig-0018-mle-concept-catalog";

// MIG-0018 is immutable. Derive the successor DDL without modifying its definition.
export const MLE_SOURCE_IDENTITY_INDEX = "CREATE UNIQUE INDEX mle_source_versions_identity ON source_versions(source_id,source_version_id)";
export const MLE_SOURCE_LINKS_DDL = MLE_CATALOG_STATEMENTS.find(sql => sql.startsWith("CREATE TABLE mle_resource_links"))!
  .replace("source_version_id TEXT GENERATED ALWAYS AS (CASE WHEN kind='SOURCE' THEN target_id END) VIRTUAL,", "source_id TEXT GENERATED ALWAYS AS (CASE WHEN kind='SOURCE' THEN target_id END) VIRTUAL,\n    source_version_id TEXT GENERATED ALWAYS AS (CASE WHEN kind='SOURCE' THEN target_version END) VIRTUAL,")
  .replace("FOREIGN KEY(source_version_id) REFERENCES source_versions(source_version_id) ON DELETE RESTRICT,", "FOREIGN KEY(source_id) REFERENCES sources(source_id) ON DELETE RESTRICT,\n    FOREIGN KEY(source_id,source_version_id) REFERENCES source_versions(source_id,source_version_id) ON DELETE RESTRICT,");

const invalidLegacySource = `SELECT 1 FROM mle_resource_links l LEFT JOIN source_versions v ON v.source_version_id=l.target_id
  WHERE l.kind='SOURCE' AND l.target_id IS NOT NULL AND (v.source_version_id IS NULL OR l.target_version<>l.target_id) LIMIT 1`;
export const MLE_SOURCE_IDENTITY_STATEMENTS = [
  MLE_SOURCE_IDENTITY_INDEX,
  MLE_SOURCE_LINKS_DDL.replace("CREATE TABLE mle_resource_links", "CREATE TABLE mle_resource_links_next"),
  `INSERT INTO mle_resource_links_next(concept_id,concept_version,position,kind,label,target_id,target_version,provenance)
   SELECT l.concept_id,l.concept_version,l.position,l.kind,l.label,
     CASE WHEN l.kind='SOURCE' AND l.target_id IS NOT NULL THEN (SELECT v.source_id FROM source_versions v WHERE v.source_version_id=l.target_id) ELSE l.target_id END,
     l.target_version,l.provenance FROM mle_resource_links l`,
  "DROP TABLE mle_resource_links",
  "ALTER TABLE mle_resource_links_next RENAME TO mle_resource_links",
] as const;

export function assertMleSourceIdentitySchema(database: SqliteExecutor): void {
  const normalize = (sql: string) => sql.replace(/"mle_resource_links"/g, "mle_resource_links").replace(/\s+/g, " ").trim();
  const statements = [...MLE_CATALOG_STATEMENTS.filter(sql => !sql.startsWith("CREATE TABLE mle_resource_links")), MLE_SOURCE_LINKS_DDL, MLE_SOURCE_IDENTITY_INDEX];
  for (const statement of statements) {
    const name = statement.match(/^CREATE (?:TABLE|(?:UNIQUE )?INDEX) (\w+)/)![1]!;
    const actual = database.all<{ sql: string }>("SELECT sql FROM sqlite_schema WHERE name=?", name)[0]?.sql;
    if (!actual || normalize(actual) !== normalize(statement)) throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED", "MLE SOURCE identity schema is incomplete.");
  }
  if (database.all("PRAGMA foreign_key_check(mle_resource_links)").length) throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED", "MLE resource references are invalid.");
}

export const mleSourceIdentityMigration = {
  id: "MIG-0019", fromVersion: 18, toVersion: 19,
  description: "Bind MLE sources to stable source identities and exact versions",
  checksumMaterial: [invalidLegacySource, ...MLE_SOURCE_IDENTITY_STATEMENTS, "postcondition:mle-source-identity-v1"],
  up(database: SqliteExecutor) {
    assertMleCatalogSchema(database);
    if (database.all(invalidLegacySource).length) throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED", "Ambiguous legacy MLE SOURCE reference; migration refused.");
    // MigrationRunner owns the transaction. Copy every row before replacing the table;
    // neither native content nor migration history is updated by this migration.
    for (const statement of MLE_SOURCE_IDENTITY_STATEMENTS) database.run(statement);
  },
  validate: assertMleSourceIdentitySchema,
} as const;
