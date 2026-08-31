import { describe, expect, it, vi } from "vitest";
import type { SqliteDocumentRecord } from "../records/document-record";
import { SqliteDocumentKnowledge } from "./sqlite-document-knowledge";
import type { SqliteExecutor } from "./sqlite-executor";

function createDatabase(records: SqliteDocumentRecord[] = []) {
  return {
    all: vi.fn(() => records) as unknown as SqliteExecutor["all"],
    run: vi.fn(() => ({ changes: 1 })),
  } satisfies SqliteExecutor;
}

describe("SqliteDocumentKnowledge", () => {
  it("maps searchable rows and keeps the query free of interpolation", async () => {
    const database = createDatabase([
      { id: 4, name: "Cours", content: "Contenu", archived: 0 },
    ]);
    const adapter = new SqliteDocumentKnowledge(database);

    await expect(adapter.listSearchableDocuments()).resolves.toEqual([
      { id: 4, name: "Cours", content: "Contenu", archived: false },
    ]);
    expect(database.all).toHaveBeenCalledWith(
      "SELECT id, name, content, archived FROM documents WHERE archived=0 AND content <> '' ORDER BY id ASC",
    );
  });

  it("returns an empty collection when no record is present", async () => {
    const adapter = new SqliteDocumentKnowledge(createDatabase());
    await expect(adapter.listSearchableDocuments()).resolves.toEqual([]);
  });

  it("persists conversation fields as bound parameters", async () => {
    const database = createDatabase();
    vi.mocked(database.all).mockReturnValueOnce([{ id: 9 }] as never[]);
    const adapter = new SqliteDocumentKnowledge(database);
    await adapter.saveConversationMessage({ role: "user", content: "Question", citations: "[]" }, "learner-a");
    expect(database.run).toHaveBeenCalledWith(
      "INSERT INTO conversations(role,content,citations) VALUES (?,?,?)",
      "user",
      "Question",
      "[]",
    );
    expect(database.run).toHaveBeenCalledWith("INSERT INTO learner_conversation_ownership(conversation_id,learner_id) VALUES(?,?)", 9, "learner-a");
  });

  it("propagates controlled database failures", async () => {
    const database = createDatabase();
    database.run.mockImplementation(() => {
      throw new Error("database unavailable");
    });
    const adapter = new SqliteDocumentKnowledge(database);
    await expect(
      adapter.saveConversationMessage({ role: "user", content: "Question", citations: "[]" }, "learner-a"),
    ).rejects.toThrow("database unavailable");
  });
});
