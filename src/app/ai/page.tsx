"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { BookOpen, Send, ShieldCheck, Sparkles } from "lucide-react";
import { useAppState } from "@/hooks/use-state";
import { Loading, Notice, PageHeader } from "@/components/ui";
import { ClientRequestError, clientFetch } from "@/shared/api/client-fetch";

type Citation = Readonly<{ documentId: number; document: string; excerpt: string; pageStart: number | null; pageEnd: number | null; sectionTitle: string | null; retrievalScore: number }>;
type CoachResult = Readonly<{ session: { sessionId: string; currentStep: string; hintLevel: number; status: string }; step: { message: string; question: string | null; expectedLearnerAction: string }; evidenceStatus?: string; conflicts?: readonly unknown[] }>;
type RequestFailure = Readonly<{ message: string; traceId?: string }>;

async function responseFailure(response: Response, fallback: string): Promise<RequestFailure> {
  const payload = await response.json().catch(() => ({})) as { error?: { message?: string; traceId?: string }; message?: string };
  return {
    message: payload.error?.message ?? payload.message ?? fallback,
    traceId: payload.error?.traceId ?? response.headers.get("x-trace-id") ?? undefined,
  };
}

function requestFailure(error: unknown, fallback: string): RequestFailure {
  if (error instanceof ClientRequestError) return {
    message: error.code === "NET_REQUEST_TIMEOUT" ? "La requête a expiré. Réessayez." : fallback,
    traceId: error.traceId,
  };
  return { message: fallback };
}

