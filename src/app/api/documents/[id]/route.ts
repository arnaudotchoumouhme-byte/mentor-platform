import { NextResponse } from "next/server";
import { SqliteLibrarySources } from "@/infrastructure/database/sqlite/sqlite-library-sources";
import { sqliteExecutor } from "@/infrastructure/database/sqlite/server-sqlite-executor";

export const dynamic = "force-dynamic";
const library = new SqliteLibrarySources(sqliteExecutor);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  const document = library.getByDocumentId(id);
  return document
    ? NextResponse.json(document)
    : NextResponse.json({ error: "Document introuvable" }, { status: 404 });
}
