"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Check, Clock3, MessageCircle, Play } from "lucide-react";
import { useAppState } from "@/hooks/use-state";
import { Loading, Metric, Notice, PageHeader } from "@/components/ui";

export default function Dashboard() {
  const { data, error, act } = useAppState();
  if (!data) return <Loading/>;
  const due = data.flashcards.filter((card) => new Date(card.due_at) <= new Date()).length;
  const avg = data.attempts.length ? Math.round(data.attempts.reduce((sum, item) => sum + item.score, 0) / data.attempts.length) : 0;
  const todo = data.tasks.filter((task) => task.status !== "done").slice(0, 4);
  return <div className="mx-auto max-w-7xl">
    <PageHeader eyebrow="Votre espace d’apprentissage" title="Bonjour, prêt à avancer?" description="Un plan clair, fondé sur vos documents et adapté à vos résultats récents." action={<Link href="/ai" className="btn btn-primary"><MessageCircle size={17}/> Poser une question</Link>}/>
    {error && <Notice>{error}</Notice>}
    <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicateurs">
      <Metric label="Progression globale" value={`${avg}%`} detail="Moyenne des activités évaluées"/>
      <Metric label="Temps planifié aujourd’hui" value={`${todo.filter(t => t.task_date === new Date().toISOString().slice(0,10)).reduce((s,t)=>s+t.minutes,0)} min`} detail="Charge conforme à vos disponibilités" tone="blue"/>
      <Metric label="Flashcards à revoir" value={String(due)} detail="Révisions arrivées à échéance" tone="orange"/>
      <Metric label="Lacunes actives" value={String(data.weaknesses.filter(w => w.status === "active").length)} detail="Chacune possède une action concrète"/>
    </section>
    <div className="grid gap-6 xl:grid-cols-[1.35fr_.8fr]">
      <section className="card p-6">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="m-0 text-xl font-black">Plan du jour</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Des blocs courts et réalistes.</p></div><Clock3 className="text-[var(--primary)]"/></div>
        <div className="space-y-3">{todo.map((task, index) => <div key={task.id} className="flex items-center gap-4 rounded-xl border border-[var(--border)] p-4">
          <button aria-label={`Marquer ${task.title} comme terminé`} onClick={() => act({ action: "completeTask", id: task.id, completed: true })} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-white hover:bg-[var(--accent)]"><Check size={16}/></button>
          <div className="min-w-0 flex-1"><div className="font-black">{task.title}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{task.subject} · {task.minutes} min · {index === 0 ? "À faire maintenant" : task.task_date}</div></div>
          <span className="badge">{task.priority}</span>
        </div>)}</div>
      </section>
      <section className="space-y-5">
        <div className="card overflow-hidden p-6 text-white" style={{ background: "var(--primary)" }}><BookOpen className="mb-6 opacity-80"/><div className="text-sm font-bold opacity-75">Recommandation</div><h2 className="mb-2 mt-2 text-2xl font-black">Renforcer la législation</h2><p className="mb-5 text-sm leading-6 opacity-85">Vos résultats récents indiquent une lacune persistante sur le champ d’exercice provincial.</p><Link href="/weaknesses" className="btn bg-white text-[var(--primary)]"><Play size={16}/> Commencer</Link></div>
        <div className="card p-5"><h3 className="mt-0">Accès rapides</h3>{[["/library","Importer un document"],["/quizzes","Lancer un QCM"],["/flashcards","Réviser les cartes"]].map(([href,label]) => <Link key={href} href={href} className="flex items-center justify-between border-t border-[var(--border)] py-3 text-sm font-bold hover:text-[var(--primary)]">{label}<ArrowRight size={16}/></Link>)}</div>
      </section>
    </div>
  </div>;
}
