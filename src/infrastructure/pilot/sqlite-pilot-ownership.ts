import { AppError } from "@/shared/errors/app-error";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";

const denied = () => new AppError({ code: "PILOT_ACCESS_DENIED", userMessage: "Accès au pilote refusé.", category: "security" });

export class SqlitePilotOwnership {
  constructor(private readonly database: SqliteExecutor) {}
  bindMcqSession(sessionId: string, learnerId: string): void {
    const result = this.database.run("UPDATE mcq_sessions SET learner_id=? WHERE session_id=? AND learner_id IS NULL", learnerId, sessionId);
    if (result.changes !== 1) throw denied();
  }
  assertMcqSession(sessionId: string, learnerId: string): void {
    const row = this.database.all<{ learner_id: string | null }>("SELECT learner_id FROM mcq_sessions WHERE session_id=?", sessionId)[0];
    if (!row || row.learner_id !== learnerId) throw denied();
  }
  bindCoachSession(sessionId: string, learnerId: string): void {
    const result = this.database.run("INSERT INTO learner_coaching_session_ownership(session_id,learner_id) VALUES(?,?)", sessionId, learnerId);
    if (result.changes !== 1) throw denied();
  }
  assertCoachSession(sessionId: string, learnerId: string): void {
    const row = this.database.all<{ learner_id: string }>("SELECT learner_id FROM learner_coaching_session_ownership WHERE session_id=? AND learner_id=?", sessionId, learnerId)[0];
    if (!row) throw denied();
  }
}
