import { NextResponse } from "next/server";
import type { PilotIdentity } from "@/application/pilot/pilot-core";
import { sqliteExecutor } from "@/infrastructure/database/sqlite/server-sqlite-executor";
import { SqliteLibrarySources } from "@/infrastructure/database/sqlite/sqlite-library-sources";
import { apiErrorResponse } from "@/infrastructure/observability/api-boundary";
import { all } from "@/lib/db";
import { resolveTraceId } from "@/shared/observability/trace-id";

export const dynamic = "force-dynamic";

export function createStateGet(identity: () => Promise<PilotIdentity>) {
  return async (request: Request = new Request("http://localhost/api/state")) => {
    const traceId = resolveTraceId(request.headers.get("x-trace-id"));
    try {
      const caller = await identity();
      const library = new SqliteLibrarySources(sqliteExecutor);
      const [subjects, documents, flashcards, questions, attempts, weaknesses, tasks, messages, settings] = [
        all("SELECT * FROM subjects ORDER BY name"), library.list(caller.learnerId), all("SELECT f.* FROM flashcards f JOIN learner_flashcard_ownership o ON o.flashcard_id=f.id WHERE o.learner_id=? ORDER BY f.due_at", caller.learnerId), all("SELECT * FROM questions ORDER BY id"), all("SELECT a.* FROM attempts a JOIN learner_attempt_ownership o ON o.attempt_id=a.id WHERE o.learner_id=? ORDER BY a.created_at DESC", caller.learnerId), all("SELECT w.* FROM weaknesses w JOIN learner_weakness_ownership o ON o.weakness_id=w.id WHERE o.learner_id=? ORDER BY w.status,w.confidence DESC", caller.learnerId), all("SELECT t.* FROM study_tasks t JOIN learner_study_task_ownership o ON o.study_task_id=t.id WHERE o.learner_id=? ORDER BY t.task_date,t.priority", caller.learnerId), all("SELECT c.* FROM conversations c JOIN learner_conversation_ownership o ON o.conversation_id=c.id WHERE o.learner_id=? ORDER BY c.id DESC LIMIT 30", caller.learnerId).reverse(), all<{ key: string; value: string }>("SELECT key,value FROM learner_settings WHERE learner_id=?", caller.learnerId),
      ];
      return NextResponse.json({ subjects, documents, flashcards, questions, attempts, weaknesses, tasks, messages, settings: Object.fromEntries(settings.map(item => [item.key, item.value])) }, { headers: { "x-trace-id": traceId, "cache-control": "no-store" } });
    } catch (error) {
      return apiErrorResponse(error, { traceId, module: "state", operation: "state.load" });
    }
  };
}

export const GET = createStateGet(async () => (await import("@/infrastructure/pilot/server-pilot")).requirePilotIdentity());
