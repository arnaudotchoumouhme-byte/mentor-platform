import { NextResponse } from "next/server";
import { z } from "zod";
import { nextInterval } from "@/lib/domain";
import { run } from "@/lib/db";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("archiveDocument"), id: z.number(), archived: z.boolean() }),
  z.object({ action: z.literal("deleteDocument"), id: z.number() }),
  z.object({ action: z.literal("reviewCard"), id: z.number(), rating: z.string(), interval: z.number() }),
  z.object({ action: z.literal("completeTask"), id: z.number(), completed: z.boolean() }),
  z.object({ action: z.literal("resolveWeakness"), id: z.number() }),
  z.object({ action: z.literal("saveAttempt"), module: z.string(), subject: z.string(), score: z.number().min(0).max(100), minutes: z.number().min(0) }),
  z.object({ action: z.literal("addFlashcard"), front: z.string().min(2), back: z.string().min(2), subject: z.string().min(1) }),
  z.object({ action: z.literal("addTask"), title: z.string().min(2), subject: z.string(), date: z.string(), minutes: z.number().min(5).max(480) }),
  z.object({ action: z.literal("saveSettings"), settings: z.record(z.string(), z.string()) }),
]);

export async function POST(request: Request) {
  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 400 });
  const value = parsed.data;
  switch (value.action) {
    case "archiveDocument": run("UPDATE documents SET archived = ? WHERE id = ?", value.archived ? 1 : 0, value.id); break;
    case "deleteDocument": run("DELETE FROM documents WHERE id = ?", value.id); break;
    case "reviewCard": {
      const days = nextInterval(value.rating, value.interval);
      run("UPDATE flashcards SET interval_days = ?, due_at = date('now', ?), status = 'active' WHERE id = ?", days, `+${days} day`, value.id);
      break;
    }
    case "completeTask": run("UPDATE study_tasks SET status = ? WHERE id = ?", value.completed ? "done" : "todo", value.id); break;
    case "resolveWeakness": run("UPDATE weaknesses SET status = 'résolue', updated_at = CURRENT_TIMESTAMP WHERE id = ?", value.id); break;
    case "saveAttempt": run("INSERT INTO attempts (module, subject, score, duration_minutes) VALUES (?, ?, ?, ?)", value.module, value.subject, value.score, value.minutes); break;
    case "addFlashcard": run("INSERT INTO flashcards (front, back, subject) VALUES (?, ?, ?)", value.front, value.back, value.subject); break;
    case "addTask": run("INSERT INTO study_tasks (title, subject, task_date, minutes) VALUES (?, ?, ?, ?)", value.title, value.subject, value.date, value.minutes); break;
    case "saveSettings": for (const [key, setting] of Object.entries(value.settings)) run("INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", key, setting); break;
  }
  return NextResponse.json({ success: true });
}
