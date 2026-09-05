"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { clientFetch } from "@/shared/api/client-fetch";

type Blueprint = Readonly<{ blueprintVersionId: string; itemCount: number }>;
type PlayableItem = Readonly<{ itemId: string; itemVersion: number; position: number; stem: string; choices: readonly Readonly<{ id: string; text: string }>[]; difficulty: string; answer: null | Readonly<{ choiceId: string; correct: boolean; correctChoiceId: string; explanation: string }> }>;
type PlayableSession = Readonly<{ sessionId: string; status: "IN_PROGRESS" | "COMPLETED"; items: readonly PlayableItem[]; score: null | Readonly<{ percentage: number; correct: number; total: number }> }>;
type Failure = Readonly<{ error?: Readonly<{ code?: string; traceId?: string; retriable?: boolean }> }>;
type ErrorAction = "CATALOG_RETRY" | "SAFE_EXIT" | "RETRY_RESUME" | "RETRY_CREATION" | "RETRY_ANSWER" | "RETRY_COMPLETION" | "LOCKED";
type RunnerError = Readonly<{ code: string; traceId: string | null; action: ErrorAction; href?: string; sessionId?: string; choiceId?: string }>;

async function body<T>(response: Response): Promise<T> { return response.json() as Promise<T>; }
async function failure(response: Response): Promise<Failure> { return body<Failure>(response).catch(() => ({})); }
function safeExit(status: number): string { return status === 401 ? "/auth/login" : status === 403 ? "/auth/logout" : "/"; }

