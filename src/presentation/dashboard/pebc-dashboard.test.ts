import { describe, expect, it } from "vitest";
import type { AppState } from "@/hooks/use-state";
import { buildCompetencies, buildDailyMission, buildPebcStages, completedActivityCount } from "./pebc-dashboard";

const empty: AppState = { subjects: [], documents: [], flashcards: [], questions: [], attempts: [], weaknesses: [], tasks: [], messages: [], settings: {} };

describe("PEBC dashboard projections", () => {
  it("uses neutral states instead of inventing learner progress", () => {
    expect(buildDailyMission(empty, new Date("2026-08-18T12:00:00Z"))).toMatchObject({ activities: [], primaryHref: "/study-plan" });
    expect(buildDailyMission(empty).rationale).toContain("Aucune recommandation personnalisée");
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
    expect(mission.activities.map((activity) => activity.title)).toEqual(["Révision planifiée", "Flashcards à revoir", "QCM ciblés"]);
    expect(mission.rationale).toContain("Unités");
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
    expect(buildCompetencies(state).map((item) => item.status)).toEqual(["Maîtrisé", "À consolider", "Fragile", "Prioritaire", "Pas encore évalué"]);
  });
});
