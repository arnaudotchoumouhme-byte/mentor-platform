import type { MentorActionCapabilities } from "@/application/actions/mentor-actions";
import type { SqliteExecutor } from "./sqlite-executor";

export class SqliteMentorActions implements MentorActionCapabilities {
  constructor(private readonly database: SqliteExecutor) {}

  async setDocumentArchived(id: number, archived: boolean): Promise<boolean> {
    const result = this.database.run(
      "UPDATE documents SET archived = ? WHERE id = ?",
      archived ? 1 : 0,
      id,
    );
    return result.changes > 0;
  }

  async deleteDocument(id: number): Promise<boolean> {
    return this.database.run("DELETE FROM documents WHERE id = ?", id).changes > 0;
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
