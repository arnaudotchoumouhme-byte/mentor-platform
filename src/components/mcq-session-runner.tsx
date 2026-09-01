"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { clientFetch } from "@/shared/api/client-fetch";

type Blueprint = Readonly<{ blueprintVersionId: string; itemCount: number }>;
type PlayableItem = Readonly<{ itemId: string; itemVersion: number; position: number; stem: string; choices: readonly Readonly<{ id: string; text: string }>[]; difficulty: string; answer: null | Readonly<{ choiceId: string; correct: boolean; correctChoiceId: string; explanation: string }> }>;
type PlayableSession = Readonly<{ sessionId: string; status: "IN_PROGRESS" | "COMPLETED"; items: readonly PlayableItem[]; score: null | Readonly<{ percentage: number; correct: number; total: number }> }>;
type Failure = Readonly<{ error?: Readonly<{ code?: string; traceId?: string }> }>;
type RunnerError = Readonly<{ code: string; traceId: string | null; retry: "CATALOG" | "RETURN" }>;

async function body<T>(response: Response): Promise<T> { return response.json() as Promise<T>; }

export function McqSessionRunner() {
  const [blueprints, setBlueprints] = useState<readonly Blueprint[] | null>(null);
  const [session, setSession] = useState<PlayableSession | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<RunnerError | null>(null);
  const [busy, setBusy] = useState(false);
  const operationInFlight = useRef(false);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const loadCatalog = useCallback(async () => {
    setError(null); setBlueprints(null);
    try {
      const response = await clientFetch("/api/mcq/sessions", { cache: "no-store" });
      if (!response.ok) {
        const failure = await body<Failure>(response);
        setError({ code: failure.error?.code ?? `HTTP_${response.status}`, traceId: failure.error?.traceId ?? response.headers.get("x-trace-id"), retry: "CATALOG" });
        setBlueprints([]); return;
      }
      setBlueprints((await body<{ blueprints: readonly Blueprint[] }>(response)).blueprints);
    } catch { setError({ code: "NET_REQUEST_FAILED", traceId: null, retry: "CATALOG" }); setBlueprints([]); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void loadCatalog(), 0); return () => window.clearTimeout(timer); }, [loadCatalog]);
  useEffect(() => { if (session?.items[index]?.answer) feedbackRef.current?.focus(); }, [session, index]);

  async function fail(response: Response) {
    const failure: Failure = await body<Failure>(response).catch(() => ({}));
    setError({ code: failure.error?.code ?? `HTTP_${response.status}`, traceId: failure.error?.traceId ?? response.headers.get("x-trace-id"), retry: "RETURN" });
  }

  async function start() {
    const blueprint = blueprints?.[0]; if (!blueprint || operationInFlight.current) return;
    operationInFlight.current = true; setBusy(true); setError(null);
    try {
      const created = await clientFetch("/api/mcq/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "STUDY", count: Math.min(5, blueprint.itemCount), seed: crypto.randomUUID(), blueprintVersionId: blueprint.blueprintVersionId }) });
      if (!created.ok) return void await fail(created);
      const { sessionId } = await body<{ sessionId: string }>(created);
      const loaded = await clientFetch(`/api/mcq/sessions/${sessionId}`, { cache: "no-store" });
      if (!loaded.ok) return void await fail(loaded);
      setSession(await body<PlayableSession>(loaded)); setIndex(0);
    } catch { setError({ code: "NET_REQUEST_FAILED", traceId: null, retry: "RETURN" }); }
    finally { operationInFlight.current = false; setBusy(false); }
  }

  async function answer(choiceId: string) {
    const current = session?.items[index]; if (!session || !current || current.answer || operationInFlight.current) return;
    operationInFlight.current = true; setBusy(true);
    try {
      const response = await clientFetch(`/api/mcq/sessions/${session.sessionId}/answers`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId: current.itemId, itemVersion: current.itemVersion, choiceId }) });
      if (!response.ok) return void await fail(response);
      setSession(await body<PlayableSession>(response));
    } catch { setError({ code: "NET_REQUEST_FAILED", traceId: null, retry: "RETURN" }); }
    finally { operationInFlight.current = false; setBusy(false); }
  }

  async function complete() {
    if (!session || operationInFlight.current) return;
    operationInFlight.current = true; setBusy(true);
    try {
      const response = await clientFetch(`/api/mcq/sessions/${session.sessionId}/complete`, { method: "POST" });
      if (!response.ok) return void await fail(response);
      const result = await body<{ score: PlayableSession["score"] }>(response);
      setSession({ ...session, status: "COMPLETED", score: result.score });
    } catch { setError({ code: "NET_REQUEST_FAILED", traceId: null, retry: "RETURN" }); }
    finally { operationInFlight.current = false; setBusy(false); }
  }

  if (blueprints === null) return <div className="card p-8" role="status">Chargement du corpus QCM…</div>;
  if (error) return <div className="card p-8" role="alert"><strong>Le QCM est indisponible.</strong><p className="text-sm text-[var(--muted-foreground)]">Code : {error.code}{error.traceId ? ` · traceId : ${error.traceId}` : ""}</p><button className="btn btn-primary" onClick={() => error.retry === "CATALOG" ? void loadCatalog() : setError(null)}>{error.retry === "CATALOG" ? "Réessayer" : "Retour au QCM"}</button></div>;
  if (!blueprints.length) return <div className="card p-8">Aucune question disponible.</div>;
  if (!session) return <div className="card p-8"><h3 className="mt-0">Corpus QCM versionné</h3><p>{blueprints.reduce((sum, value) => sum + value.itemCount, 0)} question(s) publiée(s) disponible(s).</p><button className="btn btn-primary" disabled={busy} onClick={start}>Commencer</button></div>;
  if (session.status === "COMPLETED") return <div className="card p-8 text-center"><CheckCircle2 size={46} className="mx-auto text-[var(--primary)]"/><div className="mt-4 text-5xl font-black text-[var(--primary)]">{session.score?.percentage ?? 0}%</div><h2>Session terminée</h2><p>{session.score?.correct ?? 0} bonne(s) réponse(s) sur {session.score?.total ?? session.items.length}.</p><button className="btn btn-primary" onClick={() => { setSession(null); setIndex(0); }}><RotateCcw size={16}/>Nouvelle session</button></div>;
  const current = session.items[index]!;
  return <div className="card p-6 md:p-8"><div className="mb-6 flex justify-between"><span className="badge">Question {index + 1}/{session.items.length}</span><span className="badge">{current.difficulty}</span></div><div className="progress mb-7" role="progressbar" aria-label="Progression dans la session" aria-valuemin={1} aria-valuemax={session.items.length} aria-valuenow={index + 1}><span style={{ width: `${((index + 1) / session.items.length) * 100}%` }}/></div><h2 className="text-xl leading-8">{current.stem}</h2><div className="my-6 grid gap-3">{current.choices.map(choice => <button key={choice.id} disabled={busy || current.answer !== null} onClick={() => void answer(choice.id)} aria-label={`${choice.id.toUpperCase()}. ${choice.text}`} className={`rounded-xl border p-4 text-left font-bold ${current.answer?.choiceId === choice.id ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] bg-white hover:bg-[var(--muted)]"}`}>{choice.text}</button>)}</div>{current.answer && <div ref={feedbackRef} tabIndex={-1} role="status" aria-live="polite" className="mb-5 rounded-xl bg-[var(--accent)] p-4"><strong>{current.answer.correct ? "Bonne réponse" : "À revoir"}</strong><p className="mb-0 text-sm leading-6">{current.answer.explanation}</p></div>}<div className="flex justify-end">{current.answer && (index < session.items.length - 1 ? <button className="btn btn-primary" onClick={() => setIndex(index + 1)}>Question suivante</button> : <button className="btn btn-primary" disabled={busy} onClick={() => void complete()}>Terminer</button>)}</div></div>;
}
