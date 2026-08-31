import type { MentorActionCapabilities } from "@/application/actions/mentor-actions";
import type { SqliteExecutor } from "./sqlite-executor";
import type { DocumentImportStorage } from "@/infrastructure/documents/local-document-storage";
import { AppError } from "@/shared/errors/app-error";

export class SqliteMentorActions implements MentorActionCapabilities {
  constructor(
    private readonly database: SqliteExecutor,
    private readonly documentStorage?: DocumentImportStorage,
  ) {}

  async setDocumentArchived(id: number, archived: boolean, learnerId: string): Promise<boolean> {
    const result = this.database.run(
      "UPDATE documents SET archived = ? WHERE id = ? AND EXISTS (SELECT 1 FROM learner_document_ownership o WHERE o.document_id=documents.id AND o.learner_id=?)",
      archived ? 1 : 0,
      id,
      learnerId,
    );
    return result.changes > 0;
  }

  async deleteDocument(id: number, learnerId: string): Promise<boolean> {
    const owned = this.database.all<{ document_id: number }>("SELECT document_id FROM learner_document_ownership WHERE document_id=? AND learner_id=?", id, learnerId)[0];
    if (!owned) return false;
    const source = this.database.all<{ source_id: string; storage_id: string; extension: string }>(
      "SELECT source_id,storage_id,extension FROM sources WHERE document_id=? AND status<>'DELETED' LIMIT 1",
      id,
    )[0];
    if (!source) return this.database.run("DELETE FROM documents WHERE id = ?", id).changes > 0;
    if (!this.documentStorage) throw new Error("Document storage is required to delete an imported source.");
    const editorialAlias = this.database.all<{ editorial_alias: string }>(
      `SELECT a.editorial_alias
       FROM source_version_editorial_aliases a
       JOIN source_versions v ON v.source_version_id = a.source_version_id
       WHERE v.source_id = ?
       LIMIT 1`,
      source.source_id,
    )[0];
    if (editorialAlias) {
      throw new AppError({
        code: "SOURCE_EDITORIAL_ALIAS_DELETE_RESTRICTED",
        userMessage: "La source possède un alias éditorial immuable et ne peut pas être supprimée.",
        category: "validation",
        severity: "warn",
      });
    }

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

  async scheduleCardReview(id: number, intervalDays: number, learnerId: string): Promise<boolean> {
    const result = this.database.run(
      "UPDATE flashcards SET interval_days = ?, due_at = date('now', ?), status = 'active' WHERE id = ? AND EXISTS (SELECT 1 FROM learner_flashcard_ownership o WHERE o.flashcard_id=flashcards.id AND o.learner_id=?)",
      intervalDays,
      `+${intervalDays} day`,
      id,
      learnerId,
    );
    return result.changes > 0;
  }

  async setTaskCompleted(id: number, completed: boolean, learnerId: string): Promise<boolean> {
    const result = this.database.run(
      "UPDATE study_tasks SET status = ? WHERE id = ? AND EXISTS (SELECT 1 FROM learner_study_task_ownership o WHERE o.study_task_id=study_tasks.id AND o.learner_id=?)",
      completed ? "done" : "todo",
      id,
      learnerId,
    );
    return result.changes > 0;
  }

  async resolveWeakness(id: number, learnerId: string): Promise<boolean> {
    const result = this.database.run(
      "UPDATE weaknesses SET status = 'résolue', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND EXISTS (SELECT 1 FROM learner_weakness_ownership o WHERE o.weakness_id=weaknesses.id AND o.learner_id=?)",
      id,
      learnerId,
    );
    return result.changes > 0;
  }

  async saveAttempt(input: {
    module: string;
    subject: string;
    score: number;
    minutes: number;
  }, learnerId: string): Promise<void> {
    this.database.run("BEGIN IMMEDIATE"); try { this.database.run(
      "INSERT INTO attempts (module, subject, score, duration_minutes) VALUES (?, ?, ?, ?)",
      input.module,
      input.subject,
      input.score,
      input.minutes,
    ); const id=this.database.all<{id:number}>("SELECT last_insert_rowid() AS id")[0]!.id; this.database.run("INSERT INTO learner_attempt_ownership(attempt_id,learner_id) VALUES(?,?)",id,learnerId); this.database.run("COMMIT"); } catch(error){this.database.run("ROLLBACK");throw error;}
  }

  async addFlashcard(input: {
    front: string;
    back: string;
    subject: string;
  }, learnerId: string): Promise<void> {
    this.database.run("BEGIN IMMEDIATE"); try { this.database.run(
      "INSERT INTO flashcards (front, back, subject) VALUES (?, ?, ?)",
      input.front,
      input.back,
      input.subject,
    ); const id=this.database.all<{id:number}>("SELECT last_insert_rowid() AS id")[0]!.id; this.database.run("INSERT INTO learner_flashcard_ownership(flashcard_id,learner_id) VALUES(?,?)",id,learnerId); this.database.run("COMMIT"); } catch(error){this.database.run("ROLLBACK");throw error;}
  }

  async addTask(input: {
    title: string;
    subject: string;
    date: string;
    minutes: number;
  }, learnerId: string): Promise<void> {
    this.database.run("BEGIN IMMEDIATE"); try { this.database.run(
      "INSERT INTO study_tasks (title, subject, task_date, minutes) VALUES (?, ?, ?, ?)",
      input.title,
      input.subject,
      input.date,
      input.minutes,
    ); const id=this.database.all<{id:number}>("SELECT last_insert_rowid() AS id")[0]!.id; this.database.run("INSERT INTO learner_study_task_ownership(study_task_id,learner_id) VALUES(?,?)",id,learnerId); this.database.run("COMMIT"); } catch(error){this.database.run("ROLLBACK");throw error;}
  }

  async saveSettings(
    settings: Readonly<Record<string, string>>, learnerId: string,
  ): Promise<void> {
    for (const [key, value] of Object.entries(settings)) {
      this.database.run(
        "INSERT INTO learner_settings(learner_id,key,value) VALUES (?,?,?) ON CONFLICT(learner_id,key) DO UPDATE SET value=excluded.value",
        learnerId,
        key,
        value,
      );
    }
  }
}
