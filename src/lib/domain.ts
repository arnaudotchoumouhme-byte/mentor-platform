export type DocumentRecord = {
  id: number; name: string; type: string; size: number; subject: string;
  status: string; content: string; archived: number; created_at: string;
};

export type Question = {
  id: number; prompt: string; options: string; answer: number; explanation: string;
  subject: string; difficulty: string; source: string;
};

export function nextInterval(rating: string, current: number) {
  const factors: Record<string, number> = {
    "Très facile": 2.8, Facile: 2.1, Moyen: 1.5, Difficile: 0.75, "À revoir": 0,
  };
  return Math.max(rating === "À revoir" ? 0 : 1, Math.round(current * (factors[rating] ?? 1)));
}

export function masteryLabel(score: number) {
  if (score >= 75) return "Solide";
  if (score >= 55) return "En progression";
  return "À renforcer";
}
