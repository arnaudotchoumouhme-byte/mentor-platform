import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPilotCatalog } from "@/application/mle/pilot-catalog";
import { SqliteCatalogRepository } from "@/infrastructure/mle/sqlite-catalog-repository";
import { SqliteNativeCatalogResources } from "@/infrastructure/mle/sqlite-native-resources";
import type { SqliteExecutor } from "../sqlite-executor";
import { DatabaseMigrationPreflight } from "../preflight/database-migration-preflight";
import { coreMigrationRegistry } from "./core-migration-registry";
import { FreshDatabaseBootstrap } from "./fresh-database-bootstrap";
import { MigrationRegistry } from "./migration-registry";
import { migrationChecksum } from "./migration-checksum";
import { MigrationRunner } from "./migration-runner";
import { SqliteMigrationHistoryStore } from "./sqlite-migration-history-store";
import { assertMleCatalogSchema, mleConceptCatalogMigration } from "./definitions/mig-0018-mle-concept-catalog";
import { assertMleSourceIdentitySchema, mleSourceIdentityMigration } from "./definitions/mig-0019-mle-source-identity";

const executor = (sqlite: DatabaseSync): SqliteExecutor => ({
  all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[],
  run: (sql, ...params) => sqlite.prepare(sql).run(...params),
});
const v18 = new MigrationRegistry(coreMigrationRegistry.migrations.filter(m => m.toVersion <= 18));
const originalChecksum = "b4ce8d19a3f5cf6e8c148c4b62243e4b077898bf19b353451e1af16e41708d0b";

it("bootstraps a fresh in-memory database through all nineteen canonical migrations", () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    const db = executor(sqlite);
    expect(new FreshDatabaseBootstrap(db).run()).toEqual({ currentVersion: 19, appliedMigrationIds: Array.from({ length: 19 }, (_, i) => `MIG-${String(i + 1).padStart(4, "0")}`) });
    expect(sqlite.prepare("SELECT checksum FROM schema_migrations WHERE migration_id='MIG-0018'").get()).toEqual({ checksum: originalChecksum });
    expect(sqlite.prepare("SELECT checksum FROM schema_migrations WHERE migration_id='MIG-0019'").get()).toEqual({ checksum: migrationChecksum(mleSourceIdentityMigration) });
    assertMleSourceIdentitySchema(db);
  } finally { sqlite.close(); }
});

