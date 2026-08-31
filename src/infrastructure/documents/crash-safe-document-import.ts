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
  source_id: string | null;
  source_version_id: string | null;
  checksum: string;
  extraction_status: "COMPLETED" | "REQUIRES_OCR" | "FAILED";
  page_count: number | null;
  original_filename: string;
  learner_id: string | null;
}>;

type PersistInput = Parameters<DocumentImportPersistencePort["persist"]>[0];

export const DEFAULT_IMPORT_RETENTION_MS = 24 * 60 * 60 * 1000;

export class DocumentImportSchemaNotReadyError extends Error {
  constructor(options?: ErrorOptions) {
    super("Document import schema is not ready; database migration is required.", options);
    this.name = "DocumentImportSchemaNotReadyError";
  }
}

export class CrashSafeDocumentImport implements DocumentImportPersistencePort {
  constructor(
    private readonly database: SqliteExecutor,
    private readonly storage: DocumentImportStorage,
    private readonly now: () => number = Date.now,
    private readonly retentionMs = DEFAULT_IMPORT_RETENTION_MS,
  ) {}

  private assertSchemaReady(): void {
    try {
      this.database.all("SELECT storage_id FROM document_import_journal LIMIT 0");
    } catch (cause) {
      throw new DocumentImportSchemaNotReadyError({ cause });
    }
  }

  private createPending(input: PersistInput): void {
    this.database.run(
      `INSERT INTO document_import_journal (
        storage_id,extension,display_name,media_type,size,subject,document_status,content,state,created_at,
        source_id,source_version_id,original_filename,checksum,extraction_status,page_count
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
      input.sourceId,
      input.sourceVersionId,
      input.originalFilename,
      input.checksum,
      input.extractionStatus,
      input.pageCount ?? null,
    );
  }

  private finalize(record: ImportRecord): void {
    this.database.run("BEGIN IMMEDIATE");
    try {
      this.database.run(
        "INSERT INTO documents (name,type,size,subject,status,content) VALUES (?,?,?,?,?,?)",
        record.original_filename,
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
      if (record.learner_id) this.database.run("INSERT INTO learner_document_ownership(document_id,learner_id) VALUES(?,?)", inserted.id, record.learner_id);
      if (!record.source_id || !record.source_version_id) {
        throw new Error("Source identifiers are missing from the import journal.");
      }
      this.database.run(
        `INSERT INTO sources (
          source_id,workspace_id,storage_id,document_id,original_filename,display_name,media_type,
          extension,size_bytes,checksum,source_type,status,extraction_status,version,provenance_type,
          subject,page_count
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        record.source_id,
        "local",
        record.storage_id,
        inserted.id,
        record.original_filename,
        record.display_name,
        record.media_type,
        record.extension,
        record.size,
        record.checksum,
        "DOCUMENT",
        record.extraction_status === "COMPLETED" ? "READY" : "REQUIRES_OCR",
        record.extraction_status,
        1,
        "USER_UPLOAD",
        record.subject,
        record.page_count,
      );
      this.database.run(
        `INSERT INTO source_versions (
          source_version_id,source_id,version,checksum,extracted_content,extraction_status,page_count
        ) VALUES (?,?,?,?,?,?,?)`,
        record.source_version_id,
        record.source_id,
        1,
        record.checksum,
        record.content,
        record.extraction_status,
        record.page_count,
      );
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
      source_id: input.sourceId,
      source_version_id: input.sourceVersionId,
      checksum: input.checksum,
      extraction_status: input.extractionStatus,
      page_count: input.pageCount ?? null,
      original_filename: input.originalFilename,
      learner_id: input.learnerId ?? null,
    };
  }

  async hasChecksum(checksum: string, learnerId?: string): Promise<boolean> {
    this.assertSchemaReady();
    if (learnerId) return this.database.all(
      "SELECT s.source_id FROM sources s JOIN learner_document_ownership o ON o.document_id=s.document_id WHERE s.workspace_id='local' AND s.checksum=? AND s.provenance_type='USER_UPLOAD' AND s.status<>'DELETED' AND o.learner_id=? LIMIT 1",
      checksum, learnerId,
    ).length > 0;
    return this.database.all(
      "SELECT source_id FROM sources WHERE workspace_id='local' AND checksum=? AND provenance_type='USER_UPLOAD' AND status<>'DELETED' LIMIT 1",
      checksum,
    ).length > 0;
  }

  async persist(input: PersistInput): Promise<void> {
    this.assertSchemaReady();
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
    this.assertSchemaReady();
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