export function McqSessionRunner() {
  const [blueprints, setBlueprints] = useState<readonly Blueprint[] | null>(null);
  const [resumableSessionId, setResumableSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<PlayableSession | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<RunnerError | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<"RESUME" | "START_NEW" | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const operationInFlight = useRef(false);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const loadCatalog = useCallback(async () => {
    setError(null); setBlueprints(null);
    try {
      const response = await clientFetch("/api/mcq/sessions", { cache: "no-store" });
      if (!response.ok) {
        const detail = await failure(response);
        const retryable = detail.error?.retriable === true;
        setError({ code: detail.error?.code ?? `HTTP_${response.status}`, traceId: detail.error?.traceId ?? response.headers.get("x-trace-id"), action: retryable ? "CATALOG_RETRY" : "SAFE_EXIT", href: safeExit(response.status) });
        setBlueprints([]); return;
      }
      const catalog = await body<{ blueprints: readonly Blueprint[]; resumableSession?: Readonly<{ sessionId: string }> | null }>(response);
      setBlueprints(catalog.blueprints);
      setResumableSessionId(catalog.resumableSession?.sessionId ?? null);
    } catch { setError({ code: "NET_REQUEST_FAILED", traceId: null, action: "CATALOG_RETRY" }); setBlueprints([]); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void loadCatalog(), 0); return () => window.clearTimeout(timer); }, [loadCatalog]);
  useEffect(() => { if (session?.items[index]?.answer) feedbackRef.current?.focus(); }, [session, index]);

  async function deterministicFailure(response: Response) {
    const detail = await failure(response);
    setError({ code: detail.error?.code ?? `HTTP_${response.status}`, traceId: detail.error?.traceId ?? response.headers.get("x-trace-id"), action: "SAFE_EXIT", href: safeExit(response.status) });
  }

  async function readOwnedSession(sessionId: string): Promise<Response> {
    return clientFetch(`/api/mcq/sessions/${sessionId}`, { cache: "no-store" });
  }

  function restoredIndex(current: PlayableSession): number {
    const unanswered = current.items.findIndex((item) => item.answer === null);
    return unanswered >= 0 ? unanswered : Math.max(0, current.items.length - 1);
  }

  async function resume(sessionId = resumableSessionId) {
    if (!sessionId || operationInFlight.current) return;
    operationInFlight.current = true; setBusy(true); setPendingAction("RESUME"); setError(null);
    try {
      const response = await readOwnedSession(sessionId);
      if (!response.ok) { await deterministicFailure(response); return; }
      const current = await body<PlayableSession>(response);
      setSession(current); setIndex(restoredIndex(current));
      if (current.status === "COMPLETED") setResumableSessionId(null);
    } catch { setError({ code: "NET_REQUEST_FAILED", traceId: null, action: "RETRY_RESUME", sessionId }); }
    finally { operationInFlight.current = false; setBusy(false); setPendingAction(null); }
  }

  async function reconcileCreation(sessionId: string) {
    setReconciling(true); setError(null);
    try {
      const response = await readOwnedSession(sessionId);
      if (response.ok) { setSession(await body<PlayableSession>(response)); setIndex(0); return; }
      const detail = await failure(response);
      if (response.status === 404) {
        setError({ code: "MCQ_SESSION_CREATION_NOT_CONFIRMED", traceId: detail.error?.traceId ?? response.headers.get("x-trace-id"), action: "RETRY_CREATION", sessionId });
        return;
      }
      if (response.status === 401 || response.status === 403) { await deterministicFailure(response); return; }
      setError({ code: detail.error?.code ?? "MCQ_SESSION_RECONCILIATION_FAILED", traceId: detail.error?.traceId ?? response.headers.get("x-trace-id"), action: "LOCKED", href: "/" });
    } catch { setError({ code: "NET_RECONCILIATION_FAILED", traceId: null, action: "LOCKED", href: "/" }); }
    finally { setReconciling(false); }
  }

  async function reconcileAnswer(sessionId: string, itemId: string, choiceId: string) {
    setReconciling(true); setError(null);
    try {
      const response = await readOwnedSession(sessionId);
      if (!response.ok) {
        if (response.status === 401 || response.status === 403 || response.status === 404) { await deterministicFailure(response); return; }
        const detail = await failure(response);
        setError({ code: detail.error?.code ?? "MCQ_SESSION_RECONCILIATION_FAILED", traceId: detail.error?.traceId ?? response.headers.get("x-trace-id"), action: "LOCKED", href: "/" }); return;
      }
      const current = await body<PlayableSession>(response);
      setSession(current);
      const item = current.items.find((candidate) => candidate.itemId === itemId);
      if (item?.answer) return;
      setError({ code: "MCQ_ANSWER_NOT_RECORDED", traceId: response.headers.get("x-trace-id"), action: "RETRY_ANSWER", choiceId });
    } catch { setError({ code: "NET_RECONCILIATION_FAILED", traceId: null, action: "LOCKED", href: "/" }); }
    finally { setReconciling(false); }
  }

  async function reconcileCompletion(sessionId: string) {
    setReconciling(true); setError(null);
    try {
      const response = await readOwnedSession(sessionId);
      if (!response.ok) {
        if (response.status === 401 || response.status === 403 || response.status === 404) { await deterministicFailure(response); return; }
        const detail = await failure(response);
        setError({ code: detail.error?.code ?? "MCQ_SESSION_RECONCILIATION_FAILED", traceId: detail.error?.traceId ?? response.headers.get("x-trace-id"), action: "LOCKED", href: "/" }); return;
      }
      const current = await body<PlayableSession>(response);
      setSession(current);
      if (current.status !== "COMPLETED") setError({ code: "MCQ_COMPLETION_NOT_RECORDED", traceId: response.headers.get("x-trace-id"), action: "RETRY_COMPLETION" });
      else setResumableSessionId(null);
    } catch { setError({ code: "NET_RECONCILIATION_FAILED", traceId: null, action: "LOCKED", href: "/" }); }
    finally { setReconciling(false); }
  }

  async function start(sessionId = crypto.randomUUID()) {
    const blueprint = blueprints?.[0]; if (!blueprint || operationInFlight.current) return;
    operationInFlight.current = true; setBusy(true); setPendingAction("START_NEW"); setError(null);
    try {
      const created = await clientFetch("/api/mcq/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId, mode: "STUDY", count: Math.min(5, blueprint.itemCount), seed: crypto.randomUUID(), blueprintVersionId: blueprint.blueprintVersionId }) });
      if (!created.ok) {
        if (created.status === 409 || created.status >= 500) await reconcileCreation(sessionId);
        else await deterministicFailure(created);
        return;
      }
      await reconcileCreation(sessionId);
    } catch { await reconcileCreation(sessionId); }
    finally { operationInFlight.current = false; setBusy(false); setPendingAction(null); }
  }

  async function answer(choiceId: string) {
    const current = session?.items[index]; if (!session || !current || current.answer || operationInFlight.current) return;
    operationInFlight.current = true; setBusy(true); setError(null);
    try {
      const response = await clientFetch(`/api/mcq/sessions/${session.sessionId}/answers`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId: current.itemId, itemVersion: current.itemVersion, choiceId }) });
      if (!response.ok) {
        if (response.status === 409 || response.status >= 500) await reconcileAnswer(session.sessionId, current.itemId, choiceId);
        else await deterministicFailure(response);
        return;
      }
      setSession(await body<PlayableSession>(response));
    } catch { await reconcileAnswer(session.sessionId, current.itemId, choiceId); }
    finally { operationInFlight.current = false; setBusy(false); }
  }

  async function complete() {
    if (!session || operationInFlight.current) return;
    operationInFlight.current = true; setBusy(true); setError(null);
    try {
      const response = await clientFetch(`/api/mcq/sessions/${session.sessionId}/complete`, { method: "POST" });
      if (!response.ok) {
        if (response.status === 409 || response.status >= 500) await reconcileCompletion(session.sessionId);
        else await deterministicFailure(response);
        return;
      }
      const result = await body<{ score: PlayableSession["score"] }>(response);
      setSession({ ...session, status: "COMPLETED", score: result.score });
      setResumableSessionId(null);
    } catch { await reconcileCompletion(session.sessionId); }
    finally { operationInFlight.current = false; setBusy(false); }
  }

  function errorAction(current: RunnerError) {
    if (current.action === "CATALOG_RETRY") return <button className="btn btn-primary" onClick={() => void loadCatalog()}>Réessayer le chargement</button>;
    if (current.action === "RETRY_RESUME") return <button className="btn btn-primary" onClick={() => void resume(current.sessionId)}>Réessayer la reprise</button>;
    if (current.action === "RETRY_CREATION") return <button className="btn btn-primary" onClick={() => void start(current.sessionId)}>Réessayer en sécurité</button>;
    if (current.action === "RETRY_ANSWER") return <button className="btn btn-primary" onClick={() => void answer(current.choiceId!)}>Réessayer la réponse</button>;
    if (current.action === "RETRY_COMPLETION") return <button className="btn btn-primary" onClick={() => void complete()}>Réessayer la finalisation</button>;
    return <a className="btn btn-secondary" href={current.href ?? "/"}>{current.action === "LOCKED" ? "Retour au tableau de bord" : "Sortir en sécurité"}</a>;
  }

  if (reconciling) return <div className="card p-8" role="status">Vérification de l’état de la session…</div>;
  if (blueprints === null) return <div className="card p-8" role="status">Chargement du corpus QCM…</div>;
  if (error) return <div className="card p-8" role="alert"><strong>Le QCM est indisponible.</strong><p className="text-sm text-[var(--muted-foreground)]">Code : {error.code}{error.traceId ? ` · traceId : ${error.traceId}` : ""}</p>{errorAction(error)}</div>;
  if (!session && resumableSessionId) return <div className="card p-8" role="region" aria-labelledby="mcq-resume-title"><h3 id="mcq-resume-title" className="mt-0">Session non terminée</h3><p>Choisissez explicitement de reprendre votre progression ou de commencer une nouvelle session. Votre ancienne session restera conservée.</p><div className="flex flex-wrap gap-3"><button className="btn btn-primary" disabled={busy} onClick={() => void resume()}>{pendingAction === "RESUME" ? "Reprise en cours…" : "Reprendre ma session"}</button><button className="btn btn-secondary" disabled={busy || !blueprints.length} onClick={() => void start()}>{blueprints.length ? pendingAction === "START_NEW" ? "Création en cours…" : "Commencer une nouvelle session" : "Aucun nouveau QCM disponible"}</button></div></div>;
  if (!blueprints.length && !session) return <div className="card p-8">Aucune question disponible.</div>;
  if (!session) return <div className="card p-8"><h3 className="mt-0">Corpus QCM versionné</h3><p>{blueprints.reduce((sum, value) => sum + value.itemCount, 0)} question(s) publiée(s) disponible(s).</p><button className="btn btn-primary" disabled={busy} onClick={() => void start()}>{pendingAction === "START_NEW" ? "Création en cours…" : "Commencer"}</button></div>;
  if (session.status === "COMPLETED") return <div className="card p-8 text-center"><CheckCircle2 size={46} className="mx-auto text-[var(--primary)]"/><div className="mt-4 text-5xl font-black text-[var(--primary)]">{session.score?.percentage ?? 0}%</div><h2>Session terminée</h2><p>{session.score?.correct ?? 0} bonne(s) réponse(s) sur {session.score?.total ?? session.items.length}.</p><button className="btn btn-primary" onClick={() => { setSession(null); setIndex(0); setResumableSessionId(null); }}><RotateCcw size={16}/>Nouvelle session</button></div>;
  const current = session.items[index]!;
  return <div className="card p-6 md:p-8"><div className="mb-6 flex justify-between"><span className="badge">Question {index + 1}/{session.items.length}</span><span className="badge">{current.difficulty}</span></div><div className="progress mb-7" role="progressbar" aria-label="Progression dans la session" aria-valuemin={1} aria-valuemax={session.items.length} aria-valuenow={index + 1}><span style={{ width: `${((index + 1) / session.items.length) * 100}%` }}/></div><h2 className="text-xl leading-8">{current.stem}</h2><div className="my-6 grid gap-3">{current.choices.map(choice => <button key={choice.id} disabled={busy || current.answer !== null} onClick={() => void answer(choice.id)} aria-label={`${choice.id.toUpperCase()}. ${choice.text}`} className={`rounded-xl border p-4 text-left font-bold ${current.answer?.choiceId === choice.id ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] bg-white hover:bg-[var(--muted)]"}`}>{choice.text}</button>)}</div>{current.answer && <div ref={feedbackRef} tabIndex={-1} role="status" aria-live="polite" className="mb-5 rounded-xl bg-[var(--accent)] p-4"><strong>{current.answer.correct ? "Bonne réponse" : "À revoir"}</strong><p className="mb-0 text-sm leading-6">{current.answer.explanation}</p></div>}<div className="flex justify-end">{current.answer && (index < session.items.length - 1 ? <button className="btn btn-primary" onClick={() => setIndex(index + 1)}>Question suivante</button> : <button className="btn btn-primary" disabled={busy} onClick={() => void complete()}>Terminer</button>)}</div></div>;
}
