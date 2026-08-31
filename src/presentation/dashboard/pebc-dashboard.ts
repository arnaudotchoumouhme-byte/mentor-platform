import type { AppState } from "@/hooks/use-state";

export type DashboardActivity = Readonly<{
  id: string;
  title: string;
  detail: string;
  meta: string;
  href: string;
}>;

export type DashboardStage = Readonly<{
  name: string;
  description: string;
  href: string;
  progress: number | null;
}>;

export type DashboardCompetency = Readonly<{
  id: number;
  name: string;
  progress: number | null;
  status: string;
  color: string;
}>;

const partOnePattern = /qcm|quiz|examen|calcul/i;
const partTwoPattern = /osce|ecos|clinical|clinique|cas/i;
const foundationPattern = /foundation|fondation|pr[eé]requis/i;

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function attemptAverage(state: AppState, pattern: RegExp): number | null {
  return average(state.attempts.filter((attempt) => pattern.test(attempt.module)).map((attempt) => attempt.score));
}

export function buildDailyMission(state: AppState, now = new Date()): Readonly<{
  activities: readonly DashboardActivity[];
  primaryHref: string;
  rationale: string;
}> {
  const today = now.toISOString().slice(0, 10);
  const activities: DashboardActivity[] = state.tasks
    .filter((task) => task.status !== "done" && task.task_date === today)
    .slice(0, 3)
    .map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      detail: task.subject || "Activité planifiée",
      meta: `${task.minutes} min`,
      href: "/study-plan",
    }));

  const dueFlashcards = state.flashcards.filter((card) => new Date(card.due_at) <= now).length;
  if (dueFlashcards > 0 && activities.length < 4) {
    activities.push({ id: "flashcards", title: "Flashcards à revoir", detail: "Répétition espacée", meta: `${dueFlashcards} carte${dueFlashcards > 1 ? "s" : ""}`, href: "/flashcards" });
  }
  if (state.questions.length > 0 && activities.length < 4) {
    activities.push({ id: "questions", title: "QCM ciblés", detail: "Questions disponibles", meta: `${state.questions.length} question${state.questions.length > 1 ? "s" : ""}`, href: "/quizzes" });
  }

  const priority = state.weaknesses.find((weakness) => weakness.status === "active");
  const rationale = priority
    ? `Une priorité enregistrée dans votre progression guide cette session : ${priority.topic}.`
    : activities.length > 0
      ? "Cette session reprend les activités et révisions actuellement dues dans votre espace."
      : "Aucune recommandation personnalisée n’est disponible pour le moment. Commencez une activité pour alimenter votre parcours.";

  return { activities, primaryHref: activities[0]?.href ?? "/study-plan", rationale };
}

export function buildPebcStages(state: AppState): readonly DashboardStage[] {
  return [
    { name: "Académie des prérequis", description: "Fondations scientifiques et pratique canadienne", href: "/study-plan", progress: attemptAverage(state, foundationPattern) },
    { name: "Partie I — QCM", description: "Connaissances, raisonnement clinique et calculs", href: "/quizzes", progress: attemptAverage(state, partOnePattern) },
    { name: "Partie II — ECOS", description: "Communication, jugement clinique et sécurité", href: "/clinical-cases", progress: attemptAverage(state, partTwoPattern) },
    { name: "Prêt pour l’examen", description: "Objectif final du parcours", href: "/progress", progress: null },
  ];
}

export function buildCompetencies(state: AppState): readonly DashboardCompetency[] {
  return state.subjects.map((subject) => {
    const activePriority = state.weaknesses.find((weakness) => weakness.status === "active" && weakness.subject === subject.name);
    const hasAttempt = state.attempts.some((attempt) => attempt.subject === subject.name);
    const measuredProgress = Number.isFinite(subject.mastery) ? Math.max(0, Math.min(100, subject.mastery)) : null;
    const progress = measuredProgress === 0 && !hasAttempt && !activePriority ? null : measuredProgress;
    const confidence = activePriority?.confidence.toLocaleLowerCase("fr");
    const status = activePriority
      ? confidence === "élevée" || confidence === "elevee" || confidence === "haute" ? "Prioritaire" : "À consolider"
      : progress === null ? "Pas encore évalué" : progress >= 75 ? "Maîtrisé" : progress >= 55 ? "À consolider" : "Fragile";
    return {
      id: subject.id,
      name: subject.name,
      progress,
      status,
      color: subject.color,
    };
  });
}

export function completedActivityCount(state: AppState): number {
  return state.tasks.filter((task) => task.status === "done").length + state.attempts.length;
}
