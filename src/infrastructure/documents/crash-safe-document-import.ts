import type { DocumentImportPersistencePort } from "@/application/documents/import-documents";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import type { DocumentImportStorage } from "./local-document-storage";

type ImportRecord = Readonly<{
  storage_id: string;
  extension: string;
  display_name: string;
  media_type: string;
  size: number;
  subject: string;
  document_status: string;
  content: string;
  state: "pending" | "ready" | "missing";
  created_at: number;
  document_id: number | null;
}>;

type PersistInput = Parameters<DocumentImportPersistencePort["persist"]>[0];

export const DEFAULT_IMPORT_RETENTION_MS = 24 * 60 * 60 * 1000;

export class CrashSafeDocumentImport implements DocumentImportPersistencePort {
  constructor(
    private readonly database: SqliteExecutor,
    private readonly storage: DocumentImportStorage,
    private readonly now: () => number = Date.now,
    private readonly retentionMs = DEFAULT_IMPORT_RETENTION_MS,
  ) {}

  private initialize(): void {
    this.database.run(`CREATE TABLE IF NOT EXISTS document_import_journal (
      storage_id TEXT PRIMARY KEY,
      extension TEXT NOT NULL,
      display_name TEXT NOT NULL,
      media_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      subject TEXT NOT NULL,
      document_status TEXT NOT NULL,
      content TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('pending','ready','missing')),
      created_at INTEGER NOT NULL,
      document_id INTEGER
    )`);
  }

  private createPending(input: PersistInput): void {
    this.database.run(
      `INSERT INTO document_import_journal (
        storage_id,extension,display_name,media_type,size,subject,document_status,content,state,created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      input.storageId,
      input.extension,
      input.displayName,
      input.mediaType,
      input.size,
      input.subject,
      input.status,
      input.content,
      "pending",
      this.now(),
    );
  }

  private finalize(record: ImportRecord): void {
    this.database.run("BEGIN IMMEDIATE");
    try {
      this.database.run(
        "INSERT INTO documents (name,type,size,subject,status,content) VALUES (?,?,?,?,?,?)",
        record.display_name,
        record.extension.toUpperCase(),
        record.size,
        record.subject,
        record.document_status,
        record.content,
      );
      const inserted = this.database.all<{ id: number }>(
        "SELECT last_insert_rowid() AS id",
      )[0];
      if (!inserted) throw new Error("Document insertion did not return an identifier.");
      this.database.run(
        "UPDATE document_import_journal SET state='ready', document_id=? WHERE storage_id=? AND state='pending'",
        inserted.id,
        record.storage_id,
      );
      this.database.run("COMMIT");
    } catch (error) {
      this.database.run("ROLLBACK");
      throw error;
    }
  }

  private pendingRecord(input: PersistInput): ImportRecord {
    return {
      storage_id: input.storageId,
      extension: input.extension,
      display_name: input.displayName,
      media_type: input.mediaType,
      size: input.size,
      subject: input.subject,
      document_status: input.status,
      content: input.content,
      state: "pending",
      created_at: this.now(),
      document_id: null,
    };
  }

  async persist(input: PersistInput): Promise<void> {
    this.initialize();
    const key = { id: input.storageId, extension: input.extension };
    await this.storage.writeTemporary({ ...key, bytes: input.bytes });
    try {
      this.createPending(input);
    } catch (error) {
      await this.storage.remove("pending", key);
      throw error;
    }

    try {
      await this.storage.promote(key);
    } catch (error) {
      await this.storage.remove("pending", key);
      this.database.run("DELETE FROM document_import_journal WHERE storage_id=? AND state='pending'", input.storageId);
      throw error;
    }

    this.finalize(this.pendingRecord(input));
  }

  async recover(): Promise<void> {
    this.initialize();
    const cutoff = this.now() - this.retentionMs;
    const records = this.database.all<ImportRecord>("SELECT * FROM document_import_journal");
    const known = new Set(records.map((record) => record.storage_id));

    for (const record of records) {
      const key = { id: record.storage_id, extension: record.extension };
      const finalExists = await this.storage.exists("final", key);
      if (record.state === "pending" && finalExists) {
        this.finalize(record);
        await this.storage.remove("pending", key);
      } else if (record.state === "pending" && record.created_at <= cutoff) {
        await this.storage.remove("pending", key);
        this.database.run(
          "DELETE FROM document_import_journal WHERE storage_id=? AND state='pending'",
          record.storage_id,
        );
      } else if (record.state === "ready" && !finalExists) {
        this.database.run(
          "UPDATE document_import_journal SET state='missing' WHERE storage_id=? AND state='ready'",
          record.storage_id,
        );
      } else if (record.state === "missing" && finalExists) {
        this.database.run(
          "UPDATE document_import_journal SET state='ready' WHERE storage_id=? AND state='missing'",
          record.storage_id,
        );
      }
    }

    for (const kind of ["pending", "final"] as const) {
      for (const artifact of await this.storage.list(kind)) {
        if (!known.has(artifact.id) && artifact.modifiedAt <= cutoff) {
          await this.storage.remove(kind, artifact);
        }
      }
    }
  }
}
