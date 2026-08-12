import { describe, expect, it } from "vitest";
import { syntheticDocx, syntheticEmptyPdf, syntheticPdf } from "@/test/fixtures/synthetic-documents";
import { LocalDocumentExtractor } from "./local-document-extractor";

describe("LocalDocumentExtractor", () => {
  const extractor = new LocalDocumentExtractor();

  it("extracts real page text from a synthetic text PDF", async () => {
    await expect(extractor.extract({ extension: "pdf", bytes: syntheticPdf })).resolves.toMatchObject({
      status: "COMPLETED", pageCount: 1, text: expect.stringContaining("pharmacokinetics"),
    });
  }, 15_000);

  it("extracts real main text from a synthetic DOCX", async () => {
    await expect(extractor.extract({ extension: "docx", bytes: syntheticDocx })).resolves.toMatchObject({
      status: "COMPLETED", text: expect.stringContaining("Pharmacocinétique synthétique"),
    });
  });

  it("classifies a valid PDF without text as requiring OCR", async () => {
    await expect(extractor.extract({ extension: "pdf", bytes: syntheticEmptyPdf })).resolves.toMatchObject({
      status: "REQUIRES_OCR", pageCount: 1, text: "",
    });
  });

  it("returns a typed failure for a corrupted PDF", async () => {
    await expect(extractor.extract({ extension: "pdf", bytes: new TextEncoder().encode("%PDF-broken%%EOF") }))
      .rejects.toMatchObject({ code: "INGEST_PDF_EXTRACTION_FAILED" });
  });
});
