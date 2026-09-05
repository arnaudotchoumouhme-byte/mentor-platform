"use client";

import { useRef, useState } from "react";
import { FileText, Search } from "lucide-react";
import { useAppState } from "@/hooks/use-state";
import { EmptyState, Loading, PageHeader } from "@/components/ui";
import { ClientRequestError, clientFetch } from "@/shared/api/client-fetch";

type Result = { id: number; name: string; subject: string; content: string; status: string };
type Failure = { message: string; traceId?: string };

export default function SearchPage() {
  const { data } = useAppState();
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("Toutes");
  const [results, setResults] = useState<Result[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const requestInFlight = useRef(false);

  if (!data) return <Loading />;

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setFailure(null);
    try {
      const response = await clientFetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, subject }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFailure({
          message: body.error?.message ?? body.message ?? "Recherche impossible. Réessayez.",
          traceId: body.error?.traceId ?? response.headers.get("x-trace-id") ?? undefined,
        });
        return;
      }
      setResults(body.results ?? []);
      setSearched(true);
    } catch (error) {
      setFailure({
        message: error instanceof ClientRequestError && error.code === "NET_REQUEST_TIMEOUT"
          ? "La recherche a expiré. Réessayez."
          : "Le serveur est injoignable. Vérifiez votre connexion puis réessayez.",
        traceId: error instanceof ClientRequestError ? error.traceId : undefined,
      });
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  return <div className="mx-auto max-w-5xl">
    <PageHeader eyebrow="FEAT-003 · Recherche textuelle" title="Recherche documentaire" description="Retrouvez un passage dans l’ensemble de votre bibliothèque active." />
    <form onSubmit={search} className="card mb-7 grid gap-3 p-5 md:grid-cols-[1fr_220px_auto]">
      <label><span className="sr-only">Termes recherchés</span><input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex. biodisponibilité, bêtabloquants..." minLength={2} required disabled={busy} aria-describedby={failure ? "search-error" : undefined} /></label>
      <label><span className="sr-only">Matière</span><select className="field" value={subject} onChange={(event) => setSubject(event.target.value)} disabled={busy}><option>Toutes</option>{data.subjects.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
      <button className="btn btn-primary" disabled={busy}><Search size={17} />{busy ? "Recherche…" : "Rechercher"}</button>
    </form>
    {failure && <div id="search-error" role="alert" className="mb-5 rounded-xl border border-[var(--danger)] p-4"><p className="m-0 font-bold">{failure.message}</p>{failure.traceId && <p className="mb-0 mt-2 text-xs">Référence : {failure.traceId}</p>}</div>}
    {searched && !results.length ? <EmptyState title="Aucun passage trouvé" detail="Essayez un autre terme ou élargissez la matière sélectionnée." /> : <div className="space-y-4">{results.map((result) => <article className="card p-5" key={result.id}><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2 font-black"><FileText size={17} className="text-[var(--primary)]" />{result.name}</div><span className="badge">{result.subject}</span></div><p className="mb-0 text-sm leading-6 text-[var(--muted-foreground)]">{result.content ? result.content.slice(0, 420) : "Le contenu de ce format n’est pas encore indexé. Lancez l’indexation depuis la bibliothèque."}</p></article>)}</div>}
  </div>;
}
