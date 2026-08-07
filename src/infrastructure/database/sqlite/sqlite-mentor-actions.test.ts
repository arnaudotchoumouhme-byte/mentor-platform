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
    await adapter.setDocumentArchived(7, true);
    await adapter.setDocumentArchived(8, false);
    expect(database.run).toHaveBeenNthCalledWith(
      1,
      "UPDATE documents SET archived = ? WHERE id = ?",
      1,
      7,
    );
    expect(database.run).toHaveBeenNthCalledWith(
      2,
      "UPDATE documents SET archived = ? WHERE id = ?",
      0,
      8,
    );
  });

  it("binds review interval values without SQL concatenation", async () => {
    const database = createDatabase();
    const adapter = new SqliteMentorActions(database);
    await adapter.scheduleCardReview(3, 8);
    expect(database.run).toHaveBeenCalledWith(
      "UPDATE flashcards SET interval_days = ?, due_at = date('now', ?), status = 'active' WHERE id = ?",
      8,
      "+8 day",
      3,
    );
  });

  it("persists every setting through bound parameters", async () => {
    const database = createDatabase();
    const adapter = new SqliteMentorActions(database);
    await adapter.saveSettings({ language: "fr", theme: "clair" });
    expect(database.run).toHaveBeenCalledTimes(2);
    expect(database.run).toHaveBeenCalledWith(
      "INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      "language",
      "fr",
    );
  });

  it("propagates database failures to the application boundary", async () => {
    const database = createDatabase();
    database.run.mockImplementation(() => {
      throw new Error("database unavailable");
    });
    const adapter = new SqliteMentorActions(database);
    await expect(adapter.deleteDocument(2)).rejects.toThrow("database unavailable");
  });

  it("reports whether a targeted resource exists", async () => {
    const database = createDatabase();
    database.run.mockReturnValueOnce({ changes: 0 });
    const adapter = new SqliteMentorActions(database);
    await expect(adapter.deleteDocument(404)).resolves.toBe(false);
  });
});
