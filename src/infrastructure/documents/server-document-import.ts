import "server-only";

import { ImportDocuments } from "@/application/documents/import-documents";
import { sqliteExecutor } from "@/infrastructure/database/sqlite/server-sqlite-executor";
import { LocalDocumentStorage } from "./local-document-storage";
import { NodeDocumentIdGenerator } from "./node-document-id-generator";
import { CrashSafeDocumentImport } from "./crash-safe-document-import";

const storage = new LocalDocumentStorage();

export const importDocuments = new ImportDocuments(
  new NodeDocumentIdGenerator(),
  new CrashSafeDocumentImport(sqliteExecutor, storage),
);
