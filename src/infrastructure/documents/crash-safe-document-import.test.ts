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
  return { run, all: vi.fn(() => [{ id: 1 }]) as unknown as SqliteExecutor["all"] };
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
    executor = {
      all: <T>(sql: string, ...params: SQLInputValue[]) =>
        sqlite.prepare(sql).all(...params) as T[],
      run: (sql: string, ...params: SQLInputValue[]) =>
        sqlite.prepare(sql).run(...params),
    };
  });

  afterEach(() => sqlite.close());

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
      source_id,source_version_id,original_filename,checksum,extraction_status
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      storageId, "txt", "cours.txt", "text/plain", 5, "Pharmacologie", "Prêt", "Cours", "pending", 1,
      storageId, input.sourceVersionId, "cours.txt", "abc123", "COMPLETED",
    );

    await persistence.recover();
    await persistence.recover();

    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM documents").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT state FROM document_import_journal").get()).toEqual({ state: "ready" });
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
