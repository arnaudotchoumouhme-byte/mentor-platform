import type { ExtractedDocumentContent } from "@/domain/documents/extracted-content";
import type { DocumentExtension } from "@/domain/documents/document-upload-policy";

export interface DocumentExtractorPort {
  extract(input: Readonly<{
    extension: DocumentExtension;
    bytes: Uint8Array;
  }>): Promise<ExtractedDocumentContent>;
}

export interface DocumentChecksumPort {
  sha256(bytes: Uint8Array): string;
}
