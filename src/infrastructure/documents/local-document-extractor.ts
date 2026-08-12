import "server-only";
import type { DocumentExtractorPort } from "@/application/documents/document-extractor-port";
import {
  normalizeExtractedText,
  type ExtractedDocumentContent,
} from "@/domain/documents/extracted-content";
import { AppError } from "@/shared/errors/app-error";

const EXTRACTION_TIMEOUT_MS = 15_000;

function withTimeout<T>(operation: Promise<T>, code: string): Promise<T> {
  return Promise.race([
    operation,
    new Promise<never>((_, reject) => {
      const timer = setTimeout(
        () => reject(new AppError({
          code,
          category: "filesystem",
          severity: "warn",
          userMessage: "L’extraction du document a dépassé la durée autorisée.",
        })),
        EXTRACTION_TIMEOUT_MS,
      );
      timer.unref();
    }),
  ]);
}

async function extractPdf(bytes: Uint8Array): Promise<ExtractedDocumentContent> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    stopAtErrors: true,
    useSystemFonts: false,
  });
  try {
    const pdf = await task.promise;
    const pages: Array<{ pageNumber: number; text: string }> = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = normalizeExtractedText(
        content.items
          .map((item) => ("str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : ""))
          .join(""),
      );
      pages.push({ pageNumber, text });
      page.cleanup();
    }
    const text = normalizeExtractedText(pages.map((page) => page.text).join("\n\n"));
    return {
      text,
      pages,
      pageCount: pdf.numPages,
      status: text ? "COMPLETED" : "REQUIRES_OCR",
    };
  } catch (cause) {
    throw new AppError({
      code: "INGEST_PDF_EXTRACTION_FAILED",
      category: "filesystem",
      severity: "warn",
      userMessage: "Le PDF est corrompu, protégé ou impossible à extraire.",
      cause,
    });
  } finally {
    await task.destroy();
  }
}

async function extractDocx(bytes: Uint8Array): Promise<ExtractedDocumentContent> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    const text = normalizeExtractedText(result.value);
    if (!text) {
      throw new AppError({
        code: "INGEST_NO_TEXT_FOUND",
        category: "filesystem",
        severity: "warn",
        userMessage: "Le document DOCX ne contient aucun texte exploitable.",
      });
    }
    return { text, pages: [], status: "COMPLETED" };
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    throw new AppError({
      code: "INGEST_DOCX_EXTRACTION_FAILED",
      category: "filesystem",
      severity: "warn",
      userMessage: "Le document DOCX est corrompu ou impossible à extraire.",
      cause,
    });
  }
}

export class LocalDocumentExtractor implements DocumentExtractorPort {
  async extract(input: Parameters<DocumentExtractorPort["extract"]>[0]): Promise<ExtractedDocumentContent> {
    switch (input.extension) {
      case "pdf":
        return withTimeout(extractPdf(input.bytes), "INGEST_PDF_EXTRACTION_TIMEOUT");
      case "docx":
        return withTimeout(extractDocx(input.bytes), "INGEST_DOCX_EXTRACTION_TIMEOUT");
      case "txt":
      case "md": {
        const text = normalizeExtractedText(new TextDecoder("utf-8", { fatal: true }).decode(input.bytes));
        if (!text) throw new AppError({
          code: "INGEST_NO_TEXT_FOUND",
          category: "validation",
          severity: "warn",
          userMessage: "Le document ne contient aucun texte exploitable.",
        });
        return { text, pages: [], status: "COMPLETED" };
      }
      case "png":
      case "jpg":
        return { text: "", pages: [], status: "REQUIRES_OCR" };
    }
  }
}
