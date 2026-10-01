"use client";

import Link from "next/link";
import { observedSubjectResult } from "@/presentation/dashboard/pebc-dashboard";
import { useAppState } from "@/hooks/use-state";
import { EmptyState, Loading, Metric, PageHeader } from "@/components/ui";

export default function Progress() {
  const { data } = useAppState();
  if (!data) return <Loading />;

  const hasAttempts = data.attempts.length > 0;
  const average = hasAttempts
    ? Math.round(data.attempts.reduce((sum, attempt) => sum + attempt.score, 0) / data.attempts.length)
    : null;
  const minutes = data.attempts.reduce((sum, attempt) => sum + attempt.duration_minutes, 0);
  const activeCards = data.flashcards.filter((card) => card.status === "active").length;
  const subjects = [...data.subjects, ...[...new Set(data.attempts.map(attempt => attempt.subject))]
    .filter(name => !data.subjects.some(subject => subject.name === name))
    .map((name, index) => ({ id: `observed-${index}`, name, color: "var(--primary)" }))];

  return <div className="mx-auto max-w-6xl">
    <PageHeader eyebrow="FEAT-020 · Indicateurs explicables" title="Progression" description="Chaque score est calculé à partir de vos activités conservées, sans écraser l’historique." />
    <div className="mb-7 grid gap-4 md:grid-cols-3">
      <Metric label="Score moyen" value={average === null ? "Pas encore évalué" : `${average}%`} detail={hasAttempts ? `${data.attempts.length} activités évaluées` : "Commencez un QCM pour obtenir un premier résultat"} />
      <Metric label="Temps évalué" value={hasAttempts ? `${minutes} min` : "Aucune donnée"} detail={hasAttempts ? "Somme des sessions enregistrées" : "Aucune session terminée"} tone="blue" />
      <Metric label="Cartes actives" value={String(activeCards)} detail={activeCards ? "Cartes intégrées à la répétition" : "Aucune carte active"} tone="orange" />
    </div>
    <div className="grid gap-6 lg:grid-cols-[1fr_.9fr]">
      <section className="card p-6">
        <h2 className="mt-0">Résultats observés par matière</h2>
        {subjects.length === 0
          ? <EmptyState title="Pas encore évalué" detail="Les matières apparaîtront ici après vos premières activités évaluées." />
          : <div className="space-y-5">{subjects.map((subject) => { const result = observedSubjectResult(data, subject.name); return <div id={`subject-${subject.id}`} className="scroll-mt-6" key={subject.id}>
              <div className="mb-2 flex justify-between text-sm"><strong>{subject.name}</strong><span>{result === null ? "Non évalué" : `${result}% · Résultat observé`}</span></div>
              {result !== null && <div className="progress"><span style={{ width: `${result}%`, background: subject.color }} /></div>}
            </div>; })}</div>}
      </section>
      <section className="card p-6">
        <h2 className="mt-0">Historique récent</h2>
        {hasAttempts
          ? data.attempts.map((attempt) => <div key={attempt.id} className="flex items-center justify-between border-t border-[var(--border)] py-4">
              <div><strong>{attempt.module}</strong><div className="text-xs text-[var(--muted-foreground)]">{attempt.subject} · {new Date(attempt.created_at).toLocaleDateString("fr-CA")}{attempt.question_count != null && ` · ${attempt.question_count} questions`}</div>
                {attempt.session_id && <Link href={`/progress/sessions/${encodeURIComponent(attempt.session_id)}`}>Revoir la session</Link>}
              </div>
              <span className="text-xl font-black text-[var(--primary)]">{attempt.score}%</span>
            </div>)
          : <div><EmptyState title="Aucun résultat enregistré" detail="Terminez une activité pour construire votre historique sans inventer de progression." /><Link className="btn btn-primary mt-4" href="/quizzes">Commencer un QCM</Link></div>}
      </section>
    </div>
    <section id="errors" className="card mt-6 scroll-mt-6 p-6">
      <h2>Erreurs à revoir</h2>
      <p>Réponses incorrectes conservées de vos sessions terminées.</p>
      {data.mcqErrors?.length ? data.mcqErrors.map(error => <article key={`${error.sessionId}:${error.position}`} className="border-t border-[var(--border)] py-4">
        <p className="text-sm">{new Date(error.answeredAt).toLocaleDateString("fr-CA")} · {error.topic}</p>
        <h3>{error.question}</h3>
        <p>Votre réponse : {error.chosenAnswer}</p>
        <p>Bonne réponse : {error.correctAnswer}</p>
        <Link href={`/progress/sessions/${encodeURIComponent(error.sessionId)}#question-${error.position}`}>Revoir</Link>
      </article>) : <p>Aucune erreur enregistrée dans vos sessions terminées.</p>}
    </section>
  </div>;
}
