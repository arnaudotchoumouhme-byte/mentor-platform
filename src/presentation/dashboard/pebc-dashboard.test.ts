import { describe, expect, it } from "vitest";
import type { AppState } from "@/hooks/use-state";
import { buildCompetencies, buildDailyMission, buildNextBestAction, buildPebcStages, completedActivityCount } from "./pebc-dashboard";

const empty: AppState = { subjects: [], documents: [], flashcards: [], questions: [], attempts: [], weaknesses: [], tasks: [], messages: [], settings: {} };

describe("PEBC dashboard projections", () => {
  it("uses neutral states instead of inventing learner progress", () => {
    expect(buildDailyMission(empty, new Date("2026-08-18T12:00:00Z"))).toMatchObject({ activities: [], primaryHref: "/study-plan" });
    expect(buildDailyMission(empty).rationale).toContain("Choisissez un objectif");
    expect(buildPebcStages(empty).every((stage) => stage.progress === null)).toBe(true);
    expect(buildCompetencies(empty)).toEqual([]);
  });

  it("builds today's mission only from persisted tasks, due cards and questions", () => {
    const state: AppState = {
      ...empty,
      tasks: [{ id: 1, title: "Révision planifiée", subject: "Calculs", task_date: "2026-08-18", minutes: 20, priority: "high", status: "todo" }],
      flashcards: [{ id: 2, front: "F", back: "B", subject: "Calculs", difficulty: "Moyen", due_at: "2026-08-17T00:00:00Z", interval_days: 1, status: "active" }],
      questions: [{ id: 3, prompt: "Question issue de la base", options: "[]", answer: 0, explanation: "", subject: "Calculs", difficulty: "Moyen", source: "Source" }],
      weaknesses: [{ id: 4, subject: "Calculs", topic: "Unités", confidence: "Moyenne", cause: "Observation enregistrée", action: "Réviser", status: "active" }],
    };
    const mission = buildDailyMission(state, new Date("2026-08-18T12:00:00Z"));
    expect(mission.activities.map((activity) => activity.title)).toEqual(["Unités", "Révision planifiée", "Flashcards à revoir", "QCM disponibles"]);
    expect(mission.rationale).toContain("faiblesse active");
    expect(mission.primaryHref).toBe("/weaknesses#weakness-4");
  });

  it("derives pathway scores and competencies exclusively from stored observations", () => {
    const state: AppState = {
      ...empty,
      subjects: [{ id: 1, name: "Calculs", mastery: 62, color: "#177a63" }, { id: 2, name: "Leadership", mastery: 0, color: "#596fb2" }],
      attempts: [
        { id: 1, module: "QCM", subject: "Calculs", score: 60, duration_minutes: 10, created_at: "2026-08-18" },
        { id: 2, module: "Calculations", subject: "Calculs", score: 80, duration_minutes: 10, created_at: "2026-08-18" },
      ],
      weaknesses: [{ id: 1, subject: "Calculs", topic: "Unités", confidence: "Moyenne", cause: "Observation", action: "Réviser", status: "active" }],
      tasks: [{ id: 1, title: "Terminé", subject: "Calculs", task_date: "2026-08-18", minutes: 10, priority: "low", status: "done" }],
    };
    expect(buildPebcStages(state)[1].progress).toBe(70);
    expect(buildPebcStages(state)[2].progress).toBeNull();
    expect(buildCompetencies(state)[0]).toMatchObject({ progress: 62, status: "À consolider" });
    expect(buildCompetencies(state)[1]).toMatchObject({ progress: null, status: "Pas encore évalué" });
    expect(completedActivityCount(state)).toBe(3);
  });

  it("distinguishes the five requested competency states from real evidence", () => {
    const subjects = [
      { id: 1, name: "Maîtrise", mastery: 82, color: "#177a63" },
      { id: 2, name: "Consolidation", mastery: 63, color: "#177a63" },
      { id: 3, name: "Fragilité", mastery: 41, color: "#177a63" },
      { id: 4, name: "Priorité", mastery: 50, color: "#177a63" },
      { id: 5, name: "Sans mesure", mastery: 0, color: "#177a63" },
    ];
    const state: AppState = {
      ...empty,
      subjects,
      attempts: subjects.slice(0, 4).map((subject, index) => ({ id: index, module: "QCM", subject: subject.name, score: subject.mastery, duration_minutes: 5, created_at: "2026-08-18" })),
      weaknesses: [{ id: 1, subject: "Priorité", topic: "Observation", confidence: "Élevée", cause: "Observation", action: "Réviser", status: "active" }],
    };
    expect(buildCompetencies(state).map((item) => item.status)).toEqual(["Prioritaire", "Fragile", "À consolider", "Pas encore évalué", "Maîtrisé"]);
    expect(buildCompetencies(state).map(item => [item.id, item.progress])).toEqual([[4, 50], [3, 41], [2, 63], [5, null], [1, 82]]);
  });
});

