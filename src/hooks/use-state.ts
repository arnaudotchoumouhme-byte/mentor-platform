"use client";

import { useCallback, useEffect, useState } from "react";

export type AppState = {
  subjects: Array<{ id: number; name: string; mastery: number; color: string }>;
  documents: Array<{ id: number; name: string; type: string; size: number; subject: string; status: string; content: string; archived: number; created_at: string }>;
  flashcards: Array<{ id: number; front: string; back: string; subject: string; difficulty: string; due_at: string; interval_days: number; status: string }>;
  questions: Array<{ id: number; prompt: string; options: string; answer: number; explanation: string; subject: string; difficulty: string; source: string }>;
  attempts: Array<{ id: number; module: string; subject: string; score: number; duration_minutes: number; created_at: string }>;
  weaknesses: Array<{ id: number; subject: string; topic: string; confidence: string; cause: string; action: string; status: string }>;
  tasks: Array<{ id: number; title: string; subject: string; task_date: string; minutes: number; priority: string; status: string }>;
  messages: Array<{ id: number; role: string; content: string; citations: string }>;
  settings: Record<string, string>;
};

export function useAppState() {
  const [data, setData] = useState<AppState | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try { const response = await fetch("/api/state", { cache: "no-store" }); if (!response.ok) throw new Error(); setData(await response.json()); }
    catch { setError("Impossible de lire les données locales."); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  const act = useCallback(async (payload: object) => { const response = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); if (!response.ok) throw new Error("Action impossible"); await refresh(); }, [refresh]);
  return { data, error, refresh, act };
}
