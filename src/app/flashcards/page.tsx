"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { useAppState } from "@/hooks/use-state";
import { isActiveCardDue } from "@/domain/flashcards/scheduling";
import { EmptyState, Loading, PageHeader } from "@/components/ui";

export default function Flashcards() {
  const { data, act } = useAppState();
  const [queue, setQueue] = useState<number[] | null>(null);
  const [reviewed, setReviewed] = useState<number[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  if (!data) return <Loading />;
  const due = data.flashcards.filter(card => isActiveCardDue(card, new Date()));
  // Freeze this series, not the scheduler: cards rated Again remain due for the next series.
  if (queue === null) { setQueue(due.map(card => card.id)); return <Loading />; }
  const remaining = queue.filter(id => !reviewed.includes(id) && due.some(card => card.id === id));
  const card = due.find(card => card.id === remaining[0]);
  const currentData = data;
  async function rate(rating: string) {
    if (!card || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      await act({ action: "reviewCard", id: card.id, rating, interval: card.interval_days });
      setReviewed(previous => [...previous, card.id]); setFlipped(false);
    } catch { setError("La notation n’a pas pu être confirmée. Réessayez avant de poursuivre."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  function restart() {
    setQueue(currentData.flashcards.filter(item => isActiveCardDue(item, new Date())).map(item => item.id));
    setReviewed([]); setFlipped(false); setError("");
  }
  return <div className="mx-auto max-w-4xl">
    <PageHeader eyebrow="Répétition espacée" title="Flashcards" description="Révisez les cartes actives arrivées à échéance. Chaque notation est enregistrée avant de poursuivre." />
    <p aria-label="Avancement de la série" className="text-sm text-[var(--muted-foreground)]">{reviewed.length} / {queue.length} cartes revues</p>
    {error && <p role="alert">{error}</p>}
    {!card ? <>
      <EmptyState title={queue.length ? "Série terminée" : "Aucune révision due"} detail={due.length ? `${due.length} carte(s) restent dues, notamment celles notées « À revoir ». Vous pouvez arrêter ici ou commencer une autre série.` : "Aucune carte active n’est due actuellement. Vous pouvez arrêter ici."} />
      {due.length > 0 && <button className="btn btn-primary mt-4" onClick={restart}>Revoir les cartes encore dues</button>}
      <div className="mt-4 flex gap-3"><Link href="/progress" className="btn btn-secondary">Voir ma progression</Link><Link href="/" className="btn btn-secondary">Retour à l’accueil</Link></div>
    </> : <>
      <div className="mb-3 flex justify-between text-sm text-[var(--muted-foreground)]"><span>Carte suivante</span><span>{card.subject} · {card.difficulty}</span></div>
      <button disabled={busy} onClick={() => setFlipped(!flipped)} className="card grid min-h-80 w-full place-items-center p-10 text-center"><div><span className="badge mb-6">{flipped ? "Verso" : "Recto"}</span><div className="text-2xl font-black leading-9">{flipped ? card.back : card.front}</div><div className="mt-8 flex items-center justify-center gap-2 text-sm text-[var(--muted-foreground)]"><RotateCcw size={16} />Cliquez pour retourner</div></div></button>
      {flipped && <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-5">{["À revoir", "Difficile", "Moyen", "Facile", "Très facile"].map(rating => <button disabled={busy} className="btn btn-secondary text-xs" key={rating} onClick={() => void rate(rating)}>{rating}</button>)}</div>}
    </>}
  </div>;
}
