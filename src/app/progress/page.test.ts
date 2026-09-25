// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppState } from "@/hooks/use-state";
import Progress from "./page";

vi.mock("@/hooks/use-state", () => ({ useAppState: vi.fn() }));

const emptyData = {
  subjects: [], documents: [], flashcards: [], questions: [], attempts: [], weaknesses: [], tasks: [], messages: [], settings: {},
};

describe("Progress", () => {
  afterEach(cleanup);

  it("shows STANDARD history, observed progress and linked errors without subjects", () => {
    vi.mocked(useAppState).mockReturnValue({ data: { ...emptyData,
      attempts: [{ id: "mcq:s", session_id: "s", module: "QCM Partie I", subject: "renal", score: 50, question_count: 2, duration_minutes: 4, created_at: "2026-09-25" }],
      mcqErrors: [{ sessionId: "s", itemId: "item", itemVersion: 1, position: 0, answeredAt: "2026-09-25", question: "Question historique", chosenAnswer: "B. Faux", correctAnswer: "A. Exact", topic: "renal" }],
    } } as unknown as ReturnType<typeof useAppState>);
    render(React.createElement(Progress));
    expect(screen.getByText("50% · Résultat observé")).toBeTruthy();
    expect(screen.getByText(/2 questions/)).toBeTruthy();
    expect(screen.getByText("Votre réponse : B. Faux")).toBeTruthy();
    expect(screen.getByText("Bonne réponse : A. Exact")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Revoir la session" }).getAttribute("href")).toBe("/progress/sessions/s");
    expect(screen.getByRole("link", { name: "Revoir" }).getAttribute("href")).toBe("/progress/sessions/s#question-0");
  });

  it("shows honest first-use states without inventing progress", () => {
    vi.mocked(useAppState).mockReturnValue({ data: emptyData } as unknown as ReturnType<typeof useAppState>);
    render(React.createElement(Progress));
    expect(screen.getAllByText("Pas encore évalué")).toHaveLength(2);
    expect(screen.getByText("Aucun résultat enregistré")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Commencer un QCM" }).getAttribute("href")).toBe("/quizzes");
    expect(screen.queryByText("0%")).toBeNull();
  });

  it("renders recorded metrics and history when attempts exist", () => {
    vi.mocked(useAppState).mockReturnValue({ data: {
      ...emptyData,
      subjects: [{ id: 1, name: "SNC", mastery: 75, color: "#177a63" }],
      attempts: [{ id: 1, module: "QCM", subject: "SNC", score: 80, duration_minutes: 12, created_at: "2026-09-01T00:00:00.000Z" }],
    } } as unknown as ReturnType<typeof useAppState>);
    render(React.createElement(Progress));
    expect(screen.getAllByText("80%")).toHaveLength(2);
    expect(screen.getByText("12 min")).toBeTruthy();
    expect(screen.getByText("80% · Résultat observé")).toBeTruthy();
    expect(screen.queryByText(/75%/)).toBeNull();
    expect(screen.queryByText("Aucun résultat enregistré")).toBeNull();
  });
});

afterEach(cleanup);
describe("factual progress", () => {
  it("does not present global subject mastery as the learner's result", () => {
    vi.mocked(useAppState).mockReturnValue({data:{attempts:[], flashcards:[], subjects:[{id:1, name:"Calculs", mastery:99, color:"red"}]}} as unknown as ReturnType<typeof useAppState>);
    render(React.createElement(Progress));
    expect(screen.getByText("Non évalué")).toBeTruthy();
    expect(document.body.textContent).not.toContain("99%");
    expect(document.body.textContent).not.toContain("Maîtrisé");
  });
  it("shows only observed owned results and a neutral first-use state", () => {
    vi.mocked(useAppState).mockReturnValue({data:{attempts:[{id:1,module:"QCM",subject:"Calculs",score:60,duration_minutes:4,created_at:"2026-09-15"}],flashcards:[],subjects:[{id:1,name:"Calculs",mastery:99,color:"red"},{id:2,name:"Autre",mastery:95,color:"red"}]}} as unknown as ReturnType<typeof useAppState>);
    render(React.createElement(Progress));
    expect(screen.getByText("60% · Résultat observé")).toBeTruthy();
    expect(screen.getByText("Non évalué")).toBeTruthy();
    expect(document.body.textContent).not.toContain("99%");
  });
});