export default function AiPage() {
  const { data, refresh } = useAppState();
  const [experience, setExperience] = useState<"coach" | "library">("coach");
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState("Explication");
  const [coachMode, setCoachMode] = useState("CLINICAL_PHARMACIST");
  const [coach, setCoach] = useState<CoachResult | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<RequestFailure | null>(null);
  const [result, setResult] = useState<{ answer: string; citations: Citation[]; support: string } | null>(null);
  const requestInFlight = useRef(false);
  if (!data) return <Loading />;

  async function requestCoach(body: object) {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setFailure(null);
    try {
      const response = await clientFetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) { setFailure(await responseFailure(response, "Session Coach indisponible.")); return; }
      const payload = await response.json() as CoachResult;
      setCoach(payload); setAnswer("");
    } catch (error) {
      setFailure(requestFailure(error, "Le Coach est injoignable. Vérifiez votre connexion puis réessayez."));
    } finally { requestInFlight.current = false; setBusy(false); }
  }

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true); setFailure(null);
    try {
      const response = await clientFetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, mode }) });
      if (!response.ok) { setFailure(await responseFailure(response, "Question documentaire impossible.")); return; }
      setResult(await response.json()); setQuestion(""); await refresh();
    } catch (error) {
      setFailure(requestFailure(error, "Le service documentaire est injoignable. Vérifiez votre connexion puis réessayez."));
    } finally { requestInFlight.current = false; setBusy(false); }
  }

  return <div className="mx-auto max-w-6xl">
    <PageHeader eyebrow="LOT 4 · Raisonnement clinique guidé" title="Pharmacien Coach clinique" description="Entraînez-vous sur des cas entièrement synthétiques, avec sécurité médicamenteuse, preuves documentaires et teach-back." />
    <div className="mb-5 flex gap-2"><button disabled={busy} className={`btn ${experience === "coach" ? "btn-primary" : "btn-secondary"}`} onClick={() => setExperience("coach")}>Coach clinique</button><button disabled={busy} className={`btn ${experience === "library" ? "btn-primary" : "btn-secondary"}`} onClick={() => setExperience("library")}>Question à la bibliothèque</button></div>
    {failure && <div id="coach-error" role="alert" className="mb-5"><Notice>{failure.message}{failure.traceId && <span className="mt-2 block text-xs">Référence : {failure.traceId}</span>}</Notice></div>}
    {experience === "coach" ? <div className="grid gap-6 xl:grid-cols-[1fr_310px]">
      <section className="space-y-5">
        <div className="card p-5"><div className="mb-3 flex flex-wrap gap-2">{[["CLINICAL_PHARMACIST","Pharmacien clinique"],["SOCRATIC","Socratique"],["PROFESSOR","Pédagogue"],["TEACH_BACK","Teach-back"],["RAPID_REVIEW","Révision rapide"]].map(([value,label]) => <button type="button" key={value} disabled={busy} onClick={() => setCoachMode(value)} className={`btn py-2 text-xs ${coachMode === value ? "btn-primary" : "btn-secondary"}`}>{label}</button>)}</div><button disabled={busy} aria-describedby={failure ? "coach-error" : undefined} className="btn btn-primary" onClick={() => void requestCoach({ action: "start", mode: coachMode, learningObjective: "Identifier et prioriser les risques médicamenteux du cas synthétique", language: "fr", learnerLevel: "INTERMEDIATE" })}><ShieldCheck size={16}/>{busy ? "Préparation..." : "Commencer un cas synthétique"}</button></div>
        {coach && <article className="card p-6"><div className="mb-3 flex flex-wrap gap-2"><span className="badge">Étape {coach.session.currentStep}</span><span className="badge">Preuves {coach.evidenceStatus?.toLowerCase() ?? "chargées"}</span><span className="badge">Indice {coach.session.hintLevel}/4</span></div><p className="text-sm text-[var(--muted-foreground)]">{coach.step.message}</p><h2>{coach.step.question}</h2><p>{coach.step.expectedLearnerAction}</p>{coach.session.status === "ACTIVE" && <form onSubmit={(event) => { event.preventDefault(); void requestCoach({ action: "answer", sessionId: coach.session.sessionId, answer, durationMs: 0 }); }}><label><span className="sr-only">Votre raisonnement</span><textarea className="field min-h-28" value={answer} onChange={(event) => setAnswer(event.target.value)} minLength={1} maxLength={4000} required disabled={busy} aria-describedby={failure ? "coach-error" : undefined} placeholder="Structurez votre analyse clinique..."/></label><button disabled={busy} className="btn btn-primary mt-3"><Send size={16}/>{busy ? "Envoi…" : "Soumettre mon raisonnement"}</button></form>}</article>}
      </section><aside className="space-y-4"><Notice>Exercice éducatif uniquement. Aucun patient réel ni conseil thérapeutique individualisé. En l’absence de preuve suffisante, le Coach le signale explicitement.</Notice><div className="card p-5"><h3 className="mt-0">Boucle pédagogique</h3><p className="text-sm text-[var(--muted-foreground)]">Cas → analyse → sécurité → justification → teach-back → transfert.</p></div></aside>
    </div> : <div className="grid gap-6 xl:grid-cols-[1fr_310px]">
      <section><div className="card mb-5 p-5"><form onSubmit={ask}><div className="mb-3 flex flex-wrap gap-2">{["Explication","Simplification","Comparaison","Analogie","Mode socratique","Résumé"].map((item) => <button type="button" key={item} disabled={busy} onClick={() => setMode(item)} className={`btn py-2 text-xs ${mode === item ? "btn-primary" : "btn-secondary"}`}>{item}</button>)}</div><label><span className="sr-only">Question à la bibliothèque</span><textarea className="field min-h-28" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Que souhaitez-vous comprendre?" minLength={3} required disabled={busy} aria-describedby={failure ? "coach-error" : undefined}/></label><button disabled={busy} className="btn btn-primary mt-3"><Send size={16}/>{busy ? "Recherche..." : "Envoyer"}</button></form></div>{result && <article className="card p-6"><h2 className="flex items-center gap-2"><Sparkles/>Réponse</h2><p className="whitespace-pre-line">{result.answer}</p>{result.citations.map((citation, index) => <div key={`${citation.documentId}-${index}`} className="mt-3 rounded-xl bg-[var(--accent)] p-4"><strong>[{index + 1}] <Link className="underline" href={`/library/${citation.documentId}`}>{citation.document}</Link></strong><p className="text-sm">{citation.excerpt}</p></div>)}</article>}</section><aside><Notice><BookOpen className="mb-2"/>Les réponses documentaires restent limitées aux sources de la bibliothèque.</Notice></aside>
    </div>}
  </div>;
}
