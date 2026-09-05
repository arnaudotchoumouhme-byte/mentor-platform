"use client";

import Link from "next/link";
import { QuizRunner } from "@/components/quiz-runner";
import { Loading, Notice, PageHeader } from "@/components/ui";
import { useAppState } from "@/hooks/use-state";

export default function MockExams() {
  const { data, error, status, refresh, act } = useAppState();

  if (status === "loading") return <Loading/>;
  if (status === "unauthenticated") return <Diagnostic title="Authentification requise" description="Connectez-vous avec votre compte Auth0 autorisé." action={<Link className="btn btn-primary" href="/auth/login">Se connecter</Link>}/>;
  if (status === "access-denied") return <Diagnostic title="Accès refusé" description="Votre compte Auth0 n’est pas provisionné ou actif."/>;
  if (status === "conflict" || status === "quota-exceeded") return <Diagnostic title={status === "conflict" ? "État incompatible" : "Quota atteint"} description={error || "L’examen blanc n’est pas disponible."}/>;
  if (status === "network-error" || status === "server-error" || !data) return <Diagnostic title="Chargement impossible" description={error || "Une erreur est survenue."} action={<button className="btn btn-primary" onClick={() => void refresh()}>Réessayer</button>}/>;

  return <div className="mx-auto max-w-4xl">
    <PageHeader eyebrow="FEAT-023 · Conditions d’examen" title="Examen blanc" description="Une session chronométrée dont les réponses sont conservées et intégrées à votre progression."/>
    {data.questions.length === 0 ? <div className="card p-8 text-center"><h2 className="mt-0">Aucune question disponible</h2><p className="text-[var(--muted-foreground)]">Le jeu local ne contient pas encore de questions pour constituer un examen blanc.</p><Link className="btn btn-primary" href="/quizzes">Voir la Partie I — QCM</Link></div> : <><div className="mb-5"><Notice>Le jeu local contient actuellement {data.questions.length} questions. L’examen s’adapte à ce volume et signale cette limite.</Notice></div><QuizRunner data={data} act={act} exam/></>}
  </div>;
}

function Diagnostic({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="mx-auto max-w-xl"><PageHeader eyebrow="Examen blanc" title={title} description={description}/>{action}</div>;
}
