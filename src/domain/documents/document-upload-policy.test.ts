import { describe, expect, it } from "vitest";
import {
  MAX_DOCUMENT_SIZE_BYTES,
  validateDocumentUpload,
} from "./document-upload-policy";

const text = new TextEncoder().encode("Contenu pédagogique sûr.");

function validate(overrides: Partial<Parameters<typeof validateDocumentUpload>[0]> = {}) {
  return validateDocumentUpload({
    name: "cours.txt",
    browserMediaType: "text/plain",
    size: text.length,
    bytes: text,
    ...overrides,
  });
}

describe("document upload policy", () => {
  it("accepts a valid file after independent content inspection", () => {
    expect(validate()).toMatchObject({
      accepted: true,
      document: { displayName: "cours.txt", extension: "txt", status: "Prêt" },
    });
  });

  it("rejects a browser MIME inconsistent with inspected content", () => {
    expect(validate({ browserMediaType: "application/octet-stream" })).toEqual({
      accepted: false,
      reason: "MIME_MISMATCH",
    });
  });

  it("rejects unsupported extensions", () => {
    expect(validate({ name: "virus.exe" })).toEqual({
      accepted: false,
      reason: "UNSUPPORTED_EXTENSION",
    });
  });

  it("rejects double extensions", () => {
    expect(validate({ name: "cours.pdf.exe" })).toEqual({
      accepted: false,
      reason: "DOUBLE_EXTENSION",
    });
  });

  it("rejects malicious path-like names", () => {
    expect(validate({ name: "../cours.txt" })).toEqual({
      accepted: false,
      reason: "INVALID_NAME",
    });
  });

  it("rejects oversized files before content processing", () => {
    expect(validate({ size: MAX_DOCUMENT_SIZE_BYTES + 1 })).toEqual({
      accepted: false,
      reason: "FILE_TOO_LARGE",
    });
  });

  it("rejects empty files", () => {
    expect(validate({ size: 0, bytes: new Uint8Array() })).toEqual({
      accepted: false,
      reason: "EMPTY_FILE",
    });
  });

  it("rejects corrupted files whose signature does not match", () => {
    expect(
      validate({
        name: "cours.pdf",
        browserMediaType: "application/pdf",
        bytes: new TextEncoder().encode("not a pdf"),
        size: 9,
      }),
    ).toEqual({ accepted: false, reason: "CORRUPTED_FILE" });
  });

  it("rejects executable magic bytes even behind an allowed extension", () => {
    expect(validate({ bytes: new Uint8Array([0x4d, 0x5a, 0x41]), size: 3 })).toEqual({
      accepted: false,
      reason: "UNSAFE_CONTENT",
    });
  });

  it("rejects a binary signature disguised as text", () => {
    const disguisedPdf = new TextEncoder().encode("%PDF-1.4\n%%EOF");
    expect(validate({ bytes: disguisedPdf, size: disguisedPdf.length })).toEqual({
      accepted: false,
      reason: "CORRUPTED_FILE",
    });
  });

  it("neutralizes display characters without using the name as storage identity", () => {
    const result = validate({ name: "cours<script>.txt" });
    expect(result).toMatchObject({
      accepted: true,
      document: { displayName: "cours_script_.txt" },
    });
  });
});
