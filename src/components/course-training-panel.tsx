"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CourseTraining } from "@/application/mcq/course-training";
import { MAX_COURSE_DRAFTS, type CourseCommand, type CourseEdit } from "@/application/mcq/course-training-contract";
import { clientFetch } from "@/shared/api/client-fetch";
import { McqSessionRunner } from "./mcq-session-runner";
import { PageHeader } from "./ui";

type State = ReturnType<CourseTraining["read"]>;
type Question = State["questions"][number];
export function CourseTrainingPanel({ documentId }: { documentId: number }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [training, setTraining] = useState(false);
  const inFlight = useRef(false);
  const url = `/api/courses/${documentId}/training`;
  const load = useCallback(async () => {
    try { const response = await clientFetch(url); const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? "Accès au cours impossible."); setState(body); setError(""); }
    catch (error) { setError(error instanceof Error ? error.message : "Lecture impossible."); }
  }, [url]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  async function act(command: CourseCommand) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const response = await clientFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(command) }, 135_000);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Action impossible.");
      setState(body);
    } catch (error) { setError(error instanceof Error ? error.message : "Action impossible. Actualisez avant de réessayer."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const approved = state?.questions.filter(q => q.status === "IN_REVIEW") ?? [];
  const published = state?.questions.filter(q => q.status === "PUBLISHED") ?? [];
  const pending = state?.questions.some(q => q.status === "DRAFT" || q.status === "IN_REVIEW");
  const latestRange = state?.coverage.ranges.at(-1);
  return <main className="mx-auto max-w-4xl space-y-5">
    <Link href="/library">Retour à la bibliothèque</Link>
    <PageHeader title={state?.name ?? "Entraînement sur mon cours"} description="Préparez, vérifiez puis publiez vos questions personnelles." />
    {error && <div role="alert"><p>{error}</p><button className="btn btn-ghost" onClick={() => void load()} disabled={busy}>Actualiser</button></div>}
    {!state && !error && <p>Chargement du cours…</p>}
    {state && <>
      <p>La préparation envoie le texte de ce cours à OpenAI. Les questions restent des brouillons privés jusqu’à votre validation. Vérifiez les faits, les références et la compétence proposée.</p>
      {latestRange
        ? <p>Couverture : pages {latestRange.pageStart}–{latestRange.pageEnd} sur {state.coverage.pageCount}</p>
        : <p>Couverture : 0 sur {state.coverage.pageCount} pages</p>}
      {state.coverage.completed ? <div role="status"><p>Couverture du cours terminée</p><p>{state.coverage.lastPageCovered} pages couvertes · {state.coverage.publishedQuestions} questions publiées · {state.coverage.rejectedQuestions} questions rejetées</p></div>
        : <button className="btn btn-primary" disabled={busy || pending || state.coverage.trackingBlocked} onClick={() => void act({ action: "generate", desiredQuestionCount: MAX_COURSE_DRAFTS })}>{busy ? "Traitement en cours…" : state.coverage.lastPageCovered > 0 ? `Préparer les ${MAX_COURSE_DRAFTS} questions suivantes` : `Préparer ${MAX_COURSE_DRAFTS} questions`}</button>}
      <p role="status">{state.questions.filter(q => q.status === "DRAFT").length} brouillons · {approved.length} validées · {published.length} publiées</p>
      {state.questions.map((question, index) => <CourseQuestionReview key={`${question.itemId}:${question.version}`} question={question} index={index} busy={busy} act={act} />)}
      <button className="btn btn-primary" disabled={busy || !approved.length} onClick={() => { if (window.confirm("J’ai revu le contenu, les réponses, les corrections, les références et les compétences des questions validées. Publier ?")) void act({ action: "publish", confirmReviewed: true, approvals: approved.map(q => ({ itemId: q.itemId, expectedVersion: q.version })) }); }}>Publier les questions validées</button>
      {published.length > 0 && <button className="btn btn-primary" disabled={busy} onClick={() => setTraining(true)}>Commencer l’entraînement</button>}
      {training && <McqSessionRunner documentId={documentId} />}
    </>}
  </main>;
}

function CourseQuestionReview({ question: q, index, busy, act }: { question: Question; index: number; busy: boolean; act: (command: CourseCommand) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<CourseEdit>({ stem: q.stem, choices: q.choices, correctChoiceId: q.correctChoiceId, explanation: q.explanation });
  const locked = q.status === "PUBLISHED" || q.status === "RETIRED";
  return <section className="card space-y-3 p-5" aria-label={`Question ${index + 1}`}>
    <h2>Question {index + 1} — {({ DRAFT: "Brouillon", IN_REVIEW: "Validée", PUBLISHED: "Publiée", RETIRED: "Rejetée" })[q.status]}</h2>
    {editing ? <>
      <label className="block">Question<textarea className="field" value={edit.stem} onChange={e => setEdit({ ...edit, stem: e.target.value })} /></label>
      {edit.choices.map((c, i) => <label className="block" key={c.id}>Option {c.id.toUpperCase()}<input className="field" value={c.text} onChange={e => setEdit({ ...edit, choices: edit.choices.map((v, j) => j === i ? { ...v, text: e.target.value } : v) })} /></label>)}
      <label className="block">Bonne réponse<select className="field" value={edit.correctChoiceId} onChange={e => setEdit({ ...edit, correctChoiceId: e.target.value })}>{edit.choices.map(c => <option key={c.id} value={c.id}>{c.id.toUpperCase()}</option>)}</select></label>
      <label className="block">Correction détaillée<textarea className="field min-h-80" value={edit.explanation} onChange={e => setEdit({ ...edit, explanation: e.target.value })} /></label>
      <button className="btn btn-primary" disabled={busy} onClick={() => void act({ action: "edit", itemId: q.itemId, expectedVersion: q.version, edit })}>Enregistrer le brouillon</button>
      <button className="btn btn-ghost" disabled={busy} onClick={() => setEditing(false)}>Annuler</button>
    </> : <>
      <p>{q.stem}</p>{q.choices.map(c => <p key={c.id}>{c.id.toUpperCase()}. {c.text}</p>)}
      <p>Bonne réponse : {q.correctChoiceId.toUpperCase()}</p>
      <details><summary>Voir la correction et la provenance</summary><p className="whitespace-pre-wrap">{q.explanation}</p><p>Référence : {q.reference}</p><p>Compétence proposée : {q.mappings.map(m => m.competencyId).join(", ")}</p></details>
      {!locked && <><button className="btn btn-ghost" disabled={busy} onClick={() => setEditing(true)}>Modifier</button><button className="btn btn-ghost" disabled={busy} onClick={() => void act({ action: "reject", itemId: q.itemId, expectedVersion: q.version })}>Rejeter</button><button className="btn btn-primary" disabled={busy || q.status === "IN_REVIEW"} onClick={() => void act({ action: "approve", itemId: q.itemId, expectedVersion: q.version })}>Valider</button></>}
    </>}
  </section>;
}
