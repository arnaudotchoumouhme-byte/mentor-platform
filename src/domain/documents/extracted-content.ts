import type { ExtractionStatus } from "./source";

export type ExtractedPage = Readonly<{ pageNumber: number; text: string }>;

export type ExtractedDocumentContent = Readonly<{
  text: string;
  pages: readonly ExtractedPage[];
  pageCount?: number;
  status: ExtractionStatus;
}>;

export function normalizeExtractedText(value: string): string {
  return value
    .normalize("NFC")
    .replaceAll("\u0000", "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
