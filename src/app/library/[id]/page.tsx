import Link from "next/link";
import { notFound } from "next/navigation";
import { SqliteLibrarySources } from "@/infrastructure/database/sqlite/sqlite-library-sources";
import { sqliteExecutor } from "@/infrastructure/database/sqlite/server-sqlite-executor";

export const dynamic = "force-dynamic";

export default async function LibraryDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const document = Number.isSafeInteger(id) ? new SqliteLibrarySources(sqliteExecutor).getByDocumentId(id) : null;
  if (!document) notFound();
  const preview = document.content.slice(0, 4_000);
  return <div className="mx-auto max-w-4xl space-y-5">
    <Link className="text-sm font-bold text-[var(--primary)]" href="/library">← Retour à la bibliothèque</Link>
    <section className="card p-6">
      <p className="text-xs font-black uppercase tracking-widest text-[var(--primary)]">Fiche documentaire</p>
      <h1 className="mt-2 text-3xl font-black">{document.name}</h1>
      <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
        <div><dt className="text-[var(--muted-foreground)]">Format</dt><dd className="font-bold">{document.type}</dd></div>
        <div><dt className="text-[var(--muted-foreground)]">Taille</dt><dd className="font-bold">{(document.size / 1024).toFixed(1)} Ko</dd></div>
        <div><dt className="text-[var(--muted-foreground)]">Statut</dt><dd className="font-bold">{document.status}</dd></div>
        <div><dt className="text-[var(--muted-foreground)]">Extraction</dt><dd className="font-bold">{document.extraction_status}</dd></div>
        <div><dt className="text-[var(--muted-foreground)]">Provenance</dt><dd className="font-bold">{document.provenance_type}</dd></div>
        <div><dt className="text-[var(--muted-foreground)]">Importé le</dt><dd className="font-bold">{new Date(document.created_at).toLocaleString("fr-CA")}</dd></div>
      </dl>
    </section>
    <section className="card p-6"><h2 className="text-xl font-black">Aperçu du texte extrait</h2>
      <pre className="mt-4 whitespace-pre-wrap break-words font-sans text-sm leading-6">{preview || "Aucun texte extrait. Une reconnaissance OCR peut être nécessaire."}</pre>
    </section>
  </div>;
}
