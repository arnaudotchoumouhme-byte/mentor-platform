"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, Bot, ClipboardCheck, FileQuestion, FolderOpen, GraduationCap, Library, Map, Search, Settings, Sparkles, Stethoscope } from "lucide-react";

const primaryNavigation = [
  ["/", "Aujourd’hui", Sparkles],
  ["/study-plan", "Mon parcours", Map],
  ["/quizzes", "Partie I — QCM", FileQuestion],
  ["/clinical-cases", "Partie II — ECOS", Stethoscope],
  ["/ai", "Pharmacien Coach", Bot],
  ["/progress", "Ma progression", BarChart3],
] as const;

const resourceNavigation = [
  ["/library", "Bibliothèque", Library],
  ["/search", "Recherche", Search],
  ["/flashcards", "Flashcards", BookOpen],
  ["/library?view=sources", "Sources & guidelines", ClipboardCheck],
] as const;

function isActive(pathname: string, href: string): boolean {
  const path = href.split("?")[0];
  return path === "/" ? pathname === path : pathname.startsWith(path);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <>
    <aside className="desktop-sidebar fixed inset-y-0 left-0 z-20 flex w-[272px] flex-col border-r border-[var(--border)] bg-white px-4 py-5">
      <Link href="/" className="mb-7 flex items-center gap-3 px-2 text-xl font-black tracking-tight">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--primary)] text-white shadow-sm"><FolderOpen size={22}/></span>
        <span>Mentor <span className="text-[var(--primary)]">PEBC</span></span>
      </Link>
      <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {primaryNavigation.map(([href, label, Icon]) => {
          const active = isActive(pathname, href);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${active ? "bg-[var(--accent)] text-[var(--primary)]" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"}`}><Icon size={18}/><span>{label}</span></Link>;
        })}
        <div className="mb-1 mt-6 px-3 text-[.68rem] font-black uppercase tracking-[.2em] text-[var(--muted-foreground)]">Ressources</div>
        {resourceNavigation.map(([href, label, Icon]) => {
          const active = isActive(pathname, href);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${active ? "bg-[var(--accent)] text-[var(--primary)]" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"}`}><Icon size={18}/><span>{label}</span></Link>;
        })}
      </nav>
      <Link href="/settings" className="mb-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--muted-foreground)] hover:bg-[var(--muted)]"><Settings size={18}/>Paramètres</Link>
      <div className="rounded-2xl bg-[var(--primary-dark)] p-4 text-white">
        <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-wider"><GraduationCap size={16}/>Pilote fermé</div>
        <p className="m-0 text-xs leading-5 text-white/75">Votre parcours et vos résultats restent associés à votre compte autorisé.</p>
      </div>
    </aside>
    <main className="app-main min-h-screen p-5 sm:p-7 lg:p-10" style={{ marginLeft: 272 }}>{children}</main>
    <nav className="mobile-nav fixed inset-x-3 bottom-3 z-30 hidden items-center justify-around rounded-2xl border border-[var(--border)] bg-white/95 p-2 shadow-xl backdrop-blur" aria-label="Navigation mobile">
      {primaryNavigation.map(([href, label, Icon]) => <Link key={href} href={href} aria-label={label} aria-current={isActive(pathname, href) ? "page" : undefined} className={`rounded-xl p-3 ${isActive(pathname, href) ? "bg-[var(--accent)] text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}><Icon size={20}/></Link>)}
    </nav>
  </>;
}
