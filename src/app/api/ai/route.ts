import { NextResponse } from "next/server";
import { z } from "zod";
import { all, run } from "@/lib/db";
import type { DocumentRecord } from "@/lib/domain";

const schema = z.object({ question: z.string().trim().min(3), mode: z.string().default("Explication") });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "La question doit être précisée." }, { status: 400 });
  const words = parsed.data.question.toLowerCase().split(/\W+/).filter((word) => word.length > 3);
  const documents = all<DocumentRecord>("SELECT * FROM documents WHERE archived=0 AND content <> ''");
  const ranked = documents.map((doc) => ({ doc, score: words.reduce((n, word) => n + (doc.content.toLowerCase().includes(word) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score);
  const sources = ranked.filter((item) => item.score > 0).slice(0, 3);
  const citations = sources.map(({ doc }) => ({ document: doc.name, excerpt: doc.content.slice(0, 220) }));
  const answer = sources.length
    ? `${parsed.data.mode} fondée sur votre bibliothèque : ${sources.map(({ doc }) => doc.content).join(" ").slice(0, 900)}\n\nÀ retenir : vérifiez toujours le contexte clinique et la version de la source.`
    : "Je n’ai trouvé aucun passage suffisamment pertinent dans la bibliothèque active. Essayez une formulation plus précise ou importez une source sur ce thème.";
  run("INSERT INTO conversations(role,content,citations) VALUES ('user',?,'[]')", parsed.data.question);
  run("INSERT INTO conversations(role,content,citations) VALUES ('assistant',?,?)", answer, JSON.stringify(citations));
  return NextResponse.json({ answer, citations, support: sources.length ? "Documentaire" : "Insuffisant", provider: "Moteur local" });
}
