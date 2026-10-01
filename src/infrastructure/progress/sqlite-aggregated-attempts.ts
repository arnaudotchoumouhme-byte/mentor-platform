import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";

export type AggregatedAttempt = Readonly<{
  id: number | string;
  module: string;
  subject: string;
  score: number;
  duration_minutes: number;
  created_at: string;
  session_id: string | null;
  question_count: number | null;
}>;

export class SqliteAggregatedAttempts {
  constructor(private readonly database: SqliteExecutor) {}

  list(learnerId: string): readonly AggregatedAttempt[] {
    return this.database.all<AggregatedAttempt>(
      `SELECT a.id,a.module,a.subject,a.score,a.duration_minutes,a.created_at,NULL AS session_id,NULL AS question_count
       FROM attempts a
       JOIN learner_attempt_ownership o ON o.attempt_id=a.id
       WHERE o.learner_id=?
       UNION ALL
       SELECT 'mcq:' || s.session_id AS id,CASE s.session_kind WHEN 'MOCK_EXAM' THEN 'Examen blanc' ELSE 'QCM Partie I' END AS module,
              COALESCE((SELECT group_concat(DISTINCT m.topic_id) FROM mcq_session_items i JOIN mcq_item_mappings m ON m.item_id=i.item_id AND m.item_version=i.item_version AND m.blueprint_version_id=s.blueprint_version_id WHERE i.session_id=s.session_id),'QCM') AS subject,
              s.percentage AS score,
              CAST(MAX(0,unixepoch(s.completed_at)-unixepoch(s.started_at))/60 AS INTEGER) AS duration_minutes,
              s.completed_at AS created_at,s.session_id,s.total_count AS question_count
       FROM mcq_sessions s
       WHERE s.learner_id=? AND s.session_kind IN ('STANDARD','MOCK_EXAM') AND s.status='COMPLETED'
         AND s.completed_at IS NOT NULL AND s.percentage IS NOT NULL
       ORDER BY created_at DESC,id DESC`,
      learnerId,
      learnerId,
    );
  }
}
