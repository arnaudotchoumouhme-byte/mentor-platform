import type { UseCase } from "@/application/contracts";
import { validateDocumentUpload } from "@/domain/documents/document-upload-policy";

export type DocumentUploadInput = Readonly<{
  name: string;
  browserMediaType: string;
  size: number;
  bytes: Uint8Array;
}>;

export type ImportDocumentsInput = Readonly<{
  subject: string;
  files: readonly DocumentUploadInput[];
}>;

export type ImportDocumentsOutput = Readonly<{
  imported: readonly string[];
  rejected: readonly string[];
}>;

export interface DocumentIdGeneratorPort {
  generate(): string;
}

export interface DocumentImportPersistencePort {
  recover(): Promise<void>;
  persist(input: Readonly<{
    storageId: string;
    displayName: string;
    extension: string;
    mediaType: string;
    size: number;
    subject: string;
    status: string;
    content: string;
    bytes: Uint8Array;
  }>): Promise<void>;
}

export class ImportDocuments implements UseCase<ImportDocumentsInput, ImportDocumentsOutput> {
  constructor(
    private readonly ids: DocumentIdGeneratorPort,
    private readonly persistence: DocumentImportPersistencePort,
  ) {}

  async execute(input: ImportDocumentsInput): Promise<ImportDocumentsOutput> {
    await this.persistence.recover();
    const imported: string[] = [];
    const rejected: string[] = [];

    for (const [index, file] of input.files.entries()) {
      const validation = validateDocumentUpload(file);
      if (!validation.accepted) {
        rejected.push(`Fichier ${index + 1}`);
        continue;
      }

      const id = this.ids.generate();
      const extension = validation.document.extension;
      await this.persistence.persist({
        storageId: id,
        displayName: validation.document.displayName,
        extension,
        mediaType: validation.document.mediaType,
        size: file.size,
        subject: input.subject,
        status: validation.document.status,
        content: validation.document.content,
        bytes: file.bytes,
      });
      imported.push(validation.document.displayName);
    }

    return { imported, rejected };
  }
}
