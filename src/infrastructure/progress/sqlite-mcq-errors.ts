import type { McqHistoricalError } from "@/application/mcq/mcq-history";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";

export class SqliteMcqErrors {
  constructor(private readonly database: SqliteExecutor) {}

  list(learnerId: string): readonly McqHistoricalError[] {
    return this.database.all<McqHistoricalError>(
      `SELECT s.session_id AS sessionId,a.item_id AS itemId,a.item_version AS itemVersion,
        i.position,a.answered_at AS answeredAt,v.stem AS question,
        UPPER(a.choice_id) || '. ' || COALESCE((SELECT json_extract(c.value,'$.text') FROM json_each(v.choices_json) c WHERE json_extract(c.value,'$.id')=a.choice_id),a.choice_id) AS chosenAnswer,
        UPPER(v.correct_choice_id) || '. ' || COALESCE((SELECT json_extract(c.value,'$.text') FROM json_each(v.choices_json) c WHERE json_extract(c.value,'$.id')=v.correct_choice_id),v.correct_choice_id) AS correctAnswer,
        COALESCE((SELECT group_concat(DISTINCT m.topic_id) FROM mcq_item_mappings m WHERE m.item_id=a.item_id AND m.item_version=a.item_version AND m.blueprint_version_id=s.blueprint_version_id),'QCM Partie I') AS topic
       FROM mcq_answers a
       JOIN mcq_sessions s ON s.session_id=a.session_id
       JOIN mcq_session_items i ON i.session_id=a.session_id AND i.item_id=a.item_id AND i.item_version=a.item_version
       JOIN mcq_question_versions v ON v.item_id=a.item_id AND v.version=a.item_version
       WHERE s.learner_id=? AND s.status='COMPLETED' AND s.session_kind IN ('STANDARD','MOCK_EXAM') AND a.correct=0
       ORDER BY a.answered_at DESC,s.session_id,i.position`, learnerId,
    );
  }
}
