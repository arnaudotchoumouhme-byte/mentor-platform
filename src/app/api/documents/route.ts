import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { run } from "@/lib/db";

const allowed = new Set(["pdf", "docx", "txt", "md", "png", "jpg", "jpeg"]);
const maxSize = 50 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData();
  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
  const subject = String(form.get("subject") || "Non classé");
  if (!files.length) return NextResponse.json({ error: "Aucun fichier sélectionné." }, { status: 400 });
  const storage = path.join(process.cwd(), "storage", "documents");
  await mkdir(storage, { recursive: true });
  const imported: string[] = [];
  const rejected: string[] = [];
  for (const file of files) {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!allowed.has(extension) || file.size > maxSize) { rejected.push(file.name); continue; }
    const bytes = Buffer.from(await file.arrayBuffer());
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    await writeFile(path.join(storage, safeName), bytes);
    const textType = extension === "txt" || extension === "md";
    const content = textType ? bytes.toString("utf8").slice(0, 500_000) : "";
    const status = textType ? "Prêt" : extension === "pdf" || extension === "docx" ? "À indexer" : "OCR requis";
    run("INSERT INTO documents (name,type,size,subject,status,content) VALUES (?,?,?,?,?,?)", file.name, extension.toUpperCase(), file.size, subject, status, content);
    imported.push(file.name);
  }
  return NextResponse.json({ imported, rejected });
}
