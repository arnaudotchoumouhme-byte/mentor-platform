import type { MentorActionCapabilities } from "@/application/actions/mentor-actions";
import type { SqliteExecutor } from "./sqlite-executor";
import type { DocumentImportStorage } from "@/infrastructure/documents/local-document-storage";

export class SqliteMentorActions implements MentorActionCapabilities {
  constructor(
    private readonly database: SqliteExecutor,
    private readonly documentStorage?: DocumentImportStorage,
  ) {}

  async setDocumentArchived(id: number, archived: boolean): Promise<boolean> {
    const result = this.database.run(
      "UPDATE documents SET archived = ? WHERE id = ?",
      archived ? 1 : 0,
      id,
    );
    return result.changes > 0;
  }

  async deleteDocument(id: number): Promise<boolean> {
    const source = this.database.all<{ source_id: string; storage_id: string; extension: string }>(
      "SELECT source_id,storage_id,extension FROM sources WHERE document_id=? AND status<>'DELETED' LIMIT 1",
      id,
    )[0];
    if (!source) return this.database.run("DELETE FROM documents WHERE id = ?", id).changes > 0;
    if (!this.documentStorage) throw new Error("Document storage is required to delete an imported source.");

    this.database.run("BEGIN IMMEDIATE");
    try {
      await this.documentStorage.remove("final", { id: source.storage_id, extension: source.extension });
      const chunks = this.database.all<{ chunk_id: string }>(
        "SELECT chunk_id FROM document_chunks WHERE source_id=?",
        source.source_id,
      );
      for (const chunk of chunks) {
        this.database.run("DELETE FROM document_chunks_fts WHERE chunk_id=?", chunk.chunk_id);
      }
      this.database.run("DELETE FROM document_chunks WHERE source_id=?", source.source_id);
      this.database.run("DELETE FROM source_versions WHERE source_id=?", source.source_id);
      this.database.run("DELETE FROM document_import_journal WHERE source_id=?", source.source_id);
      this.database.run("DELETE FROM sources WHERE source_id=?", source.source_id);
      const result = this.database.run("DELETE FROM documents WHERE id=?", id);
      this.database.run("COMMIT");
      return result.changes > 0;
    } catch (error) {
      this.database.run("ROLLBACK");
      throw error;
    }
  }

  async scheduleCardReview(id: number, intervalDays: number): Promise<boolean> {
    const result = this.database.run(
      "UPDATE flashcards SET interval_days = ?, due_at = date('now', ?), status = 'active' WHERE id = ?",
      intervalDays,
      `+${intervalDays} day`,
      id,
    );
    return result.changes > 0;
  }

  async setTaskCompleted(id: number, completed: boolean): Promise<boolean> {
    const result = this.database.run(
      "UPDATE study_tasks SET status = ? WHERE id = ?",
      completed ? "done" : "todo",
      id,
    );
    return result.changes > 0;
  }

  async resolveWeakness(id: number): Promise<boolean> {
    const result = this.database.run(
      "UPDATE weaknesses SET status = 'résolue', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      id,
    );
    return result.changes > 0;
  }

  async saveAttempt(input: {
    module: string;
    subject: string;
    score: number;
    minutes: number;
  }): Promise<void> {
    this.database.run(
      "INSERT INTO attempts (module, subject, score, duration_minutes) VALUES (?, ?, ?, ?)",
      input.module,
      input.subject,
      input.score,
      input.minutes,
    );
  }

  async addFlashcard(input: {
    front: string;
    back: string;
    subject: string;
  }): Promise<void> {
    this.database.run(
      "INSERT INTO flashcards (front, back, subject) VALUES (?, ?, ?)",
      input.front,
      input.back,
      input.subject,
    );
  }

  async addTask(input: {
    title: string;
    subject: string;
    date: string;
    minutes: number;
  }): Promise<void> {
    this.database.run(
      "INSERT INTO study_tasks (title, subject, task_date, minutes) VALUES (?, ?, ?, ?)",
      input.title,
      input.subject,
      input.date,
      input.minutes,
    );
  }

  async saveSettings(
    settings: Readonly<Record<string, string>>,
  ): Promise<void> {
    for (const [key, value] of Object.entries(settings)) {
      this.database.run(
        "INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        key,
        value,
      );
    }
  }
}
