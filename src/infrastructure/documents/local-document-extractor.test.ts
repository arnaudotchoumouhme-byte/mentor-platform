import { describe, expect, it, vi } from "vitest";
import { syntheticDocx, syntheticEmptyPdf, syntheticPdf } from "@/test/fixtures/synthetic-documents";
import { LocalDocumentExtractor } from "./local-document-extractor";

describe("LocalDocumentExtractor", () => {
  const pdfOcr = {
    extract: vi.fn(async () => ({
      text: "",
      pages: [],
      pageCount: 1,
      status: "REQUIRES_OCR" as const,
    })),
  };
  const extractor = new LocalDocumentExtractor(pdfOcr);

  it("extracts real page text from a synthetic text PDF", async () => {
    pdfOcr.extract.mockClear();
    await expect(extractor.extract({ extension: "pdf", bytes: syntheticPdf })).resolves.toMatchObject({
      status: "COMPLETED", pageCount: 1, text: expect.stringContaining("pharmacokinetics"),
    });
    expect(pdfOcr.extract).not.toHaveBeenCalled();
  }, 15_000);

  it("extracts real main text from a synthetic DOCX", async () => {
    await expect(extractor.extract({ extension: "docx", bytes: syntheticDocx })).resolves.toMatchObject({
      status: "COMPLETED", text: expect.stringContaining("Pharmacocinétique synthétique"),
    });
  });

  it("classifies a valid PDF without text as requiring OCR", async () => {
    pdfOcr.extract.mockClear();
    await expect(extractor.extract({ extension: "pdf", bytes: syntheticEmptyPdf })).resolves.toMatchObject({
      status: "REQUIRES_OCR", pageCount: 1, text: "",
    });
    expect(pdfOcr.extract).toHaveBeenCalledOnce();
  });

  it("returns OCR text for an image-only PDF", async () => {
    const ocrExtractor = new LocalDocumentExtractor({
      extract: vi.fn(async () => ({
        text: "Texte reconnu localement",
        pages: [{ pageNumber: 1, text: "Texte reconnu localement" }],
        pageCount: 1,
        status: "COMPLETED" as const,
      })),
    });
    await expect(ocrExtractor.extract({ extension: "pdf", bytes: syntheticEmptyPdf })).resolves.toMatchObject({
      status: "COMPLETED",
      text: "Texte reconnu localement",
    });
  });

  it("returns a typed failure for a corrupted PDF", async () => {
    await expect(extractor.extract({ extension: "pdf", bytes: new TextEncoder().encode("%PDF-broken%%EOF") }))
      .rejects.toMatchObject({ code: "INGEST_PDF_EXTRACTION_FAILED" });
  });
});
