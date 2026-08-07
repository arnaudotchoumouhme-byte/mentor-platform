import type { Document } from "@/domain/documents/document";

export type ConversationMessage = Readonly<{
  role: "user" | "assistant";
  content: string;
  citations: string;
}>;

export interface DocumentKnowledgePort {
  listSearchableDocuments(): Promise<readonly Document[]>;
  saveConversationMessage(message: ConversationMessage): Promise<void>;
}
