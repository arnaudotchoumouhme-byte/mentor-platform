import "server-only";
import { createHash } from "node:crypto";
import type { DocumentChecksumPort } from "@/application/documents/document-extractor-port";

export class NodeDocumentChecksum implements DocumentChecksumPort {
  sha256(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex");
  }
}
