export type SourceProvenance =
  | "USER_UPLOAD"
  | "OFFICIAL_SOURCE"
  | "PLATFORM_CONTENT"
  | "GENERATED_CONTENT"
  | "DEMO"
  | "TEST_FIXTURE";

export type SourceStatus = "READY" | "REQUIRES_OCR" | "FAILED" | "DELETED";
export type ExtractionStatus = "COMPLETED" | "REQUIRES_OCR" | "FAILED";

export type Source = Readonly<{
  sourceId: string;
  workspaceId: "local";
  originalFilename: string;
  displayName: string;
  mediaType: string;
  extension: string;
  sizeBytes: number;
  checksum: string;
  createdAt: string;
  importedAt: string;
  sourceType: "DOCUMENT";
  status: SourceStatus;
  extractionStatus: ExtractionStatus;
  version: number;
  provenanceType: SourceProvenance;
  language?: string;
  subject?: string;
  userNotes?: string;
}>;

export type SourceVersion = Readonly<{
  sourceVersionId: string;
  sourceId: string;
  version: number;
  checksum: string;
  extractedContent: string;
  extractionStatus: ExtractionStatus;
  pageCount?: number;
}>;
