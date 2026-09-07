import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";

export type AggregatedAttempt = Readonly<{
  id: number | string;
  module: string;
  subject: string;
  score: number;
  duration_minutes: number;
  created_at: string;
}>;

export class SqliteAggregatedAttempts {
  constructor(private readonly database: SqliteExecutor) {}

  list(learnerId: string): readonly AggregatedAttempt[] {
    return this.database.all<AggregatedAttempt>(
      `SELECT a.id,a.module,a.subject,a.score,a.duration_minutes,a.created_at
       FROM attempts a
       JOIN learner_attempt_ownership o ON o.attempt_id=a.id
       WHERE o.learner_id=?
       UNION ALL
       SELECT 'mcq:' || s.session_id AS id,'Examen blanc' AS module,'QCM' AS subject,
              s.percentage AS score,
              CAST(MAX(0,unixepoch(s.completed_at)-unixepoch(s.started_at))/60 AS INTEGER) AS duration_minutes,
              s.completed_at AS created_at
       FROM mcq_sessions s
       WHERE s.learner_id=? AND s.session_kind='MOCK_EXAM' AND s.status='COMPLETED'
         AND s.completed_at IS NOT NULL AND s.percentage IS NOT NULL
       ORDER BY created_at DESC,id DESC`,
      learnerId,
      learnerId,
    );
  }
}
