import { NextResponse } from "next/server";
import { z } from "zod";
import { all } from "@/lib/db";

const schema = z.object({ query: z.string().trim().min(2), subject: z.string().optional() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Saisissez au moins deux caractères." }, { status: 400 });
  const term = `%${parsed.data.query}%`;
  const subject = parsed.data.subject;
  const rows = subject && subject !== "Toutes"
    ? all("SELECT id,name,subject,content,status FROM documents WHERE archived=0 AND subject=? AND (name LIKE ? OR content LIKE ?) LIMIT 30", subject, term, term)
    : all("SELECT id,name,subject,content,status FROM documents WHERE archived=0 AND (name LIKE ? OR content LIKE ?) LIMIT 30", term, term);
  return NextResponse.json({ results: rows });
}
