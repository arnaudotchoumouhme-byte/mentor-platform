"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Archive, FileText, RotateCcw, Search, Trash2, Upload } from "lucide-react";
import { useAppState } from "@/hooks/use-state";
import { EmptyState, Loading, Notice, PageHeader } from "@/components/ui";
import { ClientRequestError, clientFetch } from "@/shared/api/client-fetch";

type UploadFeedback = { kind: "success" | "error"; message: string; traceId?: string };

export default function LibraryPage() {
  const { data, refresh, act } = useAppState();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("Toutes");
  const [feedback, setFeedback] = useState<UploadFeedback | null>(null);
  const [uploading, setUploading] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const uploadInFlight = useRef(false);
  const refreshInFlight = useRef(false);
  if (!data) return <Loading />;
  const filtered = data.documents.filter((doc) =>
    (subject === "Toutes" || doc.subject === subject) && doc.name.toLowerCase().includes(query.toLowerCase()));

  async function upload(files: FileList | null) {
    if (!files?.length || uploadInFlight.current) return;
    uploadInFlight.current = true;
    setUploading(true);
    setFeedback(null);
    setRefreshFailed(false);
    try {
      let result;
      try {
        const form = new FormData();
        Array.from(files).forEach((file) => form.append("files", file));
        form.set("subject", subject === "Toutes" ? "Non classé" : subject);
        const response = await clientFetch("/api/documents", { method: "POST", body: form });
        result = await response.json().catch(() => ({}));
        if (!response.ok) {
          setFeedback({ kind: "error", message: result.error?.message ?? result.message ?? "Import impossible. Réessayez.", traceId: result.error?.traceId ?? response.headers.get("x-trace-id") ?? undefined });
          return;
        }
      } catch (error) {
        setFeedback({
          kind: "error",
          message: error instanceof ClientRequestError && error.code === "NET_REQUEST_TIMEOUT" ? "L’import a expiré. Réessayez." : "Le serveur est injoignable. Vérifiez votre connexion puis réessayez.",
          traceId: error instanceof ClientRequestError ? error.traceId : undefined,
        });
        return;
      }
      const ocr = result.documents?.filter((item: { status: string }) => item.status === "REQUIRES_OCR").length ?? 0;
      setFeedback({ kind: "success", message: `${result.imported?.length ?? 0} document(s) importé(s)${ocr ? `, ${ocr} nécessitent un OCR` : ""}${result.rejected?.length ? `, ${result.rejected.length} refusé(s)` : ""}.` });
      try {
        await refresh();
      } catch {
        setRefreshFailed(true);
      }
    } finally {
      uploadInFlight.current = false;
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  async function retryRefresh() {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      await refresh();
      setRefreshFailed(false);
    } catch {
      setRefreshFailed(true);
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }

  return <div className="mx-auto max-w-7xl">
    <PageHeader eyebrow="FEAT-001 · Local et privé" title="Bibliothèque" description="Importez, extrayez et consultez vos ressources personnelles."
      action={<><input ref={input} className="hidden" type="file" multiple accept=".pdf,.docx,.txt,.md" onChange={(event) => void upload(event.target.files)} disabled={uploading} /><button className="btn btn-primary" onClick={() => input.current?.click()} disabled={uploading}><Upload size={17} />{uploading ? "Import en cours…" : "Importer"}</button></>} />
    {feedback && <div className="mb-5" role={feedback.kind === "error" ? "alert" : "status"}><Notice success={feedback.kind === "success"}>{feedback.message}{feedback.traceId && <span className="mt-2 block text-xs">Référence : {feedback.traceId}</span>}</Notice></div>}
    {refreshFailed && <div className="mb-5" role="alert"><Notice>L’import a réussi, mais la liste n’a pas pu être actualisée. <button type="button" className="btn btn-ghost mt-3" onClick={() => void retryRefresh()} disabled={refreshing}>{refreshing ? "Actualisation…" : "Rafraîchir la bibliothèque"}</button></Notice></div>}
    <div className="card mb-5 grid gap-3 p-4 md:grid-cols-[1fr_240px_auto]">
      <label><span className="sr-only">Rechercher</span><span className="relative block"><Search className="absolute left-3 top-3 text-[var(--muted-foreground)]" size={17} /><input className="field pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un document..." /></span></label>
      <label><span className="sr-only">Matière</span><select className="field" value={subject} onChange={(event) => setSubject(event.target.value)}><option>Toutes</option>{data.subjects.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
      <span className="badge self-center justify-self-start md:justify-self-end">{filtered.length} ressources</span>
    </div>
    {!filtered.length ? <EmptyState title="Aucun document" detail="Modifiez les filtres ou importez votre première ressource." /> :
      <div className="card overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted-foreground)]"><th className="p-4">Document</th><th className="p-4">Matière</th><th className="p-4">Statut</th><th className="p-4">Provenance</th><th className="p-4">Taille</th><th className="p-4 text-right">Actions</th></tr></thead>
        <tbody>{filtered.map((doc) => <tr key={doc.id} className={`border-b border-[var(--border)] last:border-0 ${doc.archived ? "opacity-55" : ""}`}>
          <td className="p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent)] text-[var(--primary)]"><FileText size={18} /></span><div><Link className="font-black hover:text-[var(--primary)]" href={`/library/${doc.id}`}>{doc.name}</Link><div className="text-xs text-[var(--muted-foreground)]">{doc.type} · {new Date(doc.created_at).toLocaleDateString("fr-CA")}</div></div></div></td>
          <td className="p-4">{doc.subject}</td><td className="p-4"><span className="badge">{doc.extraction_status === "REQUIRES_OCR" ? "OCR requis" : doc.status}</span></td><td className="p-4"><span className="badge">{doc.provenance_type}</span></td><td className="p-4">{(doc.size / 1024 / 1024).toFixed(1)} Mo</td>
          <td className="p-4"><div className="flex justify-end gap-1"><button className="btn btn-ghost px-2" title={doc.archived ? "Restaurer" : "Archiver"} onClick={() => void act({ action: "archiveDocument", id: doc.id, archived: !doc.archived })}>{doc.archived ? <RotateCcw size={17} /> : <Archive size={17} />}</button><button className="btn btn-ghost px-2 text-[var(--danger)]" title="Supprimer" onClick={() => confirm(`Supprimer ${doc.name} ?`) && void act({ action: "deleteDocument", id: doc.id })}><Trash2 size={17} /></button></div></td>
        </tr>)}</tbody></table></div>}
  </div>;
}
