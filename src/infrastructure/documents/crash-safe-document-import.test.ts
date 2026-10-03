import { sourceVersionPagesMigration } from "@/infrastructure/database/sqlite/migrations/definitions/mig-0021-source-version-pages";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import { IMPORT_JOURNAL_SQL } from "@/infrastructure/database/sqlite/migrations/definitions/mig-0002-document-import-journal";
import { SOURCE_MODEL_STATEMENTS } from "@/infrastructure/database/sqlite/migrations/definitions/mig-0003-source-model";
import {
  CrashSafeDocumentImport,
  DEFAULT_IMPORT_RETENTION_MS,
} from "./crash-safe-document-import";
import type { DocumentImportStorage } from "./local-document-storage";

const storageId = "123e4567-e89b-42d3-a456-426614174000";
const input = {
  learnerId: "learner-a",
  storageId,
  sourceId: storageId,
  sourceVersionId: "223e4567-e89b-42d3-a456-426614174000",
  originalFilename: "cours.txt",
  displayName: "cours.txt",
  extension: "txt",
  mediaType: "text/plain",
  size: 5,
  subject: "Pharmacologie",
  status: "Prêt",
  content: "Cours",
  checksum: "abc123",
  extractionStatus: "COMPLETED" as const,
  bytes: new TextEncoder().encode("Cours"),
};

function storage(overrides: Partial<DocumentImportStorage> = {}): DocumentImportStorage {
  return {
    writeTemporary: vi.fn(),
    promote: vi.fn(),
    remove: vi.fn(),
    exists: vi.fn(async () => false),
    list: vi.fn(async () => []),
    ...overrides,
  };
}

function database(run: SqliteExecutor["run"]): SqliteExecutor {
  return { run, all: vi.fn((sql: string) => sql.startsWith("SELECT source_id FROM sources") ? [] : [{ id: 1 }]) as unknown as SqliteExecutor["all"] };
}

describe("CrashSafeDocumentImport failure compensation", () => {
  it("contains no runtime persistent schema creation", () => {
    expect(readFileSync("src/infrastructure/documents/crash-safe-document-import.ts", "utf8")).not.toMatch(/CREATE\s+TABLE/i);
  });
  it("removes the temporary file when SQLite fails before promotion", async () => {
    const files = storage();
    const run = vi.fn((sql: string) => {
      if (sql.includes("INSERT INTO document_import_journal")) throw new Error("SQLite unavailable");
      return { changes: 0 };
    });
    const persistence = new CrashSafeDocumentImport(database(run), files);
    await expect(persistence.persist(input)).rejects.toThrow("SQLite unavailable");
    expect(files.remove).toHaveBeenCalledWith("pending", { id: storageId, extension: "txt" });
    expect(files.promote).not.toHaveBeenCalled();
  });

  it("removes pending state when final promotion fails", async () => {
    const files = storage({ promote: vi.fn().mockRejectedValue(new Error("move failed")) });
    const run = vi.fn(() => ({ changes: 1 }));
    const persistence = new CrashSafeDocumentImport(database(run), files);
    await expect(persistence.persist(input)).rejects.toThrow("move failed");
    expect(files.remove).toHaveBeenCalledWith("pending", { id: storageId, extension: "txt" });
    expect(run).toHaveBeenCalledWith(
      "DELETE FROM document_import_journal WHERE storage_id=? AND state='pending'",
      storageId,
    );
  });

  it("keeps final and pending state recoverable when final SQLite transaction fails", async () => {
    const files = storage();
    const run = vi.fn((sql: string) => {
      if (sql.startsWith("INSERT INTO documents")) throw new Error("finalize failed");
      return { changes: 1 };
    });
    const persistence = new CrashSafeDocumentImport(database(run), files);
    await expect(persistence.persist(input)).rejects.toThrow("finalize failed");
    expect(run).toHaveBeenCalledWith("ROLLBACK");
    expect(files.remove).not.toHaveBeenCalledWith("final", expect.anything());
  });
});

