export const MAX_DOCUMENT_SIZE_BYTES = 50 * 1024 * 1024;

export type DocumentExtension = "pdf" | "docx" | "txt" | "md" | "png" | "jpg";

export type ValidatedDocumentUpload = Readonly<{
  displayName: string;
  extension: DocumentExtension;
  mediaType: string;
  content: string;
  status: "Prêt" | "À indexer" | "OCR requis";
}>;

export type DocumentUploadRejection =
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "INVALID_NAME"
  | "DOUBLE_EXTENSION"
  | "UNSUPPORTED_EXTENSION"
  | "UNSAFE_CONTENT"
  | "MIME_MISMATCH"
  | "CORRUPTED_FILE";

export type DocumentUploadValidation =
  | Readonly<{ accepted: true; document: ValidatedDocumentUpload }>
  | Readonly<{ accepted: false; reason: DocumentUploadRejection }>;

const expectedMediaTypes: Readonly<Record<DocumentExtension, readonly string[]>> = {
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  txt: ["text/plain"],
  md: ["text/markdown", "text/plain"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
};

const executableSignatures = [
  [0x4d, 0x5a],
  [0x7f, 0x45, 0x4c, 0x46],
  [0x23, 0x21],
] as const;

function startsWith(bytes: Uint8Array, signature: ArrayLike<number>): boolean {
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[index] !== signature[index]) return false;
  }
  return true;
}

function endsWith(bytes: Uint8Array, signature: ArrayLike<number>): boolean {
  const offset = bytes.length - signature.length;
  if (offset < 0) return false;
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[offset + index] !== signature[index]) return false;
  }
  return true;
}

function containsAscii(bytes: Uint8Array, value: string): boolean {
  const signature = new TextEncoder().encode(value);
  return bytes.some((_, offset) => startsWith(bytes.subarray(offset), signature));
}

function isUtf8Text(bytes: Uint8Array): boolean {
  const knownBinary = [
    [0x25, 0x50, 0x44, 0x46, 0x2d],
    [0x50, 0x4b, 0x03, 0x04],
    [0x89, 0x50, 0x4e, 0x47],
    [0xff, 0xd8, 0xff],
  ];
  if (knownBinary.some((signature) => startsWith(bytes, signature))) return false;
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

function hasValidSignature(extension: DocumentExtension, bytes: Uint8Array): boolean {
  switch (extension) {
    case "pdf":
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]) && containsAscii(bytes.subarray(Math.max(0, bytes.length - 1024)), "%%EOF");
    case "docx":
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) && validateDocxArchive(bytes).valid;
    case "png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) && containsAscii(bytes, "IEND");
    case "jpg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]) && endsWith(bytes, [0xff, 0xd9]);
    case "txt":
    case "md":
      return isUtf8Text(bytes);
  }
}

function canonicalExtension(extension: string): DocumentExtension | undefined {
  if (extension === "jpeg") return "jpg";
  return ["pdf", "docx", "txt", "md", "png", "jpg"].includes(extension)
    ? (extension as DocumentExtension)
    : undefined;
}

function validateName(name: string):
  | Readonly<{ accepted: true; displayName: string; extension: DocumentExtension }>
  | Readonly<{ accepted: false; reason: DocumentUploadRejection }> {
  if (!name || name.includes("/") || name.includes("\\") || /[\u0000-\u001f\u007f]/.test(name)) {
    return { accepted: false, reason: "INVALID_NAME" };
  }

  const parts = name.normalize("NFC").split(".");
  if (parts.length !== 2 || !parts[0]) {
    return { accepted: false, reason: parts.length > 2 ? "DOUBLE_EXTENSION" : "INVALID_NAME" };
  }

  const extension = canonicalExtension(parts[1].toLowerCase());
  if (!extension) return { accepted: false, reason: "UNSUPPORTED_EXTENSION" };

  const neutralStem = parts[0]
    .replace(/[^\p{L}\p{N} _-]/gu, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  if (!neutralStem || neutralStem === "." || neutralStem === "..") {
    return { accepted: false, reason: "INVALID_NAME" };
  }

  return { accepted: true, displayName: `${neutralStem}.${extension}`, extension };
}

export function validateDocumentUpload(input: Readonly<{
  name: string;
  browserMediaType: string;
  size: number;
  bytes: Uint8Array;
}>): DocumentUploadValidation {
  if (input.size > MAX_DOCUMENT_SIZE_BYTES || input.bytes.length > MAX_DOCUMENT_SIZE_BYTES) {
    return { accepted: false, reason: "FILE_TOO_LARGE" };
  }
  if (input.size === 0 || input.bytes.length === 0) return { accepted: false, reason: "EMPTY_FILE" };

  const name = validateName(input.name);
  if (!name.accepted) return name;
  if (executableSignatures.some((signature) => startsWith(input.bytes, signature))) {
    return { accepted: false, reason: "UNSAFE_CONTENT" };
  }
  if (!expectedMediaTypes[name.extension].includes(input.browserMediaType.toLowerCase())) {
    return { accepted: false, reason: "MIME_MISMATCH" };
  }
  if (!hasValidSignature(name.extension, input.bytes)) {
    return { accepted: false, reason: "CORRUPTED_FILE" };
  }

  const textType = name.extension === "txt" || name.extension === "md";
  return {
    accepted: true,
    document: {
      displayName: name.displayName,
      extension: name.extension,
      mediaType: expectedMediaTypes[name.extension][0],
      content: textType ? new TextDecoder().decode(input.bytes).slice(0, 500_000) : "",
      status: textType ? "Prêt" : name.extension === "pdf" || name.extension === "docx" ? "À indexer" : "OCR requis",
    },
  };
}
import { validateDocxArchive } from "./docx-archive-policy";
