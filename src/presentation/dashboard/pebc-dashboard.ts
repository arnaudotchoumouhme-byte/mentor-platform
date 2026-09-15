import { isActiveCardDue } from "@/domain/flashcards/scheduling";
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
  cta: string;
}>;

export type DashboardCompetency = Readonly<{
  id: number;
  name: string;
  progress: number | null;
  status: string;
  color: string;
  href: string;
}>;

export type NextBestAction = Readonly<{
  id: string;
  title: string;
  subtitle?: string;
  reason: string;
  href: string;
  activityType: string;
  cta: string;
  durationLabel?: string;
  priority?: "high" | "medium" | "low";
  statusLabel?: string;
}>;

export const priorityLabels = { high: "Priorité élevée", medium: "Priorité moyenne", low: "Priorité basse" } as const;
const priorityOrder = { high: 0, medium: 1, low: 2 } as const;
const taskPriority = (value: string): NextBestAction["priority"] => value === "high" || value === "medium" || value === "low" ? value : undefined;

function actionCandidates(state: AppState, now: Date): NextBestAction[] {
  // Match the learner's calendar day, including evenings west of UTC.
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const actions: NextBestAction[] = [];
  const weakness = state.weaknesses.find(item => item.status === "active");
  if (weakness) actions.push({
    id: `weakness-${weakness.id}`, title: weakness.topic, subtitle: weakness.subject,
    reason: "Une faiblesse active est enregistrée dans ce domaine. Consultez l’action proposée et les observations qui la motivent.",
    href: `/weaknesses#weakness-${weakness.id}`, activityType: "Correction ciblée", cta: "Voir mon action prioritaire", statusLabel: "Faiblesse active",
  });
  const tasks = state.tasks.filter(task => task.status !== "done" && task.task_date === today)
    .sort((a, b) => (priorityOrder[taskPriority(a.priority) ?? "low"]) - (priorityOrder[taskPriority(b.priority) ?? "low"]));
  for (const task of tasks) actions.push({
    id: `task-${task.id}`, title: task.title, subtitle: task.subject || undefined,
    reason: "Cette activité est planifiée aujourd’hui et n’est pas encore terminée.",
    href: `/study-plan#task-${task.id}`, activityType: "Activité planifiée", cta: "Ouvrir mon activité", statusLabel: "À faire aujourd’hui",
    durationLabel: Number.isFinite(task.minutes) && task.minutes > 0 ? `${task.minutes} min` : undefined,
    priority: taskPriority(task.priority),
  });
  const due = state.flashcards.filter(card => isActiveCardDue(card, now));
  if (due.length) actions.push({
    id: "flashcards", title: "Flashcards à revoir", subtitle: `${due.length} carte${due.length > 1 ? "s" : ""} arrivée${due.length > 1 ? "s" : ""} à échéance`,
    reason: "Ces cartes sont arrivées à leur date de révision. Les revoir maintenant vous aide à entretenir vos acquis.",
    href: "/flashcards", activityType: "Mémorisation", cta: "Revoir mes flashcards", statusLabel: "Révision due",
  });
  if (state.mcq?.resumableSessionId) actions.push({
    id: "resume-mcq", title: "Reprendre mon QCM", reason: "Une session QCM non terminée est enregistrée dans votre espace.",
    href: "/quizzes", activityType: "Pratique QCM", cta: "Reprendre ma session",
  });
  if (state.mcq?.available) actions.push({
    id: "questions", title: "QCM disponibles", subtitle: "Corpus versionné disponible",
    reason: "Des questions sont disponibles pour pratiquer et repérer les points à retravailler.",
    href: "/quizzes", activityType: "Pratique QCM", cta: "Commencer mes QCM",
  });
  const lastAttempt = state.attempts.filter(attempt => Number.isFinite(Date.parse(attempt.created_at)))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  if (lastAttempt) actions.push({
    id: "resume", title: "Revenir sur ma dernière activité", subtitle: `${lastAttempt.module} · ${lastAttempt.subject}`,
    reason: "Un résultat est enregistré pour cette activité. Consultez-le pour décider de ce que vous souhaitez retravailler.",
    href: "/progress", activityType: "Bilan et réévaluation", cta: "Consulter mon dernier résultat",
  });
  return actions;
}

