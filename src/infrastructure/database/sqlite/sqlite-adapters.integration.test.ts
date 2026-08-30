import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { SqliteDocumentKnowledge } from "./sqlite-document-knowledge";
import type { SqliteExecutor } from "./sqlite-executor";
import { SqliteMentorActions } from "./sqlite-mentor-actions";

describe("SQLite adapters with an isolated in-memory database", () => {
  let database: DatabaseSync;
  let executor: SqliteExecutor;

  beforeEach(() => {
    database = new DatabaseSync(":memory:");
    database.exec(`
      CREATE TABLE documents (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        citations TEXT NOT NULL
      );
      CREATE TABLE learner_document_ownership (
        document_id INTEGER PRIMARY KEY,
        learner_id TEXT NOT NULL
      );
      CREATE TABLE learner_conversation_ownership (
        conversation_id INTEGER PRIMARY KEY,
        learner_id TEXT NOT NULL
      );
    `);
    executor = {
      all: <T>(sql: string, ...params: SQLInputValue[]) =>
        database.prepare(sql).all(...params) as T[],
      run: (sql: string, ...params: SQLInputValue[]) =>
        database.prepare(sql).run(...params),
    };
  });

  afterEach(() => database.close());

  it("returns multiple searchable documents in deterministic id order", async () => {
    database.exec(`
      INSERT INTO documents(id,name,content,archived) VALUES
        (3, 'Troisième', 'C', 0),
        (1, 'Premier', 'A', 0),
        (2, 'Archivé', 'B', 1),
        (4, 'Vide', '', 0);
    `);
    const adapter = new SqliteDocumentKnowledge(executor);

    await expect(adapter.listSearchableDocuments()).resolves.toEqual([
      { id: 1, name: "Premier", content: "A", archived: false },
      { id: 3, name: "Troisième", content: "C", archived: false },
    ]);
  });

  it("returns an empty collection when no searchable document exists", async () => {
    const adapter = new SqliteDocumentKnowledge(executor);
    await expect(adapter.listSearchableDocuments()).resolves.toEqual([]);
  });

  it("distinguishes a found mutation from an absent resource", async () => {
    database.exec("INSERT INTO documents(id,name,content,archived) VALUES (1,'Cours','Texte',0)");
    database.exec("INSERT INTO learner_document_ownership(document_id,learner_id) VALUES (1,'learner-a')");
    const adapter = new SqliteMentorActions(executor);

    await expect(adapter.setDocumentArchived(1, true, "learner-a")).resolves.toBe(true);
    await expect(adapter.setDocumentArchived(404, true, "learner-a")).resolves.toBe(false);
    expect(
      database.prepare("SELECT archived FROM documents WHERE id = 1").get(),
    ).toEqual({ archived: 1 });
  });

  it("persists messages only inside the disposable database", async () => {
    const adapter = new SqliteDocumentKnowledge(executor);
    await adapter.saveConversationMessage({
      role: "assistant",
      content: "Réponse",
      citations: "[]",
    }, "learner-a");
    expect(database.prepare("SELECT role,content,citations FROM conversations").all()).toEqual([
      { role: "assistant", content: "Réponse", citations: "[]" },
    ]);
    expect(database.prepare("SELECT learner_id FROM learner_conversation_ownership").get()).toEqual({ learner_id: "learner-a" });
  });
});
