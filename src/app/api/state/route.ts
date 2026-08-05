import { NextResponse } from "next/server";
import { all } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [subjects, documents, flashcards, questions, attempts, weaknesses, tasks, messages, settings] = [
    all("SELECT * FROM subjects ORDER BY name"),
    all("SELECT * FROM documents ORDER BY archived, created_at DESC"),
    all("SELECT * FROM flashcards ORDER BY due_at"),
    all("SELECT * FROM questions ORDER BY id"),
    all("SELECT * FROM attempts ORDER BY created_at DESC"),
    all("SELECT * FROM weaknesses ORDER BY status, confidence DESC"),
    all("SELECT * FROM study_tasks ORDER BY task_date, priority"),
    all("SELECT * FROM conversations ORDER BY id DESC LIMIT 30").reverse(),
    all<{ key: string; value: string }>("SELECT * FROM settings"),
  ];
  return NextResponse.json({
    subjects, documents, flashcards, questions, attempts, weaknesses, tasks, messages,
    settings: Object.fromEntries(settings.map((item) => [item.key, item.value])),
  });
}
