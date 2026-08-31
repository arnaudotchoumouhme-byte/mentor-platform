"use client";

import Link from "next/link";
import { Bot, MessageCircle, ShieldCheck, Stethoscope, UserRoundCheck } from "lucide-react";
import { PageHeader } from "@/components/ui";

export default function ClinicalCases() {
  return <div className="mx-auto max-w-6xl">
    <PageHeader eyebrow="Parcours PEBC" title="Examen d’aptitude — Partie II (ECOS)" description="Préparez les stations, la communication, le jugement clinique et la sécurité dans un parcours cohérent."/>
    <div className="grid gap-5 md:grid-cols-2">
      <EcosCard icon={<Stethoscope/>} title="Stations ECOS" detail="Les stations versionnées disponibles dans votre espace alimentent les séances et leur historique." state="Aucune donnée disponible"/>
      <EcosCard icon={<MessageCircle/>} title="Communication patient" detail="Structurez votre communication et utilisez le teach-back dans une session guidée." state="Commencer" href="/ai"/>
      <EcosCard icon={<ShieldCheck/>} title="Jugement clinique & sécurité" detail="Travaillez le raisonnement et la priorisation sans contenu clinique inventé par cette page." state="Commencer" href="/ai"/>
      <EcosCard icon={<UserRoundCheck/>} title="Feedback & progression" detail="Consultez uniquement les évaluations réellement enregistrées dans votre historique." state="Pas encore évalué" href="/progress"/>
    </div>
    <section className="coach-card mt-6 flex flex-wrap items-center justify-between gap-5 rounded-[24px] border border-emerald-200 p-6">
      <div className="flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--primary)] text-white"><Bot/></span><div><div className="section-kicker">Entraînement guidé</div><h2 className="mb-1 mt-1 text-xl font-black">Pharmacien Coach</h2><p className="m-0 text-sm text-[var(--muted-foreground)]">Choisissez vous-même un objectif pour commencer un cas synthétique contrôlé.</p></div></div>
      <Link href="/ai" className="btn btn-primary">Commencer</Link>
    </section>
  </div>;
}

function EcosCard({ icon, title, detail, state, href }: { icon: React.ReactNode; title: string; detail: string; state: string; href?: string }) {
  const content = <><div className="flex items-start justify-between gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent)] text-[var(--primary)]">{icon}</span><span className="badge">{state}</span></div><h2 className="mb-2 mt-5 text-xl font-black">{title}</h2><p className="mb-0 text-sm leading-6 text-[var(--muted-foreground)]">{detail}</p></>;
  return href ? <Link href={href} className="card p-6 transition hover:-translate-y-0.5 hover:border-emerald-300">{content}</Link> : <article className="card p-6">{content}</article>;
}