const firstAction: NextBestAction = {
  id: "first-step", title: "Choisir mon premier objectif", activityType: "Planification", cta: "Préparer ma première session",
  reason: "Choisissez un objectif et ajoutez une activité à votre plan d’étude pour construire votre première session.", href: "/study-plan",
};

/** Pure projection: no new score, learner record, AI evaluation or MLE scheduler. */
export function buildNextBestAction(state: AppState, now: Date): NextBestAction {
  return actionCandidates(state, now)[0] ?? firstAction;
}

const partOnePattern = /qcm|quiz|examen|calcul/i;
const partTwoPattern = /osce|ecos|clinical|clinique|cas/i;
const foundationPattern = /foundation|fondation|pr[eé]requis/i;

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function attemptAverage(state: AppState, pattern: RegExp): number | null {
  return average(state.attempts.filter((attempt) => pattern.test(attempt.module) && Number.isFinite(attempt.score) && attempt.score >= 0 && attempt.score <= 100).map((attempt) => attempt.score));
}

export function buildDailyMission(state: AppState, now = new Date()): Readonly<{
  activities: readonly DashboardActivity[];
  primaryHref: string;
  rationale: string;
  nextAction: NextBestAction;
}> {
  const candidates = actionCandidates(state, now);
  const nextAction = candidates[0] ?? firstAction;
  const activities = candidates.slice(0, 4).map(action => ({ id: action.id, title: action.title, detail: action.subtitle ?? action.activityType, meta: action.durationLabel ?? action.statusLabel ?? "", href: action.href }));
  return { activities, nextAction, primaryHref: nextAction.href, rationale: nextAction.reason };
}

export function buildPebcStages(state: AppState): readonly DashboardStage[] {
  return [
    { name: "Académie des prérequis", description: "Fondations scientifiques et pratique canadienne — organisez vos activités dans le plan d’étude.", href: "/study-plan", cta: "Planifier mes prérequis", progress: attemptAverage(state, foundationPattern) },
    { name: "Partie I — QCM", description: "Connaissances, raisonnement clinique et calculs", href: "/quizzes", cta: "Explorer les QCM", progress: attemptAverage(state, partOnePattern) },
    { name: "Partie II — ECOS", description: "Communication, jugement clinique et sécurité", href: "/clinical-cases", cta: "Explorer les activités ECOS", progress: attemptAverage(state, partTwoPattern) },
    { name: "Prêt pour l’examen", description: "Objectif final : faire le point sur vos résultats, sans présumer de votre préparation à l’examen.", href: "/progress", cta: "Faire le point", progress: null },
  ];
}

export function buildCompetencies(state: AppState): readonly DashboardCompetency[] {
  return state.subjects.map((subject) => {
    const activePriority = state.weaknesses.find((weakness) => weakness.status === "active" && weakness.subject === subject.name);
    const progress = observedSubjectResult(state, subject.name);
    const confidence = activePriority?.confidence.toLocaleLowerCase("fr");
    const status = activePriority
      ? confidence === "élevée" || confidence === "elevee" || confidence === "haute" ? "Prioritaire" : "À consolider"
      : progress === null ? "Non évalué" : "Résultat observé";
    return {
      id: subject.id,
      name: subject.name,
      progress,
      status,
      color: subject.color,
      href: activePriority ? `/weaknesses#weakness-${activePriority.id}` : `/progress#subject-${subject.id}`,
    };
  }).sort((a, b) => ["Prioritaire", "À consolider", "Non évalué", "Résultat observé"].indexOf(a.status) - ["Prioritaire", "À consolider", "Non évalué", "Résultat observé"].indexOf(b.status));
}

export function completedActivityCount(state: AppState): number {
  return state.tasks.filter((task) => task.status === "done").length + state.attempts.length;
}

/** Descriptive mean of owned attempts, never a mastery estimate. */
export function observedSubjectResult(state: AppState, subject: string): number | null {
  return average(state.attempts.filter(attempt => attempt.subject === subject && Number.isFinite(attempt.score) && attempt.score >= 0 && attempt.score <= 100).map(attempt => attempt.score));
}
