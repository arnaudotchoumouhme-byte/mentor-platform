import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { parseEditorialSourceAlias } from "@/domain/documents/editorial-source-alias";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import { FreshDatabaseBootstrap } from "@/infrastructure/database/sqlite/migrations/fresh-database-bootstrap";
import { SqliteSourceVersionEditorialAliasRepository } from "./sqlite-source-version-editorial-alias-repository";

const alias = parseEditorialSourceAlias("SNC-COURS-2026-04-28/V1");
const record = { aliasId: "alias-1", editorialAlias: alias, sourceVersionId: "version-1", createdAt: "2026-08-20T00:00:00.000Z", actorId: "operator-1", traceId: "trace-1", provenance: "MANUAL_EDITORIAL_ASSOCIATION" as const };

describe("SqliteSourceVersionEditorialAliasRepository", () => {
  let sqlite: DatabaseSync;
  let database: SqliteExecutor;
  let repository: SqliteSourceVersionEditorialAliasRepository;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    database = { all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[], run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params) };
    new FreshDatabaseBootstrap(database).run();
    sqlite.exec("PRAGMA foreign_keys=ON; INSERT INTO documents(name,type) VALUES('Source','PDF')");
    sqlite.prepare("INSERT INTO sources(source_id,storage_id,document_id,original_filename,display_name,media_type,extension,size_bytes,checksum,status,extraction_status,version,provenance_type) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run("source-1", "storage-1", 1, "source.pdf", "Source", "application/pdf", "pdf", 1, "checksum", "READY", "COMPLETED", 1, "OFFICIAL_SOURCE");
    sqlite.prepare("INSERT INTO source_versions(source_version_id,source_id,version,checksum,extracted_content,extraction_status) VALUES(?,?,?,?,?,?)").run("version-1", "source-1", 1, "checksum", "content", "COMPLETED");
    repository = new SqliteSourceVersionEditorialAliasRepository(database);
  });

  it("associates, resolves and is idempotent", async () => {
    await expect(repository.associate(record)).resolves.toMatchObject({ status: "CREATED" });
    await expect(repository.associate({ ...record, aliasId: "unused" })).resolves.toEqual({ status: "UNCHANGED", association: record });
    await expect(repository.resolve(alias)).resolves.toEqual(record);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM source_version_editorial_aliases").get()).toEqual({ count: 1 });
  });

  it("rejects both directions of reassignment without partial writes", async () => {
    await repository.associate(record);
    sqlite.exec("INSERT INTO documents(name,type) VALUES('Second','PDF')");
    sqlite.prepare("INSERT INTO sources(source_id,storage_id,document_id,original_filename,display_name,media_type,extension,size_bytes,checksum,status,extraction_status,version,provenance_type) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run("source-2", "storage-2", 2, "second.pdf", "Second", "application/pdf", "pdf", 1, "checksum-2", "READY", "COMPLETED", 1, "OFFICIAL_SOURCE");
    sqlite.prepare("INSERT INTO source_versions(source_version_id,source_id,version,checksum,extracted_content,extraction_status) VALUES(?,?,?,?,?,?)").run("version-2", "source-2", 1, "checksum-2", "content", "COMPLETED");
    await expect(repository.associate({ ...record, aliasId: "alias-2", sourceVersionId: "version-2" })).rejects.toMatchObject({ code: "SOURCE_EDITORIAL_ALIAS_CONFLICT" });
    await expect(repository.associate({ ...record, aliasId: "alias-3", editorialAlias: parseEditorialSourceAlias("SNC-COURS-2026-04-28/V2") })).rejects.toMatchObject({ code: "SOURCE_VERSION_EDITORIAL_ALIAS_CONFLICT" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM source_version_editorial_aliases").get()).toEqual({ count: 1 });
  });

  it.each([
    ["missing", "version-missing", null, "SOURCE_VERSION_NOT_FOUND"],
    ["deleted", "version-1", "UPDATE sources SET status='DELETED'", "SOURCE_VERSION_SOURCE_DELETED"],
    ["not extracted", "version-1", "UPDATE source_versions SET extraction_status='REQUIRES_OCR'", "SOURCE_VERSION_EXTRACTION_NOT_READY"],
    ["incoherent", "version-1", "UPDATE source_versions SET checksum='other'", "SOURCE_VERSION_INCOHERENT"],
  ])("rejects %s source versions and rolls back", async (_label, sourceVersionId, setup, code) => {
    if (setup) sqlite.exec(setup);
    await expect(repository.associate({ ...record, sourceVersionId })).rejects.toMatchObject({ code });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM source_version_editorial_aliases").get()).toEqual({ count: 0 });
  });

  it("refuses UPDATE, DELETE and deletion of the referenced source version", async () => {
    await repository.associate(record);
    expect(() => sqlite.exec("UPDATE source_version_editorial_aliases SET editorial_alias='OTHER/V1'")).toThrow(/SOURCE_EDITORIAL_ALIAS_IMMUTABLE/);
    expect(() => sqlite.exec("DELETE FROM source_version_editorial_aliases")).toThrow(/SOURCE_EDITORIAL_ALIAS_IMMUTABLE/);
    expect(() => sqlite.exec("DELETE FROM source_versions WHERE source_version_id='version-1'")).toThrow(/FOREIGN KEY/);
  });
});
