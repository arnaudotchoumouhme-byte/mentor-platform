"use client";

import { useRef, useState } from "react";
import { Database, Download, Save, ShieldCheck } from "lucide-react";
import { useAppState } from "@/hooks/use-state";
import { Loading, Notice, PageHeader } from "@/components/ui";

export default function Settings() {
  const { data, act } = useAppState();
  if (!data) return <Loading />;
  return <SettingsForm key={JSON.stringify(data.settings)} initial={data.settings} act={act} />;
}

export function SettingsForm({ initial, act }: { initial: Record<string, string>; act: (payload: object) => Promise<void> }) {
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [failure, setFailure] = useState(false);
  const [busy, setBusy] = useState(false);
  const saveInFlight = useRef(false);

  function update(key: string, value: string) {
    setSaved(false);
    setFailure(false);
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setBusy(true);
    setSaved(false);
    setFailure(false);
    try {
      await act({ action: "saveSettings", settings: form });
      setSaved(true);
    } catch {
      setFailure(true);
    } finally {
      saveInFlight.current = false;
      setBusy(false);
    }
  }

  return <div className="mx-auto max-w-5xl">
    <PageHeader eyebrow="SCR-012 · Contrôle local" title="Paramètres" description="Configurez votre profil, votre examen et les garde-fous de coût sans exposer de secret au navigateur." />
    {saved && <div className="mb-5" role="status"><Notice success>Paramètres enregistrés.</Notice></div>}
    {failure && <div className="mb-5" role="alert"><Notice>Enregistrement impossible. Réessayez.</Notice></div>}
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-2">
      <section className="card p-6"><h2 className="mt-0">Profil d’apprentissage</h2><label className="mb-4 block"><span className="label">Nom affiché</span><input className="field" value={form.displayName ?? ""} onChange={(event) => update("displayName", event.target.value)} disabled={busy} /></label><label className="mb-4 block"><span className="label">Langue préférée</span><select className="field" value={form.language ?? "fr"} onChange={(event) => update("language", event.target.value)} disabled={busy}><option value="fr">Français</option><option value="en">English</option></select></label><label className="block"><span className="label">Date cible de l’examen</span><input type="date" className="field" value={form.examDate ?? ""} onChange={(event) => update("examDate", event.target.value)} disabled={busy} /></label></section>
      <section className="card p-6"><h2 className="mt-0">Intelligence artificielle</h2><label className="mb-4 block"><span className="label">Fournisseur</span><select className="field" value={form.aiProvider ?? "Mode local"} onChange={(event) => update("aiProvider", event.target.value)} disabled={busy}><option>Mode local</option><option disabled>OpenAI (clé serveur requise)</option><option disabled>Gemini (à configurer)</option></select></label><label className="block"><span className="label">Budget quotidien maximal (CAD)</span><input type="number" min="0" step="0.25" className="field" value={form.dailyBudget ?? "2.00"} onChange={(event) => update("dailyBudget", event.target.value)} disabled={busy} /></label><div className="mt-4"><Notice>Les clés API doivent être placées dans .env.local. Elles ne sont jamais enregistrées dans l’interface.</Notice></div></section>
      <button className="btn btn-primary lg:col-span-2" disabled={busy}><Save size={16} />{busy ? "Enregistrement…" : "Enregistrer les paramètres"}</button>
    </form>
    <div className="mt-6 grid gap-5 md:grid-cols-3"><div className="card p-5"><Database className="mb-4 text-[var(--primary)]" /><h3>Base applicative</h3><p className="text-sm text-[var(--muted-foreground)]">SQLite, journal WAL et intégrité référentielle activée.</p></div><div className="card p-5"><ShieldCheck className="mb-4 text-[var(--primary)]" /><h3>Confidentialité</h3><p className="text-sm text-[var(--muted-foreground)]">Aucun document complet n’est envoyé ou journalisé sans action explicite.</p></div><div className="card p-5"><Download className="mb-4 text-[var(--primary)]" /><h3>Sauvegarde</h3><p className="text-sm text-[var(--muted-foreground)]">Utilisez la procédure de sauvegarde documentée lorsque l’application est arrêtée.</p></div></div>
  </div>;
}
