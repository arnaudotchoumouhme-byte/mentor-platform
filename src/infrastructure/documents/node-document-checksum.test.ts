import { describe, expect, it } from "vitest";
import { NodeDocumentChecksum } from "./node-document-checksum";

describe("NodeDocumentChecksum", () => {
  it("calcule un SHA-256 stable", () => {
    expect(new NodeDocumentChecksum().sha256(new TextEncoder().encode("mentor"))).toBe(
      "d9d771df57e86d113220244726d7c795611a3583075927d292a4b159b24a5e4d",
    );
  });
});
