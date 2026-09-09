import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FreshDatabaseBootstrap } from "@/infrastructure/database/sqlite/migrations/fresh-database-bootstrap";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import { createPilotCatalog } from "@/application/mle/pilot-catalog";
import { SaveDraftCatalog } from "@/application/mle/catalog-use-cases";
import { SqliteNativeCatalogResources } from "./sqlite-native-resources";
import { SqliteCatalogRepository } from "./sqlite-catalog-repository";

describe("MLE-01 SQLite catalog", () => {
  let sqlite: DatabaseSync; let database: SqliteExecutor; let repository: SqliteCatalogRepository;
  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:"); sqlite.exec("PRAGMA foreign_keys=ON");
    database = { all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[], run: (sql, ...params) => sqlite.prepare(sql).run(...params) };
    new FreshDatabaseBootstrap(database).run(); repository = new SqliteCatalogRepository(database);
  });
  afterEach(() => sqlite.close());
  it("persists drafts without auto-import, native data or learner collection", () => {
    expect(repository.read()).toBeNull();
    new SaveDraftCatalog(repository, new SqliteNativeCatalogResources(database)).execute(createPilotCatalog());
    expect(repository.read()?.concepts).toHaveLength(7);
    expect(repository.read()?.dependencies).toHaveLength(5);
    expect(repository.read()?.concepts.every(c => c.status === "DRAFT" && c.resources.every(r => r.targetId === null))).toBe(true);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM attempts").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });
  it("rejects overwrite and publication, and appends an immutable next version", () => {
    const catalog = createPilotCatalog(); repository.saveDraft(catalog);
    expect(() => repository.saveDraft(catalog)).toThrow();
    expect(repository.read()?.concepts).toHaveLength(7);
    expect(() => repository.saveDraft({ ...catalog, concepts: [{ ...catalog.concepts[0]!, version: 2, status: "PUBLISHED", reviewerId: "editor", reviewedAt: "2026-09-09T00:00:00.000Z" }], dependencies: [] })).toThrow("draft");
    repository.saveDraft({ ...catalog, concepts: [{ ...catalog.concepts[0]!, version: 2, title: "Revised draft" }], dependencies: [] });
    const versions = repository.read()!.concepts.filter(c => c.conceptId === catalog.concepts[0]!.conceptId);
    expect(versions.map(c => c.version)).toEqual([1, 2]);
    expect(versions[0]!.title).toBe(catalog.concepts[0]!.title);
  });
  it("rolls back the whole import when a native reference is missing", () => {
    const catalog = createPilotCatalog();
    const concepts = catalog.concepts.map((c, i) => i === 6 ? { ...c, resources: [{ ...c.resources[0]!, targetId: "missing", targetVersion: "missing" }] } : c);
    expect(() => repository.saveDraft({ ...catalog, concepts })).toThrow("Unresolved");
    expect(repository.read()).toBeNull();
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM mle_concepts").get()).toEqual({ count: 0 });
  });
  it("enforces native foreign keys independently of application validation", () => {
    repository.saveDraft(createPilotCatalog());
    const id = createPilotCatalog().concepts[0]!.conceptId;
    expect(() => sqlite.prepare("INSERT INTO mle_resource_links(concept_id,concept_version,position,kind,label,target_id,target_version,provenance) VALUES(?,1,90,'QUESTION','x','missing','1','test')").run(id)).toThrow();
    expect(() => sqlite.prepare("INSERT INTO mle_concept_mappings VALUES(?,1,'PEBC-QUAL-03-2026','2.1')").run(id)).toThrow();
  });
  it("rejects a cycle added across separate transactions", () => {
    const catalog = createPilotCatalog(); repository.saveDraft(catalog);
    const edge = catalog.dependencies[0]!;
    expect(() => repository.saveDraft({ ...catalog, concepts: [], dependencies: [{ ...edge, fromId: edge.toId, toId: edge.fromId }] })).toThrow("Cyclic");
    expect(repository.read()?.dependencies).toHaveLength(5);
  });
  it("refuses non-versioned personal flashcards", () => {
    const link = { kind: "FLASHCARD" as const, targetId: "1", targetVersion: "1", label: "personal", provenance: "test" };
    expect(new SqliteNativeCatalogResources(database).isResolvable(link)).toBe(false);
  });
  it("requires an available exact source version and preserves clinical content outside MLE", () => {
    sqlite.exec(`
      INSERT INTO sources(source_id,storage_id,document_id,original_filename,display_name,media_type,extension,size_bytes,checksum,status,extraction_status,provenance_type)
      VALUES('source','storage',1,'synthetic.txt','Synthetic','text/plain','txt',1,'checksum','READY','COMPLETED','TEST');
      INSERT INTO source_versions(source_version_id,source_id,version,checksum,extracted_content,extraction_status)
      VALUES('source-v1','source',1,'checksum','Synthetic source authority','COMPLETED');
    `);
    const link = {kind:'SOURCE' as const,targetId:'source-v1',targetVersion:'source-v1',label:'Synthetic',provenance:'test'};
    const resolver = new SqliteNativeCatalogResources(database);
    expect(resolver.isResolvable(link)).toBe(true);
    expect(resolver.isResolvable({...link,targetVersion:'source-v2'})).toBe(false);
    const catalog = createPilotCatalog();
    repository.saveDraft({...catalog,concepts:[{...catalog.concepts[0]!,resources:[link]}],dependencies:[]});
    expect(JSON.stringify(repository.read())).not.toContain('Synthetic source authority');
    sqlite.exec("UPDATE sources SET status='DELETED' WHERE source_id='source'");
    expect(resolver.isResolvable(link)).toBe(false);
    expect(repository.read()!.concepts[0]!.status).toBe('DRAFT');
    expect(() => sqlite.exec("DELETE FROM source_versions WHERE source_version_id='source-v1'")).toThrow();
  });
  it("maps real synthetic Foundation, question and case versions without copying their content", () => {
    sqlite.exec(`
      INSERT INTO curriculum_versions VALUES('cv','p',1,'DRAFT','2026',NULL,'2026',NULL);
      INSERT INTO curriculum_blocks VALUES('b','cv','b','Synthetic',0,1);
      INSERT INTO curriculum_units VALUES('u','b','u','Synthetic','Synthetic',10,0,'DRAFT');
      INSERT INTO learning_objectives VALUES('o','u','o','Synthetic','KNOWLEDGE',0);
      INSERT INTO mcq_question_items(item_id,latest_version) VALUES('q',1);
      INSERT INTO mcq_question_versions(item_id,version,stem,choices_json,correct_choice_id,explanation,difficulty) VALUES('q',1,'Synthetic','[]','a','Synthetic','FOUNDATION');
      INSERT INTO osce_stations VALUES('s','s','2026');
      INSERT INTO osce_station_versions VALUES('sv','s',1,'Synthetic',60,'Synthetic','DRAFT','test','2026',NULL);
    `);
    const catalog = createPilotCatalog();
    const resources = ([['CHAPTER','u','cv'],['LEARNING_OBJECTIVE','o','cv'],['QUESTION','q','1'],['CASE','sv','1']] as const).map(([kind,targetId,targetVersion]) => ({kind,targetId,targetVersion,label:'Synthetic',provenance:'test'}));
    const resolver = new SqliteNativeCatalogResources(database);
    for (const link of resources) {
      expect(resolver.isResolvable(link)).toBe(true);
      expect(resolver.isResolvable({...link,targetVersion:'wrong'})).toBe(false);
    }
    repository.saveDraft({...catalog,concepts:[{...catalog.concepts[0]!,resources}],dependencies:[]});
    expect(repository.read()!.concepts[0]!.resources).toEqual(resources);
    expect(() => sqlite.exec("DELETE FROM mcq_question_versions WHERE item_id='q'")).toThrow();
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM mcq_sessions").get()).toEqual({count:0});
  });
});
