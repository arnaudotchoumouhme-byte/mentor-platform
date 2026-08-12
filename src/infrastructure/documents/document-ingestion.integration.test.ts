import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ImportDocuments } from "@/application/documents/import-documents";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import { FreshDatabaseBootstrap } from "@/infrastructure/database/sqlite/migrations/fresh-database-bootstrap";
import { syntheticDocx, syntheticPdf } from "@/test/fixtures/synthetic-documents";
import { CrashSafeDocumentImport } from "./crash-safe-document-import";
import type { DocumentImportStorage } from "./local-document-storage";
import { LocalDocumentExtractor } from "./local-document-extractor";
import { NodeDocumentChecksum } from "./node-document-checksum";

describe("document ingestion integration", () => {
  let sqlite: DatabaseSync;
  let database: SqliteExecutor;
  let storage: DocumentImportStorage;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    database = {
      all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[],
      run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params),
    };
    new FreshDatabaseBootstrap(database).run();
    const pending = new Set<string>();
    const final = new Set<string>();
    const key = (input: { id: string; extension: string }) => `${input.id}.${input.extension}`;
    storage = {
      writeTemporary: async (input) => { pending.add(key(input)); },
      promote: async (input) => { pending.delete(key(input)); final.add(key(input)); },
      remove: async (kind, input) => { (kind === "pending" ? pending : final).delete(key(input)); },
      exists: async (kind, input) => (kind === "pending" ? pending : final).has(key(input)),
      list: async () => [],
    };
  });

  afterEach(() => sqlite.close());

  it.each([
    ["PDF", "fixture.pdf", "application/pdf", syntheticPdf, "pharmacokinetics"],
    ["DOCX", "fixture.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", syntheticDocx, "Pharmacocinétique"],
  ])("imports, extracts and persists a real synthetic %s fixture", async (_type, name, browserMediaType, bytes, expectedText) => {
    const ids = ["123e4567-e89b-42d3-a456-426614174001", "123e4567-e89b-42d3-a456-426614174002"];
    const useCase = new ImportDocuments(
      { generate: () => ids.shift()! },
      new CrashSafeDocumentImport(database, storage),
      new LocalDocumentExtractor(),
      new NodeDocumentChecksum(),
    );
    const result = await useCase.execute({ subject: "Pharmacologie", files: [{ name, browserMediaType, size: bytes.length, bytes }] });
    expect(result.documents[0]).toMatchObject({ status: "READY" });
    expect(sqlite.prepare("SELECT provenance_type,status,extraction_status FROM sources").get()).toEqual({
      provenance_type: "USER_UPLOAD", status: "READY", extraction_status: "COMPLETED",
    });
    expect(sqlite.prepare("SELECT extracted_content FROM source_versions").get()).toMatchObject({
      extracted_content: expect.stringContaining(expectedText),
    });
    await expect(useCase.execute({ subject: "Pharmacologie", files: [{ name, browserMediaType, size: bytes.length, bytes }] }))
      .rejects.toMatchObject({ code: "FILE_DUPLICATE" });
  }, 20_000);
});
