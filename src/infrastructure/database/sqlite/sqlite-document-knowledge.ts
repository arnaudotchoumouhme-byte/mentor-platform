import type {
  ConversationMessage,
  DocumentKnowledgePort,
} from "@/application/ai/document-knowledge-port";
import type { Document } from "@/domain/documents/document";
import { toDocument } from "../mappers/document-mapper";
import type { SqliteDocumentRecord } from "../records/document-record";
import type { SqliteExecutor } from "./sqlite-executor";

export class SqliteDocumentKnowledge implements DocumentKnowledgePort {
  constructor(private readonly database: SqliteExecutor) {}

  async listSearchableDocuments(): Promise<readonly Document[]> {
    return this.database.all<SqliteDocumentRecord>(
      "SELECT id, name, content, archived FROM documents WHERE archived=0 AND content <> '' ORDER BY id ASC",
    ).map(toDocument);
  }

  async saveConversationMessage(
    message: ConversationMessage,
  ): Promise<void> {
    this.database.run(
      "INSERT INTO conversations(role,content,citations) VALUES (?,?,?)",
      message.role,
      message.content,
      message.citations,
    );
  }
}
