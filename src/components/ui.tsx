"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { getAppStateDiagnostic, subscribeAppStateDiagnostic } from "@/hooks/use-state";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
    <div>{eyebrow && <div className="mb-2 text-xs font-black uppercase tracking-[.18em] text-[var(--primary)]">{eyebrow}</div>}<h1 className="m-0 text-3xl font-black tracking-tight md:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-[var(--muted-foreground)]">{description}</p></div>
    {action}
  </header>;
}

export function Metric({ label, value, detail, tone = "green" }: { label: string; value: string; detail: string; tone?: "green" | "orange" | "blue" }) {
  const colors = { green: "#177a63", orange: "#b86c31", blue: "#596fb2" };
  return <div className="card p-5"><div className="mb-3 text-sm font-bold text-[var(--muted-foreground)]">{label}</div><div className="text-3xl font-black" style={{ color: colors[tone] }}>{value}</div><div className="mt-2 text-xs text-[var(--muted-foreground)]">{detail}</div></div>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="card grid min-h-44 place-items-center p-8 text-center"><div><AlertCircle className="mx-auto mb-3 text-[var(--muted-foreground)]"/><h3 className="m-0">{title}</h3><p className="mb-0 text-sm text-[var(--muted-foreground)]">{detail}</p></div></div>;
}

export function Notice({ children, success = false }: { children: React.ReactNode; success?: boolean }) {
  const Icon = success ? CheckCircle2 : AlertCircle;
  return <div className={`flex gap-2 rounded-xl p-3 text-sm ${success ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}><Icon size={18}/><span>{children}</span></div>;
}

export function Loading() {
  const diagnostic = useSyncExternalStore(subscribeAppStateDiagnostic, getAppStateDiagnostic, getAppStateDiagnostic);
  const retry = <button className="btn btn-primary" onClick={() => window.location.reload()}>Réessayer</button>;
  if (diagnostic.status === "loading") return <div className="grid min-h-64 place-items-center"><Loader2 className="animate-spin text-[var(--primary)]"/><span className="sr-only">Chargement</span></div>;
  if (diagnostic.status === "unauthenticated") return <DiagnosticState title="Authentification requise" detail={diagnostic.message ?? "Connectez-vous pour continuer."} traceId={diagnostic.traceId} action={<Link className="btn btn-primary" href="/auth/login">Se connecter</Link>}/>;
  if (diagnostic.status === "access-denied") return <DiagnosticState title="Accès refusé" detail={diagnostic.message ?? "Votre compte n’est pas autorisé."} traceId={diagnostic.traceId} action={<Link className="btn btn-secondary" href="/auth/logout">Se déconnecter</Link>}/>;
  if (diagnostic.status === "conflict") return <DiagnosticState title="Conflit détecté" detail={diagnostic.message ?? "L’état de la ressource ne permet pas cette opération."} traceId={diagnostic.traceId} action={retry}/>;
  if (diagnostic.status === "quota-exceeded") return <DiagnosticState title="Quota atteint" detail={diagnostic.message ?? "Le quota du pilote est épuisé."} traceId={diagnostic.traceId}/>;
  if (diagnostic.status === "network-error") return <DiagnosticState title="Serveur injoignable" detail={diagnostic.message ?? "Vérifiez la connexion puis réessayez."} traceId={diagnostic.traceId} action={retry}/>;
  if (diagnostic.status === "server-error") return <DiagnosticState title="Service indisponible" detail={diagnostic.message ?? "Une erreur serveur empêche le chargement."} traceId={diagnostic.traceId} action={retry}/>;
  return <DiagnosticState title="Données indisponibles" detail="Les données attendues ne sont pas disponibles." traceId={diagnostic.traceId}/>;
}

function DiagnosticState({title,detail,traceId,action}:{title:string;detail:string;traceId?:string;action?:React.ReactNode}) {
  return <div className="card mx-auto max-w-xl p-6"><AlertCircle className="mb-3 text-amber-700"/><h2>{title}</h2><p>{detail}</p>{traceId&&<p className="text-xs text-[var(--muted-foreground)]">Référence support : <code>{traceId}</code></p>}{action}</div>;
}
