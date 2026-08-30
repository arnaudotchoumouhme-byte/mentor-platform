import { describe, expect, it, vi } from "vitest";
import { SqliteMentorActions } from "./sqlite-mentor-actions";
import type { SqliteExecutor } from "./sqlite-executor";

function createDatabase() {
  return {
    all: vi.fn(() => []),
    run: vi.fn(() => ({ changes: 1 })),
  } satisfies SqliteExecutor;
}

describe("SqliteMentorActions", () => {
  it("converts booleans and binds document parameters", async () => {
    const database = createDatabase();
    const adapter = new SqliteMentorActions(database);
    await adapter.setDocumentArchived(7, true, "learner-a");
    await adapter.setDocumentArchived(8, false, "learner-a");
    expect(database.run).toHaveBeenNthCalledWith(
      1,
      "UPDATE documents SET archived = ? WHERE id = ? AND EXISTS (SELECT 1 FROM learner_document_ownership o WHERE o.document_id=documents.id AND o.learner_id=?)",
      1,
      7,
      "learner-a",
    );
    expect(database.run).toHaveBeenNthCalledWith(
      2,
      "UPDATE documents SET archived = ? WHERE id = ? AND EXISTS (SELECT 1 FROM learner_document_ownership o WHERE o.document_id=documents.id AND o.learner_id=?)",
      0,
      8,
      "learner-a",
    );
  });

  it("binds review interval values without SQL concatenation", async () => {
    const database = createDatabase();
    const adapter = new SqliteMentorActions(database);
    await adapter.scheduleCardReview(3, 8, "learner-a");
    expect(database.run).toHaveBeenCalledWith(
      "UPDATE flashcards SET interval_days = ?, due_at = date('now', ?), status = 'active' WHERE id = ? AND EXISTS (SELECT 1 FROM learner_flashcard_ownership o WHERE o.flashcard_id=flashcards.id AND o.learner_id=?)",
      8,
      "+8 day",
      3,
      "learner-a",
    );
  });

  it("persists every setting through bound parameters", async () => {
    const database = createDatabase();
    const adapter = new SqliteMentorActions(database);
    await adapter.saveSettings({ language: "fr", theme: "clair" }, "learner-a");
    expect(database.run).toHaveBeenCalledTimes(2);
    expect(database.run).toHaveBeenCalledWith(
      "INSERT INTO learner_settings(learner_id,key,value) VALUES (?,?,?) ON CONFLICT(learner_id,key) DO UPDATE SET value=excluded.value",
      "learner-a",
      "language",
      "fr",
    );
  });

  it("propagates database failures to the application boundary", async () => {
    const database = createDatabase();
    database.all.mockImplementation(() => {
      throw new Error("database unavailable");
    });
    const adapter = new SqliteMentorActions(database);
    await expect(adapter.deleteDocument(2, "learner-a")).rejects.toThrow("database unavailable");
  });

  it("reports whether a targeted resource exists", async () => {
    const database = createDatabase();
    database.run.mockReturnValueOnce({ changes: 0 });
    const adapter = new SqliteMentorActions(database);
    await expect(adapter.deleteDocument(404, "learner-a")).resolves.toBe(false);
  });

  it("deletes an imported file and all derived source metadata in one controlled operation", async () => {
    const database = createDatabase();
    database.all
      .mockReturnValueOnce([{ document_id: 7 }] as never[])
      .mockReturnValueOnce([{ source_id: "source-id", storage_id: "123e4567-e89b-42d3-a456-426614174000", extension: "pdf" }] as never[])
      .mockReturnValueOnce([]);
    const storage = {
      writeTemporary: vi.fn(), promote: vi.fn(), remove: vi.fn(), exists: vi.fn(), list: vi.fn(),
    };
    await expect(new SqliteMentorActions(database, storage).deleteDocument(7, "learner-a")).resolves.toBe(true);
    expect(storage.remove).toHaveBeenCalledWith("final", { id: "123e4567-e89b-42d3-a456-426614174000", extension: "pdf" });
    expect(database.run).toHaveBeenCalledWith("DELETE FROM source_versions WHERE source_id=?", "source-id");
    expect(database.run).toHaveBeenCalledWith("DELETE FROM documents WHERE id=?", 7);
    expect(database.run).toHaveBeenLastCalledWith("COMMIT");
  });

  it("rejects deletion of an aliased source before removing its stored file", async () => {
    const database = createDatabase();
    database.all
      .mockReturnValueOnce([{ document_id: 7 }] as never[])
      .mockReturnValueOnce([{ source_id: "source-id", storage_id: "123e4567-e89b-42d3-a456-426614174000", extension: "pdf" }] as never[])
      .mockReturnValueOnce([{ editorial_alias: "SNC-COURS-2026-04-28/V1" }] as never[]);
    const storage = {
      writeTemporary: vi.fn(), promote: vi.fn(), remove: vi.fn(), exists: vi.fn(), list: vi.fn(),
    };

    await expect(new SqliteMentorActions(database, storage).deleteDocument(7, "learner-a")).rejects.toMatchObject({
      code: "SOURCE_EDITORIAL_ALIAS_DELETE_RESTRICTED",
    });
    expect(storage.remove).not.toHaveBeenCalled();
    expect(database.run).not.toHaveBeenCalled();
  });
});