describe("next best action priority", () => {
  const now = new Date(2026, 7, 18, 12);
  const state: AppState = {
    ...empty,
    weaknesses: [{ id: 1, subject: "Calculs", topic: "Conversions", confidence: "Élevée", cause: "Observations", action: "Réviser les unités", status: "active" }],
    tasks: [{ id: 2, title: "Révision planifiée", subject: "Calculs", task_date: "2026-08-18", minutes: 20, priority: "high", status: "todo" }],
    flashcards: [{ id: 3, front: "Question", back: "Réponse", subject: "Calculs", difficulty: "Moyen", due_at: "2026-08-17T00:00:00Z", interval_days: 1, status: "active" }],
    questions: [{ id: 4, prompt: "Question", options: "[]", answer: 0, explanation: "", subject: "Calculs", difficulty: "Moyen", source: "Source" }],
    attempts: [{ id: 5, module: "QCM", subject: "Calculs", score: 62, duration_minutes: 35, created_at: "2026-08-17" }],
  };
  it.each([
    [[], "weakness-1", "/weaknesses#weakness-1"],
    [["weaknesses"], "task-2", "/study-plan#task-2"],
    [["weaknesses", "tasks"], "flashcards", "/flashcards"],
    [["weaknesses", "tasks", "flashcards"], "questions", "/quizzes"],
    [["weaknesses", "tasks", "flashcards", "questions"], "resume", "/progress"],
    [["weaknesses", "tasks", "flashcards", "questions", "attempts"], "first-step", "/study-plan"],
  ])("selects %s → %s ahead of all remaining choices", (removed, id, href) => {
    const input = { ...state, ...Object.fromEntries(removed.map(key => [key, []])) };
    const before = JSON.stringify(input);
    const action = buildNextBestAction(input, now);
    expect(action).toMatchObject({ id, href });
    expect(buildDailyMission(input, now).nextAction).toEqual(action);
    expect(buildDailyMission(input, now).rationale).toBe(action.reason);
    expect(JSON.stringify(input)).toBe(before);
  });
  it("does not turn confidence or historical duration into a recommendation priority or duration", () => {
    expect(buildNextBestAction(state, now)).toMatchObject({ statusLabel: "Faiblesse active" });
    expect(buildNextBestAction(state, now).priority).toBeUndefined();
    expect(buildNextBestAction(state, now).durationLabel).toBeUndefined();
    expect(buildNextBestAction({ ...empty, attempts: state.attempts }, now).durationLabel).toBeUndefined();
    expect(buildNextBestAction({ ...empty, tasks: state.tasks }, now)).toMatchObject({ priority: "high", durationLabel: "20 min" });
  });
  it("ignores resolved weaknesses, finished/off-day tasks, inactive/future cards and invalid history dates", () => {
    const action = buildNextBestAction({ ...empty,
      weaknesses: state.weaknesses.map(w => ({ ...w, status: "resolved" })),
      tasks: [{ ...state.tasks[0], status: "done" }, { ...state.tasks[0], id: 6, task_date: "2026-08-19" }],
      flashcards: [{ ...state.flashcards[0], status: "archived" }, { ...state.flashcards[0], id: 7, due_at: "2027-01-01" }],
      attempts: [{ ...state.attempts[0], created_at: "invalid" }],
    }, now);
    expect(action.id).toBe("first-step");
  });
  it("sorts today's tasks by recorded priority without fabricating missing metadata", () => {
    const action = buildNextBestAction({ ...empty, tasks: [{ ...state.tasks[0], id: 7, priority: "low" }, state.tasks[0]] }, now);
    expect(action.id).toBe("task-2");
    const unknown = buildNextBestAction({ ...empty, tasks: [{ ...state.tasks[0], priority: "unknown", minutes: 0 }] }, now);
    expect(unknown.priority).toBeUndefined();
    expect(unknown.durationLabel).toBeUndefined();
  });
  it("uses the supplied local calendar day and the latest valid attempt", () => {
    expect(buildNextBestAction({ ...empty, tasks: state.tasks }, new Date(2026, 7, 18, 23, 30)).id).toBe("task-2");
    expect(buildNextBestAction({ ...empty, attempts: [state.attempts[0], { ...state.attempts[0], id: 9, module: "ECOS", created_at: "2026-08-18" }] }, now).subtitle).toBe("ECOS · Calculs");
  });
  it("keeps prerequisite planning explicit and links competencies to an existing destination", () => {
    expect(buildPebcStages(empty)[0]).toMatchObject({ href: "/study-plan", cta: "Planifier mes prérequis" });
    expect(buildCompetencies({ ...state, subjects: [{ id: 9, name: "Calculs", mastery: 62, color: "#177a63" }] })[0].href).toBe("/weaknesses#weakness-1");
    expect(buildCompetencies({ ...empty, subjects: [{ id: 9, name: "Calculs", mastery: 62, color: "#177a63" }] })[0].href).toBe("/progress#subject-9");
  });
});
