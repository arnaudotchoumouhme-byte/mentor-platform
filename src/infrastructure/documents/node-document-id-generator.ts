import { randomUUID } from "node:crypto";
import type { DocumentIdGeneratorPort } from "@/application/documents/import-documents";

export class NodeDocumentIdGenerator implements DocumentIdGeneratorPort {
  generate(): string {
    return randomUUID();
  }
}
