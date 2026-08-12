export type DocxArchiveLimits = Readonly<{
  maxEntries: number;
  maxUncompressedBytes: number;
  maxCompressionRatio: number;
}>;

export const DEFAULT_DOCX_LIMITS: DocxArchiveLimits = {
  maxEntries: 512,
  maxUncompressedBytes: 100 * 1024 * 1024,
  maxCompressionRatio: 100,
};

export type DocxArchiveValidation =
  | Readonly<{ valid: true }>
  | Readonly<{ valid: false; reason: "CORRUPTED" | "ENCRYPTED" | "UNSAFE_PATH" | "LIMIT_EXCEEDED" | "MISSING_COMPONENT" }>;

const requiredEntries = new Set([
  "[Content_Types].xml",
  "_rels/.rels",
  "word/document.xml",
]);

function u16(view: DataView, offset: number): number {
  if (offset < 0 || offset + 2 > view.byteLength) throw new RangeError();
  return view.getUint16(offset, true);
}

function u32(view: DataView, offset: number): number {
  if (offset < 0 || offset + 4 > view.byteLength) throw new RangeError();
  return view.getUint32(offset, true);
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (
      bytes[offset] === 0x50 &&
      bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x05 &&
      bytes[offset + 3] === 0x06
    ) {
      return offset;
    }
  }
  return -1;
}

function unsafeEntryPath(name: string): boolean {
  const normalized = name.replaceAll("\\", "/");
  return (
    normalized.startsWith("/") ||
    /^[a-z]:\//i.test(normalized) ||
    normalized.split("/").some((part) => part === "..")
  );
}

export function validateDocxArchive(
  bytes: Uint8Array,
  limits: DocxArchiveLimits = DEFAULT_DOCX_LIMITS,
): DocxArchiveValidation {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const endOffset = findEndOfCentralDirectory(bytes);
    if (endOffset < 0) return { valid: false, reason: "CORRUPTED" };

    const disk = u16(view, endOffset + 4);
    const centralDisk = u16(view, endOffset + 6);
    const diskEntries = u16(view, endOffset + 8);
    const entries = u16(view, endOffset + 10);
    const centralSize = u32(view, endOffset + 12);
    const centralOffset = u32(view, endOffset + 16);
    const commentLength = u16(view, endOffset + 20);
    if (
      disk !== 0 ||
      centralDisk !== 0 ||
      diskEntries !== entries ||
      entries === 0 ||
      entries > limits.maxEntries ||
      endOffset + 22 + commentLength !== bytes.length ||
      centralOffset + centralSize !== endOffset
    ) {
      return { valid: false, reason: entries > limits.maxEntries ? "LIMIT_EXCEEDED" : "CORRUPTED" };
    }

    const found = new Set<string>();
    let totalUncompressed = 0;
    let offset = centralOffset;
    for (let index = 0; index < entries; index += 1) {
      if (u32(view, offset) !== 0x02014b50) return { valid: false, reason: "CORRUPTED" };
      const flags = u16(view, offset + 8);
      if ((flags & 0x0001) !== 0) return { valid: false, reason: "ENCRYPTED" };
      const compressedSize = u32(view, offset + 20);
      const uncompressedSize = u32(view, offset + 24);
      const nameLength = u16(view, offset + 28);
      const extraLength = u16(view, offset + 30);
      const entryCommentLength = u16(view, offset + 32);
      const localOffset = u32(view, offset + 42);
      const entryEnd = offset + 46 + nameLength + extraLength + entryCommentLength;
      if (entryEnd > endOffset || u32(view, localOffset) !== 0x04034b50) {
        return { valid: false, reason: "CORRUPTED" };
      }
      const name = new TextDecoder("utf-8", { fatal: true }).decode(
        bytes.subarray(offset + 46, offset + 46 + nameLength),
      );
      if (unsafeEntryPath(name)) return { valid: false, reason: "UNSAFE_PATH" };

      totalUncompressed += uncompressedSize;
      const ratio = compressedSize === 0
        ? uncompressedSize === 0 ? 1 : Number.POSITIVE_INFINITY
        : uncompressedSize / compressedSize;
      if (
        totalUncompressed > limits.maxUncompressedBytes ||
        ratio > limits.maxCompressionRatio
      ) {
        return { valid: false, reason: "LIMIT_EXCEEDED" };
      }
      found.add(name);
      offset = entryEnd;
    }

    if (offset !== endOffset || [...requiredEntries].some((entry) => !found.has(entry))) {
      return { valid: false, reason: "MISSING_COMPONENT" };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: "CORRUPTED" };
  }
}
