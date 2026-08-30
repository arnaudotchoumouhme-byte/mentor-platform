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
    learnerId: string,
  ): Promise<void> {
    this.database.run("BEGIN IMMEDIATE");
    try { this.database.run(
      "INSERT INTO conversations(role,content,citations) VALUES (?,?,?)",
      message.role,
      message.content,
      message.citations,
    ); const id=this.database.all<{id:number}>("SELECT last_insert_rowid() AS id")[0]!.id; this.database.run("INSERT INTO learner_conversation_ownership(conversation_id,learner_id) VALUES(?,?)",id,learnerId); this.database.run("COMMIT"); }
    catch(error){this.database.run("ROLLBACK");throw error;}
  }
}
