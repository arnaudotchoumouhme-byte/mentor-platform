import { describe, expect, it } from "vitest";
import { validateDocxArchive } from "./docx-archive-policy";

type ZipEntry = Readonly<{
  name: string;
  flags?: number;
  compressedSize?: number;
  uncompressedSize?: number;
}>;

const required: ZipEntry[] = [
  { name: "[Content_Types].xml" },
  { name: "_rels/.rels" },
  { name: "word/document.xml" },
];

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function zip(entries: readonly ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = new Uint8Array(entry.compressedSize ?? 1);
    const compressedSize = data.length;
    const uncompressedSize = entry.uncompressedSize ?? compressedSize;
    const local = new Uint8Array(30 + name.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, entry.flags ?? 0, true);
    localView.setUint32(18, compressedSize, true);
    localView.setUint32(22, uncompressedSize, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, entry.flags ?? 0, true);
    centralView.setUint32(20, compressedSize, true);
    centralView.setUint32(24, uncompressedSize, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, localOffset, true);
    central.set(name, 46);
    centrals.push(central);
    localOffset += local.length;
  }

  const central = concat(centrals);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, central.length, true);
  endView.setUint32(16, localOffset, true);
  return concat([...locals, central, end]);
}

describe("DOCX archive policy", () => {
  it("accepts a structurally valid DOCX archive", () => {
    expect(validateDocxArchive(zip(required))).toEqual({ valid: true });
  });

  it("rejects a ZIP that is not a DOCX", () => {
    expect(validateDocxArchive(zip([{ name: "file.txt" }]))).toEqual({
      valid: false,
      reason: "MISSING_COMPONENT",
    });
  });

  it("rejects a corrupted archive", () => {
    expect(validateDocxArchive(zip(required).subarray(0, 20))).toEqual({
      valid: false,
      reason: "CORRUPTED",
    });
  });

  it("requires word/document.xml", () => {
    expect(validateDocxArchive(zip(required.slice(0, 2)))).toEqual({
      valid: false,
      reason: "MISSING_COMPONENT",
    });
  });

  it("rejects path traversal entries", () => {
    expect(validateDocxArchive(zip([...required, { name: "../escape.xml" }]))).toEqual({
      valid: false,
      reason: "UNSAFE_PATH",
    });
  });

  it("rejects too many entries with a reduced test limit", () => {
    expect(
      validateDocxArchive(zip(required), {
        maxEntries: 2,
        maxUncompressedBytes: 1_000,
        maxCompressionRatio: 100,
      }),
    ).toEqual({ valid: false, reason: "LIMIT_EXCEEDED" });
  });

  it("rejects excessive uncompressed size", () => {
    expect(
      validateDocxArchive(zip([{ ...required[0], uncompressedSize: 200 }, ...required.slice(1)]), {
        maxEntries: 10,
        maxUncompressedBytes: 100,
        maxCompressionRatio: 1_000,
      }),
    ).toEqual({ valid: false, reason: "LIMIT_EXCEEDED" });
  });

  it("rejects an abnormal compression ratio", () => {
    expect(
      validateDocxArchive(zip([{ ...required[0], compressedSize: 1, uncompressedSize: 200 }, ...required.slice(1)]), {
        maxEntries: 10,
        maxUncompressedBytes: 1_000,
        maxCompressionRatio: 10,
      }),
    ).toEqual({ valid: false, reason: "LIMIT_EXCEEDED" });
  });

  it("rejects encrypted entries", () => {
    expect(validateDocxArchive(zip([{ ...required[0], flags: 1 }, ...required.slice(1)]))).toEqual({
      valid: false,
      reason: "ENCRYPTED",
    });
  });
});
