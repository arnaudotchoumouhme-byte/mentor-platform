export type FlashcardRating =
  | "Très facile"
  | "Facile"
  | "Moyen"
  | "Difficile"
  | "À revoir";

const intervalFactors: Readonly<Record<FlashcardRating, number>> = {
  "Très facile": 2.8,
  Facile: 2.1,
  Moyen: 1.5,
  Difficile: 0.75,
  "À revoir": 0,
};

export function nextInterval(rating: string, current: number) {
  const factor = intervalFactors[rating as FlashcardRating] ?? 1;
  return Math.max(
    rating === "À revoir" ? 0 : 1,
    Math.round(current * factor),
  );
}
