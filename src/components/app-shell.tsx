"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, BookOpen, BrainCircuit, CalendarDays, FileQuestion, FolderOpen,
  GraduationCap, Library, MessageCircle, Search, Settings, Sparkles, Stethoscope,
} from "lucide-react";

const navigation = [
  ["/", "Aujourd’hui", Sparkles], ["/library", "Bibliothèque", Library], ["/search", "Recherche", Search],
  ["/ai", "Professeur IA", MessageCircle], ["/quizzes", "QCM", FileQuestion],
  ["/clinical-cases", "Cas cliniques", Stethoscope], ["/flashcards", "Flashcards", BookOpen],
  ["/progress", "Progression", BarChart3], ["/weaknesses", "Lacunes", BrainCircuit],
  ["/study-plan", "Plan d’étude", CalendarDays], ["/mock-exams", "Examens blancs", GraduationCap],
  ["/settings", "Paramètres", Settings],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <>
    <aside className="desktop-sidebar fixed inset-y-0 left-0 z-20 flex w-[255px] flex-col border-r border-[var(--border)] bg-white px-4 py-5">
      <Link href="/" className="mb-8 flex items-center gap-3 px-2 text-xl font-black tracking-tight">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary)] text-white"><FolderOpen size={21}/></span>
        Mentor <span className="text-[var(--primary)]">PEBC</span>
      </Link>
      <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {navigation.map(([href, label, Icon]) => {
          const active = pathname === href;
          return <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold ${active ? "bg-[var(--accent)] text-[var(--primary)]" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"}`}>
            <Icon size={18}/>{label}
          </Link>;
        })}
      </nav>
      <div className="card mt-4 p-4">
        <div className="mb-1 text-xs font-black uppercase tracking-wider text-[var(--primary)]">Mode local</div>
        <p className="m-0 text-xs leading-5 text-[var(--muted-foreground)]">Vos données restent sur cet ordinateur. Les fonctions essentielles restent disponibles hors ligne.</p>
      </div>
    </aside>
    <main className="app-main min-h-screen p-6 md:p-10" style={{ marginLeft: 255 }}>{children}</main>
    <nav className="mobile-nav fixed inset-x-3 bottom-3 z-30 hidden items-center justify-around rounded-2xl border border-[var(--border)] bg-white p-2 shadow-xl" aria-label="Navigation mobile">
      {navigation.slice(0, 5).map(([href, label, Icon]) => <Link key={href} href={href} aria-label={label} className={`rounded-xl p-3 ${pathname === href ? "bg-[var(--accent)] text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}><Icon size={20}/></Link>)}
    </nav>
  </>;
}