describe("CrashSafeDocumentImport recovery", () => {
  let sqlite: DatabaseSync;
  let executor: SqliteExecutor;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`CREATE TABLE documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT, type TEXT, size INTEGER, subject TEXT, status TEXT, content TEXT
    )`);
    sqlite.exec(IMPORT_JOURNAL_SQL);
    for (const statement of SOURCE_MODEL_STATEMENTS) sqlite.exec(statement);
    sqlite.exec("CREATE TABLE accounts(learner_id TEXT PRIMARY KEY); INSERT INTO accounts VALUES('learner-a'); CREATE TABLE learner_document_ownership(document_id INTEGER PRIMARY KEY,learner_id TEXT REFERENCES accounts(learner_id)); ALTER TABLE document_import_journal ADD COLUMN learner_id TEXT REFERENCES accounts(learner_id)");
    executor = {
      all: <T>(sql: string, ...params: SQLInputValue[]) =>
        sqlite.prepare(sql).all(...params) as T[],
      run: (sql: string, ...params: SQLInputValue[]) =>
        sqlite.prepare(sql).run(...params),
    };
    sourceVersionPagesMigration.up(executor);
  });

  afterEach(() => sqlite.close());

  it("persists three extraction pages and recovery finalizes them exactly once", async () => {
    const pages=[1,2,3].map(pageNumber=>({pageNumber,text:`page ${pageNumber}\n intacte`}));
    let fail=true;
    const interrupted:SqliteExecutor={...executor,run:(sql,...p)=>{
      if(fail && sql.startsWith("INSERT INTO source_version_pages") && p[1]===2) throw new Error("synthetic crash");
      return executor.run(sql,...p);
    }};
    const files=storage({exists:vi.fn(async kind=>kind==="final")});
    await expect(new CrashSafeDocumentImport(interrupted,files).persist({...input,pages,pageCount:3})).rejects.toThrow("synthetic crash");
    expect(executor.all("SELECT * FROM source_version_pages")).toEqual([]);
    expect(executor.all("SELECT * FROM source_versions")).toEqual([]);
    expect(executor.all("SELECT * FROM documents")).toEqual([]);
    expect(executor.all<{pages_json:string}>("SELECT pages_json FROM document_import_journal")[0].pages_json).toBe(JSON.stringify(pages));
    fail=false;
    const recovered=new CrashSafeDocumentImport(executor,files);
    await recovered.recover();await recovered.recover();
    expect(executor.all("SELECT page_number AS pageNumber,text FROM source_version_pages WHERE source_version_id=? ORDER BY page_number",input.sourceVersionId)).toEqual(pages);
    expect(executor.all("SELECT state,learner_id FROM document_import_journal")).toEqual([{state:"ready",learner_id:"learner-a"}]);
  });
  it("rejects invalid page order before any storage write",async()=>{
    const files=storage();
    await expect(new CrashSafeDocumentImport(executor,files).persist({...input,pages:[{pageNumber:2,text:"x"}]})).rejects.toThrow();
    expect(files.writeTemporary).not.toHaveBeenCalled();
  });

  it("persists the owner and rejects duplicate content for both learners without changing documents", async () => {
    const files = storage();
    const persistence = new CrashSafeDocumentImport(executor, files);
    await persistence.persist(input);
    expect(sqlite.prepare("SELECT learner_id FROM document_import_journal").get()).toEqual({learner_id:"learner-a"});
    expect(sqlite.prepare("SELECT learner_id FROM learner_document_ownership").get()).toEqual({learner_id:"learner-a"});
    await expect(persistence.hasChecksum(input.checksum, "learner-a")).resolves.toBe(true);
    await expect(persistence.hasChecksum(input.checksum, "learner-b")).rejects.toMatchObject({code:"FILE_DUPLICATE"});
    const before = sqlite.prepare("SELECT * FROM documents").all();
    await expect(persistence.persist({...input,storageId:"323e4567-e89b-42d3-a456-426614174000",sourceId:"323e4567-e89b-42d3-a456-426614174000"})).rejects.toMatchObject({code:"FILE_DUPLICATE"});
    expect(sqlite.prepare("SELECT * FROM documents").all()).toEqual(before);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM sources").get()).toEqual({n:1});
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM document_import_journal").get()).toEqual({n:1});
    expect(files.remove).toHaveBeenCalledWith("final",{id:"323e4567-e89b-42d3-a456-426614174000",extension:"txt"});
  });

  it("does not recover an old pending journal without a trustworthy learner", async () => {
    const files = storage({exists:vi.fn(async () => true)});
    sqlite.prepare(`INSERT INTO document_import_journal(storage_id,extension,display_name,media_type,size,subject,document_status,content,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(storageId,"txt","old","text/plain",5,"SNC","Prêt","text","pending",1);
    await new CrashSafeDocumentImport(executor,files).recover();
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM documents").get()).toEqual({n:0});
    expect(sqlite.prepare("SELECT state,learner_id FROM document_import_journal").get()).toEqual({state:"pending",learner_id:null});
    expect(files.remove).not.toHaveBeenCalled();
  });

  it("refuses a new import without a verified account before storing a file", async () => {
    const files=storage();
    await expect(new CrashSafeDocumentImport(executor,files).persist({...input,learnerId:"missing"})).rejects.toMatchObject({code:"DOCUMENT_IMPORT_IDENTITY_REQUIRED"});
    expect(files.writeTemporary).not.toHaveBeenCalled();
  });

  it("cleans stale temporary files without journal records", async () => {
    const files = storage({
      list: vi.fn(async (kind) =>
        kind === "pending"
          ? [{ id: storageId, extension: "txt", modifiedAt: 0 }]
          : [],
      ),
    });
    await new CrashSafeDocumentImport(executor, files, () => DEFAULT_IMPORT_RETENTION_MS + 1).recover();
    expect(files.remove).toHaveBeenCalledWith("pending", {
      id: storageId,
      extension: "txt",
      modifiedAt: 0,
    });
  });

  it("finalizes a pending record with a promoted file and is idempotent", async () => {
    const files = storage({
      exists: vi.fn(async (kind) => kind === "final"),
    });
    const persistence = new CrashSafeDocumentImport(executor, files, () => 1_000);
    await persistence.recover();
    sqlite.prepare(`INSERT INTO document_import_journal (
      storage_id,extension,display_name,media_type,size,subject,document_status,content,state,created_at,
      source_id,source_version_id,original_filename,checksum,extraction_status,learner_id
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      storageId, "txt", "cours.txt", "text/plain", 5, "Pharmacologie", "Prêt", "Cours", "pending", 1,
      storageId, input.sourceVersionId, "cours.txt", "abc123", "COMPLETED", "learner-a",
    );

    await persistence.recover();
    await persistence.recover();

    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM documents").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT state FROM document_import_journal").get()).toEqual({ state: "ready" });
    expect(sqlite.prepare("SELECT learner_id FROM learner_document_ownership").get()).toEqual({learner_id:"learner-a"});
  });

  it("never deletes a valid ready document", async () => {
    const files = storage({ exists: vi.fn(async (kind) => kind === "final") });
    const persistence = new CrashSafeDocumentImport(executor, files, () => 1_000);
    await persistence.persist(input);
    await persistence.recover();
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM documents").get()).toEqual({ count: 1 });
    expect(files.remove).not.toHaveBeenCalledWith("final", expect.anything());
  });

  it("reports migration-required when journal schema is missing without creating it", async () => {
    sqlite.exec("DROP TABLE document_import_journal");
    await expect(new CrashSafeDocumentImport(executor, storage()).recover()).rejects.toThrow(
      "database migration is required",
    );
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE name='document_import_journal'").all()).toEqual([]);
  });
});
