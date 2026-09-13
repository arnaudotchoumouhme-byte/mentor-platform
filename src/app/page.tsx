"use client";

import Link from "next/link";
import { ArrowRight, BookOpenCheck, Bot, CircleDot, Map, Play, Target } from "lucide-react";
import { Loading, Notice, PageHeader } from "@/components/ui";
import { useAppState } from "@/hooks/use-state";
import { buildCompetencies, buildDailyMission, buildPebcStages, completedActivityCount, priorityLabels } from "@/presentation/dashboard/pebc-dashboard";

export default function Dashboard() {
  const { data, error, status, refresh } = useAppState();
  if (status === "loading") return <Loading/>;
  if (status === "unauthenticated") return <DiagnosticPage eyebrow="Pilote fermé" title="Authentification requise" description="Connectez-vous avec votre compte Auth0 autorisé." action={<Link className="btn btn-primary" href="/auth/login">Se connecter</Link>}/>;
  if (status === "access-denied") return <DiagnosticPage eyebrow="Pilote fermé" title="Accès refusé" description="Votre compte Auth0 n’est pas provisionné ou actif." action={<Link className="btn btn-secondary" href="/auth/logout">Se déconnecter</Link>}/>;
  if (status === "conflict") return <DiagnosticPage eyebrow="Conflit" title="État incompatible" description={error || "L’état courant ne permet pas le chargement."} action={<button className="btn btn-primary" onClick={() => void refresh()}>Actualiser</button>}/>;
  if (status === "quota-exceeded") return <DiagnosticPage eyebrow="Pilote fermé" title="Quota atteint" description={error || "Le quota autorisé est épuisé."}/>;
  if (status === "network-error" || status === "server-error" || !data) return <DiagnosticPage eyebrow="Indisponible" title="Chargement impossible" description={error || "Une erreur est survenue."} action={<button className="btn btn-primary" onClick={() => void refresh()}>Réessayer</button>}/>;

  const mission = buildDailyMission(data);
  const nextAction = mission.nextAction;
  const firstVisit = status === "loaded-empty" || nextAction.id === "first-step";
  const stages = buildPebcStages(data);
  const competencies = buildCompetencies(data);
  const completed = completedActivityCount(data);
  const activePriority = data.weaknesses.find((weakness) => weakness.status === "active");

  return <div className="mx-auto max-w-[1500px]">
    <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div><div className="mb-2 text-xs font-black uppercase tracking-[.2em] text-[var(--primary)]">Aujourd’hui</div><h1 className="m-0 text-3xl font-black tracking-tight sm:text-4xl">{firstVisit ? "Bienvenue" : "Bonjour"} <span aria-hidden="true">👋</span></h1><p className="mb-0 mt-2 text-base text-[var(--muted-foreground)]">Votre prochaine étape vers le PEBC, une activité à la fois.</p></div>
    </header>

    {error && <div className="mb-5"><Notice>{error}</Notice></div>}

    <div className="grid gap-6 xl:grid-cols-[1.35fr_.85fr]">
      <section className="mission-card relative overflow-hidden rounded-[28px] p-6 text-white shadow-xl sm:p-8" aria-labelledby="mission-title">
        <div className="relative z-10">
          <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-emerald-100"><Target size={18}/>Mission du jour</div>
          <h2 id="mission-title" className="m-0 text-xl font-black sm:text-2xl">Votre prochaine meilleure action</h2>
          {firstVisit && <p className="mb-0 mt-2 text-sm text-white">Construisons votre première session.</p>}
          <div className="my-5">
            <p className="mb-2 text-sm font-bold text-emerald-100">{nextAction.activityType}</p>
            <h3 className="m-0 max-w-2xl break-words text-2xl font-black leading-tight sm:text-3xl">{nextAction.title}</h3>
            {nextAction.subtitle && <p className="mb-0 mt-2 break-words text-sm text-white">{nextAction.subtitle}</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              {nextAction.statusLabel && <span className="rounded-full border border-white/40 px-3 py-1">{nextAction.statusLabel}</span>}
              {nextAction.priority && <span className="rounded-full border border-white/40 px-3 py-1">{priorityLabels[nextAction.priority]}</span>}
              {nextAction.durationLabel && <span className="rounded-full border border-white/40 px-3 py-1">{nextAction.durationLabel}</span>}
            </div>
          </div>
          <Link id="next-action" href={mission.primaryHref} className="btn w-full bg-white px-5 py-3 text-center text-[var(--primary-dark)] shadow-lg focus-visible:outline-white sm:w-auto"><Play aria-hidden="true" size={17} className="shrink-0" fill="currentColor"/>{nextAction.cta}</Link>
          <div className="mt-5 border-t border-white/30 pt-4"><h3 className="mb-1 mt-0 text-sm font-black text-white">Pourquoi cette session&nbsp;?</h3><p className="mb-0 max-w-2xl text-sm leading-6 text-white">{mission.rationale}</p></div>
          <a href="#explore-activities" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-white underline underline-offset-4 focus-visible:outline-white">Choisir moi-même <ArrowRight aria-hidden="true" size={15}/></a>
          {mission.activities.length > 1 && <details className="mt-3 border-t border-white/30 pt-3"><summary className="cursor-pointer py-2 text-sm font-bold focus-visible:outline-white">Ensuite dans ma mission ({mission.activities.length - 1})</summary><ul className="mb-0 space-y-3 pl-5 text-sm">{mission.activities.slice(1).map(activity => <li key={activity.id}><Link href={activity.href} className="font-bold underline underline-offset-4 focus-visible:outline-white">{activity.title}</Link><span className="mt-1 block text-white">{activity.detail}{activity.meta ? ` · ${activity.meta}` : ""}</span></li>)}</ul></details>}
        </div>
      </section>

      <section className="card p-6 sm:p-7" aria-labelledby="path-title">
        <div className="mb-5 flex items-center justify-between"><div><div className="section-kicker">Votre trajectoire</div><h2 id="path-title" className="mb-0 mt-1 text-xl font-black">Mon parcours PEBC</h2></div><Map className="text-[var(--primary)]"/></div>
        <div className="space-y-1">{stages.map((stage, index) => <Link href={stage.href} key={stage.name} className="group flex gap-3 rounded-2xl p-3 transition-colors hover:bg-[var(--muted)]"><div className="flex flex-col items-center"><span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-black ${stage.progress === null ? "bg-[var(--muted)] text-[var(--muted-foreground)]" : "bg-[var(--accent)] text-[var(--primary)]"}`}>{index + 1}</span>{index < stages.length - 1 && <span className="my-1 h-full w-px bg-[var(--border)]"/>}</div><div className="min-w-0 flex-1 pb-3"><strong className="text-sm">{stage.name}</strong><p className="mb-2 mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{stage.description}</p>{stage.progress !== null && <><div className="progress"><span style={{ width: `${stage.progress}%` }}/></div><div className="mt-1 text-right text-xs font-bold text-[var(--primary)]">{stage.progress}% · score moyen enregistré</div></>}<span className="mt-2 inline-block text-xs font-bold text-[var(--primary)] underline underline-offset-4">{stage.cta}</span></div></Link>)}</div>
      </section>
    </div>

    <section id="explore-activities" className="my-6 scroll-mt-6" aria-labelledby="explore-title"><h2 id="explore-title" className="mb-3 text-lg font-black">Explorer les activités</h2><div className="grid gap-4 md:grid-cols-2">
      <PathwayCard eyebrow="Examen d’aptitude" title="Partie I — QCM" description="QCM ciblés, examens blancs, calculs et révision des erreurs." href="/quizzes" icon={<BookOpenCheck/>}/>
      <PathwayCard eyebrow="Examen d’aptitude" title="Partie II — ECOS" description="Stations, communication, jugement clinique, sécurité et feedback." href="/clinical-cases" icon={<CircleDot/>}/></div><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-[var(--primary)]"><Link className="py-2 underline underline-offset-4" href="/flashcards">Mémoriser avec les flashcards</Link><Link className="py-2 underline underline-offset-4" href="/library">Apprendre avec mes ressources</Link></div>
    </section>

    <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <section className="card p-6 sm:p-7" aria-labelledby="competencies-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><div className="section-kicker">Progression par domaine</div><h2 id="competencies-title" className="mb-0 mt-1 text-xl font-black">Ma carte de compétences</h2></div><Link href="/progress" className="text-sm font-black text-[var(--primary)]">Voir ma progression <ArrowRight className="inline" size={15}/></Link></div>
        {competencies.length === 0 ? <div className="rounded-2xl bg-[var(--muted)] p-6 text-center"><strong>Vos premières activités dessineront votre progression</strong><p className="mb-0 mt-2 text-sm text-[var(--muted-foreground)]">Retrouvez ici les domaines à travailler et vos résultats au fil de votre parcours.</p></div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{competencies.map((competency) => <Link href={competency.href} aria-label={`${competency.name} — ${competency.status}`} key={competency.id} className="rounded-2xl border border-[var(--border)] p-4 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"><div className="mb-3 flex flex-wrap items-start justify-between gap-2"><strong className="text-sm">{competency.name}</strong><span className="badge">{competency.status}</span></div>{competency.progress !== null && <><div className="progress"><span style={{ width: `${competency.progress}%`, background: competency.color }}/></div><div className="mt-2 text-right text-xs font-black">{competency.progress}%</div></>}</Link>)}</div>}
      </section>
      <section className="self-start rounded-2xl border border-[var(--border)] p-5" aria-labelledby="challenges-title">
        <h2 id="challenges-title" className="mb-2 mt-0 text-lg font-black">Défis & objectif</h2>
        {completed > 0 && <p className="text-sm"><strong>{completed}</strong> activité{completed > 1 ? "s" : ""} terminée{completed > 1 ? "s" : ""} dans votre parcours</p>}
        <details><summary className="cursor-pointer py-2 text-sm font-bold text-[var(--primary)]">Voir mes repères d’engagement</summary><p className="mb-0 text-sm leading-6 text-[var(--muted-foreground)]">Série, badges, XP clinique et objectif de la semaine ne sont pas encore renseignés. Pour suivre vos acquis, consultez votre progression.</p><Link href="/progress" className="mt-2 inline-block py-2 text-sm font-bold text-[var(--primary)] underline underline-offset-4">Consulter ma progression</Link></details>
      </section>
    </div>

    <section className="coach-card mt-6 grid items-center gap-6 overflow-hidden rounded-[26px] border border-emerald-200 p-6 sm:p-8 lg:grid-cols-[auto_1fr_auto]" aria-labelledby="coach-title">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--primary)] text-white"><Bot size={28}/></span><div><div className="section-kicker">Accompagnement pédagogique</div><h2 id="coach-title" className="mb-2 mt-1 text-2xl font-black">Pharmacien Coach</h2><p className="mb-0 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">{activePriority ? `Vous pouvez choisir « ${activePriority.topic} » comme objectif dans le Coach.` : "Le Coach peut vous accompagner à partir d’un objectif que vous choisissez."}</p></div><Link href="/ai" className="btn btn-secondary">Ouvrir le Coach</Link>
    </section>
  </div>;
}

function DiagnosticPage({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="mx-auto max-w-xl"><PageHeader eyebrow={eyebrow} title={title} description={description}/>{action}</div>; }
function PathwayCard({ eyebrow, title, description, href, icon }: { eyebrow: string; title: string; description: string; href: string; icon: React.ReactNode }) { return <Link href={href} className="pathway-card group card flex items-center gap-5 p-5 sm:p-6"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent)] text-[var(--primary)]">{icon}</span><div className="min-w-0 flex-1"><div className="text-[.68rem] font-black uppercase tracking-[.18em] text-[var(--primary)]">{eyebrow}</div><h3 className="mb-1 mt-1 text-xl font-black">{title}</h3><p className="m-0 text-sm leading-5 text-[var(--muted-foreground)]">{description}</p></div><ArrowRight className="shrink-0 text-[var(--primary)] transition-transform group-hover:translate-x-1"/></Link>; }
