"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CompletedMcqSession } from "@/application/mcq/get-completed-mcq-session";
import { clientFetch } from "@/shared/api/client-fetch";
import { McqAnswerFeedback } from "./mcq-answer-feedback";
import { Loading } from "./ui";

export function McqSessionHistory({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<CompletedMcqSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    clientFetch(`/api/mcq/sessions/${encodeURIComponent(sessionId)}/history`, { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Lecture impossible. Vérifiez votre connexion et votre accès à cette session terminée.");
        const value: CompletedMcqSession = await response.json();
        if (value.status !== "COMPLETED") throw new Error("Cette session n’est pas terminée.");
        if (active) setSession(value);
      }).catch(() => { if (active) setError("Lecture impossible. Vérifiez votre connexion et votre accès à cette session terminée."); });
    return () => { active = false; };
  }, [sessionId]);

  useEffect(() => {
    if (session && window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView?.();
  }, [session]);

  return <div className="mx-auto max-w-4xl space-y-6">
    <Link href="/progress">Retour à la progression</Link>
    <h1>Correction historique</h1>
    <p>Lecture seule — réponses et score enregistrés, sans modification.</p>
    {error ? <p role="alert">{error}</p> : !session ? <Loading /> : <>
      <p>{session.completedAt && new Date(session.completedAt).toLocaleString("fr-CA")} · {session.sessionKind === "MOCK_EXAM" ? "Examen blanc" : "QCM Partie I"}</p>
      <p>Score enregistré : {session.score ? `${session.score.percentage}% · ${session.score.correct}/${session.score.total}` : "Non disponible"}</p>
      {session.items.map(item => <article id={`question-${item.position}`} key={`${item.itemId}:${item.itemVersion}`} className="card scroll-mt-6 p-6">
        <h2>{item.position + 1}. {item.stem}</h2>
        <ul>{item.choices.map(choice => <li key={choice.id}>{choice.id.toUpperCase()}. {choice.text}</li>)}</ul>
        {item.answer ? <>
          <p>Réponse enregistrée : {item.answer.choiceId.toUpperCase()}. {item.choices.find(choice => choice.id === item.answer?.choiceId)?.text}</p>
          <McqAnswerFeedback answer={item.answer} choices={item.choices} />
        </> : <><p>Sans réponse enregistrée.</p>{item.unansweredCorrection && <McqAnswerFeedback answer={item.unansweredCorrection} choices={item.choices} />}</>}
      </article>)}
    </>}
  </div>;
}