describe("MIG-0019 upgrades the historical MIG-0018 without rewriting history", () => {
  let sqlite: DatabaseSync;
  let db: SqliteExecutor;
  const history = () => sqlite.prepare("SELECT * FROM schema_migrations ORDER BY to_version").all();
  const links = () => sqlite.prepare("SELECT concept_id,concept_version,position,kind,label,target_id,target_version,provenance FROM mle_resource_links ORDER BY concept_id,concept_version,position").all();
  const migrate = () => new MigrationRunner(db, new SqliteMigrationHistoryStore(db)).runPending(coreMigrationRegistry);
  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec("PRAGMA foreign_keys=ON");
    db = executor(sqlite);
    new FreshDatabaseBootstrap(db, v18).run();
    new SqliteCatalogRepository(db).saveDraft(createPilotCatalog());
    sqlite.exec(`INSERT INTO sources(source_id,storage_id,document_id,original_filename,display_name,media_type,extension,size_bytes,checksum,status,extraction_status,provenance_type,version)
      VALUES('source-a','storage-a',1,'a.txt','A','text/plain','txt',1,'a2','READY','COMPLETED','TEST',2);
      INSERT INTO source_versions(source_version_id,source_id,version,checksum,extracted_content,extraction_status)
      VALUES('a-v1','source-a',1,'a1','Synthetic old content','COMPLETED'),('a-v2','source-a',2,'a2','Synthetic new content','COMPLETED');`);
    sqlite.prepare("INSERT INTO mle_resource_links(concept_id,concept_version,position,kind,label,target_id,target_version,provenance) VALUES(?,1,90,'SOURCE','Historical exact reference','a-v1','a-v1','synthetic-v18')").run(createPilotCatalog().concepts[0]!.conceptId);
  });
  afterEach(() => sqlite.close());

  it("copies all links, preserves every prior journal field, concepts and content, and keeps the exact old version", () => {
    const beforeHistory = history();
    const beforeLinks = links();
    const beforeConcepts = sqlite.prepare("SELECT * FROM mle_concepts").all();
    const beforeContent = sqlite.prepare("SELECT * FROM source_versions").all();
    expect(migrationChecksum(mleConceptCatalogMigration)).toBe(originalChecksum);
    expect(new FreshDatabaseBootstrap(db).run()).toEqual({ currentVersion: 19, appliedMigrationIds: ["MIG-0019"] });
    expect(history().slice(0, 18)).toEqual(beforeHistory);
    expect(links()).toEqual(beforeLinks.map(row => row.kind === "SOURCE" && row.target_id !== null ? { ...row, target_id: "source-a" } : row));
    expect(sqlite.prepare("SELECT * FROM mle_concepts").all()).toEqual(beforeConcepts);
    expect(beforeConcepts.every(row => row.status === "DRAFT" && row.reviewed_at === null && row.reviewer_id === null)).toBe(true);
    expect(sqlite.prepare("SELECT * FROM source_versions").all()).toEqual(beforeContent);
    const catalog = new SqliteCatalogRepository(db).read()!;
    const link = catalog.concepts.flatMap(c => c.resources).find(r => r.targetId === "source-a")!;
    expect(link.targetVersion).toBe("a-v1");
    expect(new SqliteNativeCatalogResources(db).isResolvable(link)).toBe(true);
    expect(JSON.stringify(catalog)).not.toContain("Synthetic old content");
    expect(sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(sqlite.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
  });

  it("requires backup and explicit activation for an already-versioned v18 database", () => {
    const before = history();
    expect(new DatabaseMigrationPreflight(db).inspect()).toMatchObject({ currentVersion: 18, targetVersion: 19, pendingMigrations: ["MIG-0019"], status: "BLOCKED", backupRequirement: "BACKUP_REQUIRED_MISSING", migrationAllowed: false });
    expect(history()).toEqual(before);
  });

  it("is idempotent and validates the current v19 schema in preflight", () => {
    migrate();
    const before = history();
    expect(new FreshDatabaseBootstrap(db).run()).toEqual({ currentVersion: 19, appliedMigrationIds: [] });
    expect(new DatabaseMigrationPreflight(db).inspect()).toMatchObject({ currentVersion: 19, status: "NO_MIGRATION" });
    expect(history()).toEqual(before);
  });

  it("refuses ambiguous legacy version pairs without losing rows or appending history", () => {
    sqlite.exec("UPDATE mle_resource_links SET target_version='a-v2' WHERE target_id='a-v1'");
    const beforeHistory = history();
    const beforeLinks = links();
    expect(migrate).toThrow("MIG-0019 failed");
    expect(history()).toEqual(beforeHistory);
    expect(links()).toEqual(beforeLinks);
    assertMleCatalogSchema(db);
  });

  it("rolls back the table replacement, index and history on a failure after dropping the old table", () => {
    const beforeHistory = history();
    const beforeLinks = links();
    const failing: SqliteExecutor = { all: db.all, run: (sql, ...params) => {
      const result = db.run(sql, ...params);
      if (sql === "DROP TABLE mle_resource_links") throw new Error("Injected replacement failure");
      return result;
    } };
    expect(() => new MigrationRunner(failing, new SqliteMigrationHistoryStore(failing)).runPending(coreMigrationRegistry)).toThrow("MIG-0019 failed");
    expect(history()).toEqual(beforeHistory);
    expect(links()).toEqual(beforeLinks);
    assertMleCatalogSchema(db);
    expect(sqlite.prepare("SELECT name FROM sqlite_schema WHERE name IN ('mle_source_versions_identity','mle_resource_links_next')").all()).toEqual([]);
    expect(migrate()).toEqual({ currentVersion: 19, appliedMigrationIds: ["MIG-0019"] });
  });

  it("detects a missing SOURCE identity index and rejects incompatible pairs after upgrade", () => {
    migrate();
    expect(() => sqlite.exec("UPDATE mle_resource_links SET target_id='missing-source' WHERE target_id='source-a'")).toThrow(/FOREIGN KEY/);
    sqlite.exec("DROP INDEX mle_source_versions_identity");
    expect(() => assertMleSourceIdentitySchema(db)).toThrow("incomplete");
  });
});
