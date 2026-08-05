"use client";

import { useRef, useState } from "react";
import { Archive, FileText, RotateCcw, Search, Trash2, Upload } from "lucide-react";
import { useAppState } from "@/hooks/use-state";
import { EmptyState, Loading, Notice, PageHeader } from "@/components/ui";

export default function LibraryPage() {
  const { data, refresh, act } = useAppState(); const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(""); const [subject, setSubject] = useState("Toutes"); const [message, setMessage] = useState("");
  if (!data) return <Loading/>;
  const filtered = data.documents.filter((doc) => (subject === "Toutes" || doc.subject === subject) && doc.name.toLowerCase().includes(query.toLowerCase()));
  async function upload(files: FileList | null) {
    if (!files?.length) return; const form = new FormData(); Array.from(files).forEach((file) => form.append("files", file)); form.set("subject", subject === "Toutes" ? "Non classé" : subject);
    const response = await fetch("/api/documents", { method: "POST", body: form }); const result = await response.json();
    setMessage(`${result.imported?.length ?? 0} document(s) importé(s)${result.rejected?.length ? `, ${result.rejected.length} refusé(s)` : ""}.`); await refresh();
  }
  return <div className="mx-auto max-w-7xl"><PageHeader eyebrow="FEAT-001 · Local et privé" title="Bibliothèque" description="Importez, classez et suivez l’indexation de vos ressources personnelles." action={<><input ref={input} className="hidden" type="file" multiple accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg" onChange={(event)=>upload(event.target.files)}/><button className="btn btn-primary" onClick={()=>input.current?.click()}><Upload size={17}/>Importer</button></>}/>
    {message && <div className="mb-5"><Notice success>{message}</Notice></div>}
    <div className="card mb-5 grid gap-3 p-4 md:grid-cols-[1fr_240px_auto]"><label><span className="sr-only">Rechercher</span><span className="relative block"><Search className="absolute left-3 top-3 text-[var(--muted-foreground)]" size={17}/><input className="field pl-10" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher un document..."/></span></label><label><span className="sr-only">Matière</span><select className="field" value={subject} onChange={e=>setSubject(e.target.value)}><option>Toutes</option>{data.subjects.map(item=><option key={item.id}>{item.name}</option>)}</select></label><span className="badge self-center justify-self-start md:justify-self-end">{filtered.length} ressources</span></div>
    {!filtered.length ? <EmptyState title="Aucun document" detail="Modifiez les filtres ou importez votre première ressource."/> : <div className="card overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted-foreground)]"><th className="p-4">Document</th><th className="p-4">Matière</th><th className="p-4">Statut</th><th className="p-4">Taille</th><th className="p-4 text-right">Actions</th></tr></thead><tbody>{filtered.map(doc=><tr key={doc.id} className={`border-b border-[var(--border)] last:border-0 ${doc.archived ? "opacity-55" : ""}`}><td className="p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent)] text-[var(--primary)]"><FileText size={18}/></span><div><div className="font-black">{doc.name}</div><div className="text-xs text-[var(--muted-foreground)]">{doc.type} · {new Date(doc.created_at).toLocaleDateString("fr-CA")}</div></div></div></td><td className="p-4">{doc.subject}</td><td className="p-4"><span className="badge">{doc.status}</span></td><td className="p-4">{(doc.size/1024/1024).toFixed(1)} Mo</td><td className="p-4"><div className="flex justify-end gap-1"><button className="btn btn-ghost px-2" title={doc.archived?"Restaurer":"Archiver"} onClick={()=>act({action:"archiveDocument",id:doc.id,archived:!doc.archived})}>{doc.archived?<RotateCcw size={17}/>:<Archive size={17}/>}</button><button className="btn btn-ghost px-2 text-[var(--danger)]" title="Supprimer" onClick={()=>confirm(`Supprimer ${doc.name}?`)&&act({action:"deleteDocument",id:doc.id})}><Trash2 size={17}/></button></div></td></tr>)}</tbody></table></div>}
  </div>;
}
