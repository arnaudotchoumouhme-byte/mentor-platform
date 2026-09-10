import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SaveDraftCatalog } from "@/application/mle/catalog-use-cases";
import { createPilotCatalog } from "@/application/mle/pilot-catalog";
import type { ResourceLink } from "@/domain/mle/catalog";
import { FreshDatabaseBootstrap } from "@/infrastructure/database/sqlite/migrations/fresh-database-bootstrap";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import { SqliteCatalogRepository } from "./sqlite-catalog-repository";
import { SqliteNativeCatalogResources } from "./sqlite-native-resources";

describe("MLE SOURCE stable identity and exact version", () => {
  let sqlite: DatabaseSync;
  let repository: SqliteCatalogRepository;
  let resolver: SqliteNativeCatalogResources;
  const link: ResourceLink = { kind: "SOURCE", targetId: "source-a", targetVersion: "a-v1", label: "Synthetic reference", provenance: "test" };

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec("PRAGMA foreign_keys=ON");
    const database: SqliteExecutor = {
      all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[],
      run: (sql, ...params) => sqlite.prepare(sql).run(...params),
    };
    new FreshDatabaseBootstrap(database).run();
    repository = new SqliteCatalogRepository(database);
    resolver = new SqliteNativeCatalogResources(database);
    sqlite.exec(`
      INSERT INTO sources(source_id,storage_id,document_id,original_filename,display_name,media_type,extension,size_bytes,checksum,status,extraction_status,provenance_type,version)
      VALUES('source-a','storage-a',1,'a.txt','A','text/plain','txt',1,'a2','READY','COMPLETED','TEST',2),
            ('source-b','storage-b',2,'b.txt','B','text/plain','txt',1,'b1','READY','COMPLETED','TEST',1);
      INSERT INTO source_versions(source_version_id,source_id,version,checksum,extracted_content,extraction_status)
      VALUES('a-v1','source-a',1,'a1','Synthetic original clinical content','COMPLETED'),
            ('a-v2','source-a',2,'a2','Synthetic newer clinical content','COMPLETED'),
            ('b-v1','source-b',1,'b1','Synthetic other source content','COMPLETED');
    `);
  });
  afterEach(() => sqlite.close());

  it.each(["a-v1", "a-v2"])("resolves the exact version %s belonging to the stable source", (targetVersion) => {
    expect(resolver.isResolvable({ ...link, targetVersion })).toBe(true);
  });

  it.each([
    ["source-a", "b-v1"],
    ["missing-source", "a-v1"],
    ["source-a", "missing-version"],
    ["a-v1", "a-v1"],
    ["source-a", "1"],
  ])("rejects incompatible source/version pair %s / %s at resolver and SQL boundaries", (targetId, targetVersion) => {
    expect(resolver.isResolvable({ ...link, targetId, targetVersion })).toBe(false);
    repository.saveDraft(createPilotCatalog());
    const conceptId = createPilotCatalog().concepts[0]!.conceptId;
    expect(() => sqlite.prepare("INSERT INTO mle_resource_links(concept_id,concept_version,position,kind,label,target_id,target_version,provenance) VALUES(?,1,90,'SOURCE','Synthetic',?,?,'test')").run(conceptId, targetId, targetVersion)).toThrow(/FOREIGN KEY/);
    expect(sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it.each(["DELETED", "FAILED", "REQUIRES_OCR"])("rejects a source whose state is %s without writing a draft", (status) => {
    sqlite.prepare("UPDATE sources SET status=? WHERE source_id='source-a'").run(status);
    expect(resolver.isResolvable(link)).toBe(false);
    const catalog = createPilotCatalog();
    expect(() => repository.saveDraft({ ...catalog, concepts: [{ ...catalog.concepts[0]!, resources: [link] }], dependencies: [] })).toThrow("Unresolved");
    expect(repository.read()).toBeNull();
  });

  it.each(["FAILED", "REQUIRES_OCR"])("rejects exact version extraction %s even when the newer version is complete", (status) => {
    sqlite.prepare("UPDATE source_versions SET extraction_status=? WHERE source_version_id='a-v1'").run(status);
    expect(resolver.isResolvable(link)).toBe(false);
    expect(resolver.isResolvable({ ...link, targetVersion: "a-v2" })).toBe(true);
  });

  it("persists only the requested identity/version, keeps DRAFT and never copies or upgrades clinical content", () => {
    const catalog = createPilotCatalog();
    const before = sqlite.prepare("SELECT * FROM source_versions ORDER BY source_version_id").all();
    new SaveDraftCatalog(repository, resolver).execute({ ...catalog, concepts: [{ ...catalog.concepts[0]!, resources: [link] }], dependencies: [] });
    const persisted = repository.read()!;
    expect(persisted.concepts[0]).toMatchObject({ status: "DRAFT", reviewerId: null, reviewedAt: null, resources: [link] });
    expect(JSON.stringify(persisted)).not.toContain("clinical content");
    expect(sqlite.prepare("SELECT target_id,target_version,source_id,source_version_id FROM mle_resource_links").get()).toEqual({
      target_id: "source-a", target_version: "a-v1", source_id: "source-a", source_version_id: "a-v1",
    });
    expect(sqlite.prepare("SELECT * FROM source_versions ORDER BY source_version_id").all()).toEqual(before);
    expect(() => sqlite.exec("DELETE FROM source_versions WHERE source_version_id='a-v1'")).toThrow(/FOREIGN KEY/);
    expect(() => sqlite.exec("DELETE FROM sources WHERE source_id='source-a'")).toThrow(/FOREIGN KEY/);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM attempts").get()).toEqual({ count: 0 });
  });
});
