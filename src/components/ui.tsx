import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

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

export function Loading() { return <div className="grid min-h-64 place-items-center"><Loader2 className="animate-spin text-[var(--primary)]"/><span className="sr-only">Chargement</span></div>; }
