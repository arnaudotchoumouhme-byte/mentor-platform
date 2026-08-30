"use client";

import Link from "next/link";
import { BarChart3, Calculator, FileQuestion, History, Target } from "lucide-react";
import { McqSessionRunner } from "@/components/mcq-session-runner";
import { PageHeader } from "@/components/ui";

export default function Quizzes() {
  return <div className="mx-auto max-w-6xl">
    <PageHeader eyebrow="Parcours PEBC" title="Examen d’aptitude — Partie I (QCM)" description="Regroupez vos entraînements de connaissances, de raisonnement et de calculs dans une même étape du parcours."/>
    <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <HubLink href="#qcm-cibles" icon={<FileQuestion/>} title="QCM ciblés" detail="Corpus versionné et sourcé"/>
      <HubLink href="/mock-exams" icon={<Target/>} title="Examens blancs" detail="Conditions chronométrées"/>
      <HubLink href="/progress" icon={<Calculator/>} title="Calculs pharmaceutiques" detail="Progression enregistrée"/>
      <HubLink href="/weaknesses" icon={<History/>} title="Révision des erreurs" detail="Priorités observées"/>
    </div>
    <section id="qcm-cibles" aria-labelledby="qcm-title">
      <div className="mb-4 flex items-end justify-between gap-4"><div><div className="section-kicker">Entraînement disponible</div><h2 id="qcm-title" className="mb-0 mt-1 text-2xl font-black">QCM ciblés</h2></div><Link href="/progress" className="text-sm font-black text-[var(--primary)]"><BarChart3 className="mr-1 inline" size={16}/>Historique</Link></div>
      <McqSessionRunner/>
    </section>
  </div>;
}

function HubLink({ href, icon, title, detail }: { href: string; icon: React.ReactNode; title: string; detail: string }) {
  return <Link href={href} className="card flex gap-3 p-4 transition hover:-translate-y-0.5 hover:border-emerald-300"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent)] text-[var(--primary)]">{icon}</span><span><strong className="block text-sm">{title}</strong><span className="mt-1 block text-xs leading-5 text-[var(--muted-foreground)]">{detail}</span></span></Link>;
}
