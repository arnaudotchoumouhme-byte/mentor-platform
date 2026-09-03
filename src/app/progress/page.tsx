"use client";

import Link from "next/link";
import { masteryLabel } from "@/domain/learning";
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

  return <div className="mx-auto max-w-6xl">
    <PageHeader eyebrow="FEAT-020 · Indicateurs explicables" title="Progression" description="Chaque score est calculé à partir de vos activités conservées, sans écraser l’historique." />
    <div className="mb-7 grid gap-4 md:grid-cols-3">
      <Metric label="Score moyen" value={average === null ? "Pas encore évalué" : `${average}%`} detail={hasAttempts ? `${data.attempts.length} activités évaluées` : "Commencez un QCM pour obtenir un premier résultat"} />
      <Metric label="Temps évalué" value={hasAttempts ? `${minutes} min` : "Aucune donnée"} detail={hasAttempts ? "Somme des sessions enregistrées" : "Aucune session terminée"} tone="blue" />
      <Metric label="Cartes actives" value={String(activeCards)} detail={activeCards ? "Cartes intégrées à la répétition" : "Aucune carte active"} tone="orange" />
    </div>
    <div className="grid gap-6 lg:grid-cols-[1fr_.9fr]">
      <section className="card p-6">
        <h2 className="mt-0">Maîtrise par matière</h2>
        {data.subjects.length === 0
          ? <EmptyState title="Pas encore évalué" detail="Les matières apparaîtront ici après vos premières activités évaluées." />
          : <div className="space-y-5">{data.subjects.map((subject) => <div key={subject.id}>
              <div className="mb-2 flex justify-between text-sm"><strong>{subject.name}</strong><span>{subject.mastery}% · {masteryLabel(subject.mastery)}</span></div>
              <div className="progress"><span style={{ width: `${subject.mastery}%`, background: subject.color }} /></div>
            </div>)}</div>}
      </section>
      <section className="card p-6">
        <h2 className="mt-0">Historique récent</h2>
        {hasAttempts
          ? data.attempts.map((attempt) => <div key={attempt.id} className="flex items-center justify-between border-t border-[var(--border)] py-4">
              <div><strong>{attempt.module}</strong><div className="text-xs text-[var(--muted-foreground)]">{attempt.subject} · {new Date(attempt.created_at).toLocaleDateString("fr-CA")}</div></div>
              <span className="text-xl font-black text-[var(--primary)]">{attempt.score}%</span>
            </div>)
          : <div><EmptyState title="Aucun résultat enregistré" detail="Terminez une activité pour construire votre historique sans inventer de progression." /><Link className="btn btn-primary mt-4" href="/quizzes">Commencer un QCM</Link></div>}
      </section>
    </div>
  </div>;
}
