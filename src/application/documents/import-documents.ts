import type { UseCase } from "@/application/contracts";
import { validateDocumentUpload } from "@/domain/documents/document-upload-policy";
import type { DocumentChecksumPort, DocumentExtractorPort } from "./document-extractor-port";
import { AppError } from "@/shared/errors/app-error";

export type DocumentUploadInput = Readonly<{
  name: string;
  browserMediaType: string;
  size: number;
  bytes: Uint8Array;
}>;

export type ImportDocumentsInput = Readonly<{
  subject: string;
  files: readonly DocumentUploadInput[];
  traceId?: string;
}>;

export type ImportDocumentsOutput = Readonly<{
  imported: readonly string[];
  rejected: readonly string[];
  documents: readonly Readonly<{
    name: string;
    status: "READY" | "REQUIRES_OCR";
    sourceId: string;
    sourceVersionId: string;
  }>[];
}>;

export interface DocumentIdGeneratorPort {
  generate(): string;
}

export interface DocumentImportPersistencePort {
  recover(): Promise<void>;
  hasChecksum(checksum: string): Promise<boolean>;
  persist(input: Readonly<{
    storageId: string;
    sourceId: string;
    sourceVersionId: string;
    originalFilename: string;
    displayName: string;
    extension: string;
    mediaType: string;
    size: number;
    subject: string;
    status: string;
    content: string;
    checksum: string;
    extractionStatus: "COMPLETED" | "REQUIRES_OCR";
    pageCount?: number;
    bytes: Uint8Array;
  }>): Promise<void>;
}

export interface DocumentImportLoggerPort {
  event(input: Readonly<{
    name: string;
    traceId?: string;
    status: "success" | "failure" | "degraded";
    context?: Readonly<Record<string, unknown>>;
    errorCode?: string;
  }>): void;
}

export class ImportDocuments implements UseCase<ImportDocumentsInput, ImportDocumentsOutput> {
  constructor(
    private readonly ids: DocumentIdGeneratorPort,
    private readonly persistence: DocumentImportPersistencePort,
    private readonly extractor: DocumentExtractorPort,
    private readonly checksum: DocumentChecksumPort,
    private readonly logger?: DocumentImportLoggerPort,
  ) {}

  async execute(input: ImportDocumentsInput): Promise<ImportDocumentsOutput> {
    await this.persistence.recover();
    const imported: string[] = [];
    const rejected: string[] = [];
    const documents: Array<{ name: string; status: "READY" | "REQUIRES_OCR"; sourceId: string; sourceVersionId: string }> = [];

    try {
    for (const [index, file] of input.files.entries()) {
      this.logger?.event({ name: "document.import.started", status: "success", traceId: input.traceId, context: { sizeBytes: file.size } });
      const validation = validateDocumentUpload(file);
      if (!validation.accepted) {
        rejected.push(`Fichier ${index + 1}`);
        this.logger?.event({ name: "document.validation.completed", status: "failure", errorCode: validation.reason, traceId: input.traceId });
        continue;
      }
      this.logger?.event({ name: "document.validation.completed", status: "success", traceId: input.traceId, context: { extension: validation.document.extension } });

      const checksum = this.checksum.sha256(file.bytes);
      if (await this.persistence.hasChecksum(checksum)) {
        throw new AppError({
          code: "FILE_DUPLICATE",
          category: "validation",
          severity: "warn",
          userMessage: "Ce fichier existe déjà dans la bibliothèque.",
          context: { checksumPrefix: checksum.slice(0, 12) },
        });
      }
      this.logger?.event({ name: "document.extraction.started", status: "success", traceId: input.traceId, context: { extension: validation.document.extension } });
      const extracted = await this.extractor.extract({
        extension: validation.document.extension,
        bytes: file.bytes,
      });
      if (extracted.status === "FAILED") {
        throw new AppError({
          code: "INGEST_EXTRACTION_FAILED",
          category: "filesystem",
          severity: "warn",
          userMessage: "Le contenu du document n’a pas pu être extrait.",
        });
      }
      this.logger?.event({ name: "document.extraction.completed", status: extracted.status === "COMPLETED" ? "success" : "degraded", traceId: input.traceId, context: { extension: validation.document.extension, pageCount: extracted.pageCount } });
      const sourceId = this.ids.generate();
      const sourceVersionId = this.ids.generate();
      const extension = validation.document.extension;
      await this.persistence.persist({
        storageId: sourceId,
        sourceId,
        sourceVersionId,
        originalFilename: file.name,
        displayName: validation.document.displayName,
        extension,
        mediaType: validation.document.mediaType,
        size: file.size,
        subject: input.subject,
        status: extracted.status === "COMPLETED" ? "Prêt" : "OCR requis",
        content: extracted.text,
        checksum,
        extractionStatus: extracted.status,
        pageCount: extracted.pageCount,
        bytes: file.bytes,
      });
      this.logger?.event({ name: "document.stored", status: "success", traceId: input.traceId, context: { sourceId, extension, sizeBytes: file.size } });
      imported.push(validation.document.displayName);
      documents.push({
        name: validation.document.displayName,
        status: extracted.status === "COMPLETED" ? "READY" : "REQUIRES_OCR",
        sourceId,
        sourceVersionId,
      });
      this.logger?.event({
        name: "document.import.completed",
        status: extracted.status === "COMPLETED" ? "success" : "degraded",
        context: { sourceId, extension, sizeBytes: file.size, pageCount: extracted.pageCount },
        traceId: input.traceId,
      });
    }
    } catch (error) {
      this.logger?.event({
        name: "document.import.failed",
        status: "failure",
        traceId: input.traceId,
        errorCode: error instanceof AppError ? error.code : "INTERNAL_ERROR",
      });
      throw error;
    }

    return { imported, rejected, documents };
  }
}
