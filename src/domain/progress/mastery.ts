export function masteryLabel(score: number) {
  if (score >= 75) return "Solide";
  if (score >= 55) return "En progression";
  return "À renforcer";
}
