"use client";

import { useCallback, useEffect, useState } from "react";
import { clientFetch, ClientRequestError } from "@/shared/api/client-fetch";

export type AppState = {
  subjects: Array<{ id: number; name: string; mastery: number; color: string }>;
  documents: Array<{ id: number; name: string; type: string; size: number; subject: string; status: string; content: string; archived: number; created_at: string; source_id: string | null; source_version_id: string | null; provenance_type: string; extraction_status: string; media_type: string | null; language: string | null; page_count: number | null }>;
  flashcards: Array<{ id: number; front: string; back: string; subject: string; difficulty: string; due_at: string; interval_days: number; status: string }>;
  questions: Array<{ id: number; prompt: string; options: string; answer: number; explanation: string; subject: string; difficulty: string; source: string }>;
  attempts: Array<{ id: number; module: string; subject: string; score: number; duration_minutes: number; created_at: string }>;
  weaknesses: Array<{ id: number; subject: string; topic: string; confidence: string; cause: string; action: string; status: string }>;
  tasks: Array<{ id: number; title: string; subject: string; task_date: string; minutes: number; priority: string; status: string }>;
  messages: Array<{ id: number; role: string; content: string; citations: string }>;
  settings: Record<string, string>;
};

export type AppStateStatus = "loading" | "unauthenticated" | "access-denied" | "conflict" | "quota-exceeded" | "loaded-empty" | "loaded" | "network-error" | "server-error";
export type AppStateDiagnostic = Readonly<{ status: AppStateStatus; code?: string; message?: string; traceId?: string; retriable?: boolean }>;

let diagnosticSnapshot: AppStateDiagnostic = { status: "loading" };
const diagnosticListeners = new Set<() => void>();

export function subscribeAppStateDiagnostic(listener: () => void) { diagnosticListeners.add(listener); return () => diagnosticListeners.delete(listener); }
export function getAppStateDiagnostic() { return diagnosticSnapshot; }
function publishDiagnostic(next: AppStateDiagnostic) { diagnosticSnapshot = next; for (const listener of diagnosticListeners) listener(); }

function isEmptyState(data: AppState): boolean {
  return data.subjects.length === 0 && data.documents.length === 0 && data.flashcards.length === 0 && data.questions.length === 0 && data.attempts.length === 0 && data.weaknesses.length === 0 && data.tasks.length === 0 && data.messages.length === 0 && Object.keys(data.settings).length === 0;
}
function statusForHttp(status: number): AppStateStatus { if (status === 401) return "unauthenticated"; if (status === 403) return "access-denied"; if (status === 409) return "conflict"; if (status === 429) return "quota-exceeded"; return "server-error"; }
type FailureBody = { error?: { code?: string; message?: string; traceId?: string; retriable?: boolean } };

export function useAppState() {
  const [data, setData] = useState<AppState | null>(null);
  const [diagnostic, setDiagnostic] = useState<AppStateDiagnostic>({ status: "loading" });
  const setTerminal = useCallback((next: AppStateDiagnostic) => { setDiagnostic(next); publishDiagnostic(next); }, []);
  const refresh = useCallback(async () => {
    const traceId = crypto.randomUUID(); setData(null); setTerminal({ status: "loading", traceId });
    try {
      const response = await clientFetch("/api/state", { cache: "no-store", headers: { "x-trace-id": traceId } });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as FailureBody;
        setTerminal({ status: statusForHttp(response.status), code: body.error?.code ?? `HTTP_${response.status}`, message: body.error?.message ?? "La requête a échoué.", traceId: body.error?.traceId ?? response.headers.get("x-trace-id") ?? traceId, retriable: body.error?.retriable ?? response.status >= 500 }); return;
      }
      const next = await response.json() as AppState; setData(next); setTerminal({ status: isEmptyState(next) ? "loaded-empty" : "loaded", traceId: response.headers.get("x-trace-id") ?? traceId });
    } catch (error) {
      const timedOut = error instanceof ClientRequestError && error.code === "NET_REQUEST_TIMEOUT";
      setTerminal({ status: "network-error", code: timedOut ? "NET_REQUEST_TIMEOUT" : "NET_REQUEST_FAILED", message: timedOut ? "Le serveur n’a pas répondu dans le délai prévu." : "Le serveur est injoignable.", traceId, retriable: true });
    }
  }, [setTerminal]);
  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  const act = useCallback(async (payload: object) => {
    const traceId = crypto.randomUUID();
    try {
      const response = await clientFetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json", "x-trace-id": traceId }, body: JSON.stringify(payload) });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as FailureBody;
        const failure = { status: statusForHttp(response.status), code: body.error?.code ?? `HTTP_${response.status}`, message: body.error?.message ?? "Action impossible.", traceId: body.error?.traceId ?? response.headers.get("x-trace-id") ?? traceId, retriable: body.error?.retriable ?? response.status >= 500 } satisfies AppStateDiagnostic;
        setTerminal(failure); throw new Error(failure.code);
      }
      await refresh();
    } catch (error) {
      if (error instanceof Error && diagnosticSnapshot.traceId === traceId) throw error;
      const timedOut = error instanceof ClientRequestError && error.code === "NET_REQUEST_TIMEOUT";
      setTerminal({ status: "network-error", code: timedOut ? "NET_REQUEST_TIMEOUT" : "NET_REQUEST_FAILED", message: timedOut ? "Le serveur n’a pas répondu dans le délai prévu." : "Le serveur est injoignable.", traceId, retriable: true }); throw error;
    }
  }, [refresh, setTerminal]);
  return { data, error: diagnostic.message ?? "", status: diagnostic.status, diagnostic, refresh, act };
}
