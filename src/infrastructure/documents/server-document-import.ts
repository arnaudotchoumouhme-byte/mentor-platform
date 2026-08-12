import "server-only";

import { ImportDocuments } from "@/application/documents/import-documents";
import { sqliteExecutor } from "@/infrastructure/database/sqlite/server-sqlite-executor";
import { LocalDocumentStorage } from "./local-document-storage";
import { NodeDocumentIdGenerator } from "./node-document-id-generator";
import { CrashSafeDocumentImport } from "./crash-safe-document-import";
import { LocalDocumentExtractor } from "./local-document-extractor";
import { NodeDocumentChecksum } from "./node-document-checksum";
import { structuredLogger } from "@/infrastructure/observability/structured-logger";

const storage = new LocalDocumentStorage();

export const importDocuments = new ImportDocuments(
  new NodeDocumentIdGenerator(),
  new CrashSafeDocumentImport(sqliteExecutor, storage),
  new LocalDocumentExtractor(),
  new NodeDocumentChecksum(),
  {
    event(event) {
      structuredLogger.log({
        level: event.status === "failure" ? "error" : event.status === "degraded" ? "warn" : "info",
        module: "document-ingestion",
        operation: event.name,
        status: event.status,
        message: event.name,
        traceId: event.traceId,
        errorCode: event.errorCode,
        context: event.context,
      });
    },
  },
);
