"use client";

import Link from "next/link";
import { ArrowRight, Award, BookOpenCheck, Bot, CircleDot, Flame, Map, Play, Sparkles, Star, Target } from "lucide-react";
import { Loading, Notice, PageHeader } from "@/components/ui";
import { useAppState } from "@/hooks/use-state";
import { buildCompetencies, buildDailyMission, buildPebcStages, completedActivityCount } from "@/presentation/dashboard/pebc-dashboard";

export default function Dashboard() {
  const { data, error, status, refresh } = useAppState();
  if (status === "loading") return <Loading/>;
  if (status === "unauthenticated") return <DiagnosticPage eyebrow="Pilote fermé" title="Authentification requise" description="Connectez-vous avec votre compte Auth0 autorisé." action={<Link className="btn btn-primary" href="/auth/login">Se connecter</Link>}/>;
  if (status === "access-denied") return <DiagnosticPage eyebrow="Pilote fermé" title="Accès refusé" description="Votre compte Auth0 n’est pas provisionné ou actif." action={<Link className="btn btn-secondary" href="/auth/logout">Se déconnecter</Link>}/>;
  if (status === "conflict") return <DiagnosticPage eyebrow="Conflit" title="État incompatible" description={error || "L’état courant ne permet pas le chargement."} action={<button className="btn btn-primary" onClick={() => void refresh()}>Actualiser</button>}/>;
  if (status === "quota-exceeded") return <DiagnosticPage eyebrow="Pilote fermé" title="Quota atteint" description={error || "Le quota autorisé est épuisé."}/>;
  if (status === "network-error" || status === "server-error" || !data) return <DiagnosticPage eyebrow="Indisponible" title="Chargement impossible" description={error || "Une erreur est survenue."} action={<button className="btn btn-primary" onClick={() => void refresh()}>Réessayer</button>}/>;

  const mission = buildDailyMission(data);
  const stages = buildPebcStages(data);
  const competencies = buildCompetencies(data);
  const completed = completedActivityCount(data);
  const activePriority = data.weaknesses.find((weakness) => weakness.status === "active");

  return <div className="mx-auto max-w-[1500px]">
    <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div><div className="mb-2 text-xs font-black uppercase tracking-[.2em] text-[var(--primary)]">Aujourd’hui</div><h1 className="m-0 text-3xl font-black tracking-tight sm:text-4xl">Bonjour <span aria-hidden="true">👋</span></h1><p className="mb-0 mt-2 text-base text-[var(--muted-foreground)] sm:text-lg">Prêt pour votre prochaine étape vers le PEBC&nbsp;?</p></div>
      <div className="grid grid-cols-3 gap-2" aria-label="Repères d’engagement">
        <NeutralStat icon={<Flame size={17}/>} label="Série" value="Pas encore évalué"/>
        <NeutralStat icon={<Star size={17}/>} label="Activités" value={completed > 0 ? String(completed) : "Commencer"}/>
        <NeutralStat icon={<Award size={17}/>} label="Badges" value="Aucun badge acquis"/>
      </div>
    </header>

    {error && <div className="mb-5"><Notice>{error}</Notice></div>}
    {status === "loaded-empty" && <div className="mb-5"><Notice>Votre espace est prêt. Aucune donnée d’apprentissage n’est encore disponible.</Notice></div>}

    <div className="grid gap-6 xl:grid-cols-[1.35fr_.85fr]">
      <section className="mission-card relative overflow-hidden rounded-[28px] p-6 text-white shadow-xl sm:p-8" aria-labelledby="mission-title">
        <div className="relative z-10">
          <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-emerald-100"><Target size={18}/>Mission du jour</div>
          <h2 id="mission-title" className="m-0 max-w-xl text-2xl font-black sm:text-3xl">Votre session, simple et ciblée</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">Avancez sur les activités réellement disponibles dans votre espace.</p>
          <div className="my-6 grid gap-3 sm:grid-cols-2">
            {mission.activities.length > 0 ? mission.activities.map((activity, index) => <div key={activity.id} className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white font-black text-[var(--primary-dark)]">{index + 1}</span><div className="min-w-0 flex-1"><div className="truncate font-black">{activity.title}</div><div className="mt-1 truncate text-xs text-white/70">{activity.detail}</div></div><span className="text-xs font-bold text-white/80">{activity.meta}</span></div>) : <div className="rounded-2xl border border-white/15 bg-white/10 p-5 sm:col-span-2"><div className="font-black">Aucune donnée disponible</div><p className="mb-0 mt-1 text-sm text-white/70">Planifiez une activité ou importez une ressource pour construire votre première session.</p></div>}
          </div>
          <Link href={mission.primaryHref} className="btn bg-white px-6 py-3 text-[var(--primary-dark)] shadow-lg"><Play size={17} fill="currentColor"/>Commencer ma session</Link>
          <div className="mt-6 border-t border-white/15 pt-5"><div className="mb-1 text-xs font-black uppercase tracking-wider text-emerald-100">Pourquoi cette session&nbsp;?</div><p className="mb-0 max-w-2xl text-sm leading-6 text-white/75">{mission.rationale}</p></div>
        </div>
      </section>

      <section className="card p-6 sm:p-7" aria-labelledby="path-title">
        <div className="mb-5 flex items-center justify-between"><div><div className="section-kicker">Votre trajectoire</div><h2 id="path-title" className="mb-0 mt-1 text-xl font-black">Mon parcours PEBC</h2></div><Map className="text-[var(--primary)]"/></div>
        <div className="space-y-1">{stages.map((stage, index) => <Link href={stage.href} key={stage.name} className="group flex gap-3 rounded-2xl p-3 transition-colors hover:bg-[var(--muted)]"><div className="flex flex-col items-center"><span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-black ${stage.progress === null ? "bg-[var(--muted)] text-[var(--muted-foreground)]" : "bg-[var(--accent)] text-[var(--primary)]"}`}>{index + 1}</span>{index < stages.length - 1 && <span className="my-1 h-full w-px bg-[var(--border)]"/>}</div><div className="min-w-0 flex-1 pb-3"><strong className="text-sm">{stage.name}</strong><p className="mb-2 mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{stage.description}</p>{stage.progress === null ? <span className="badge">Pas encore évalué</span> : <><div className="progress"><span style={{ width: `${stage.progress}%` }}/></div><div className="mt-1 text-right text-xs font-bold text-[var(--primary)]">{stage.progress}%</div></>}</div></Link>)}</div>
      </section>
    </div>

    <section className="my-6 grid gap-4 md:grid-cols-2" aria-label="Voies de préparation PEBC">
      <PathwayCard eyebrow="Examen d’aptitude" title="Partie I — QCM" description="QCM ciblés, examens blancs, calculs et révision des erreurs." href="/quizzes" icon={<BookOpenCheck/>}/>
      <PathwayCard eyebrow="Examen d’aptitude" title="Partie II — ECOS" description="Stations, communication, jugement clinique, sécurité et feedback." href="/clinical-cases" icon={<CircleDot/>}/>
    </section>

    <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <section className="card p-6 sm:p-7" aria-labelledby="competencies-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><div className="section-kicker">Progression par domaine</div><h2 id="competencies-title" className="mb-0 mt-1 text-xl font-black">Ma carte de compétences</h2></div><Link href="/progress" className="text-sm font-black text-[var(--primary)]">Voir ma progression <ArrowRight className="inline" size={15}/></Link></div>
        {competencies.length === 0 ? <div className="rounded-2xl bg-[var(--muted)] p-6 text-center"><strong>Aucune donnée disponible</strong><p className="mb-0 mt-2 text-sm text-[var(--muted-foreground)]">Les domaines apparaîtront après leur ajout à votre parcours.</p></div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{competencies.map((competency) => <Link href="/progress" key={competency.id} className="rounded-2xl border border-[var(--border)] p-4 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"><div className="mb-3 flex items-start justify-between gap-2"><strong className="text-sm">{competency.name}</strong><span className="badge">{competency.status}</span></div>{competency.progress === null ? <span className="text-xs text-[var(--muted-foreground)]">Pas encore évalué</span> : <><div className="progress"><span style={{ width: `${competency.progress}%`, background: competency.color }}/></div><div className="mt-2 text-right text-xs font-black">{competency.progress}%</div></>}</Link>)}</div>}
      </section>
      <section className="card p-6 sm:p-7" aria-labelledby="challenges-title"><div className="section-kicker">Régularité</div><h2 id="challenges-title" className="mb-5 mt-1 text-xl font-black">Défis & objectif</h2><div className="space-y-3"><GameRow icon={<Flame/>} title="Série d’étude" value="Pas encore évalué"/><GameRow icon={<Star/>} title="XP clinique" value="Pas encore évalué"/><GameRow icon={<Award/>} title="Badges" value="Aucun badge acquis"/><GameRow icon={<Target/>} title="Objectif de la semaine" value="Aucune donnée disponible"/></div></section>
    </div>

    <section className="coach-card mt-6 grid items-center gap-6 overflow-hidden rounded-[26px] border border-emerald-200 p-6 sm:p-8 lg:grid-cols-[auto_1fr_auto]" aria-labelledby="coach-title">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--primary)] text-white"><Bot size={28}/></span><div><div className="section-kicker">Accompagnement pédagogique</div><h2 id="coach-title" className="mb-2 mt-1 text-2xl font-black">Pharmacien Coach</h2><p className="mb-0 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">{activePriority ? `Une priorité enregistrée — ${activePriority.topic} — peut être travaillée dans une session guidée.` : "Aucune recommandation personnalisée n’est encore disponible. Le Coach peut vous accompagner à partir d’un objectif que vous choisissez."}</p></div><Link href="/ai" className="btn btn-primary whitespace-nowrap"><Sparkles size={17}/>Commencer</Link>
    </section>
  </div>;
}

function DiagnosticPage({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="mx-auto max-w-xl"><PageHeader eyebrow={eyebrow} title={title} description={description}/>{action}</div>; }
function NeutralStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5 shadow-sm"><div className="flex items-center gap-1.5 text-xs font-black text-[var(--primary)]">{icon}<span>{label}</span></div><div className="mt-1 max-w-28 truncate text-[.68rem] font-bold text-[var(--muted-foreground)]" title={value}>{value}</div></div>; }
function PathwayCard({ eyebrow, title, description, href, icon }: { eyebrow: string; title: string; description: string; href: string; icon: React.ReactNode }) { return <Link href={href} className="pathway-card group card flex items-center gap-5 p-5 sm:p-6"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent)] text-[var(--primary)]">{icon}</span><div className="min-w-0 flex-1"><div className="text-[.68rem] font-black uppercase tracking-[.18em] text-[var(--primary)]">{eyebrow}</div><h2 className="mb-1 mt-1 text-xl font-black">{title}</h2><p className="m-0 text-sm leading-5 text-[var(--muted-foreground)]">{description}</p></div><ArrowRight className="shrink-0 text-[var(--primary)] transition-transform group-hover:translate-x-1"/></Link>; }
function GameRow({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) { return <div className="flex items-center gap-3 rounded-2xl bg-[var(--muted)] p-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[var(--primary)]">{icon}</span><div className="min-w-0"><div className="text-sm font-black">{title}</div><div className="truncate text-xs text-[var(--muted-foreground)]">{value}</div></div></div>; }
