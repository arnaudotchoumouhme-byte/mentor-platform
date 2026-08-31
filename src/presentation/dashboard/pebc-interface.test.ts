// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppState } from "@/hooks/use-state";

const mocks = vi.hoisted(() => ({ useAppState: vi.fn(), pathname: vi.fn(() => "/") }));
vi.mock("@/hooks/use-state", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/hooks/use-state")>()), useAppState: mocks.useAppState }));
vi.mock("next/navigation", () => ({ usePathname: mocks.pathname }));
vi.mock("@/components/mcq-session-runner", () => ({ McqSessionRunner: () => React.createElement("div", null, "Aucune question disponible.") }));

import Dashboard from "@/app/page";
import ClinicalCases from "@/app/clinical-cases/page";
import Quizzes from "@/app/quizzes/page";
import { AppShell } from "@/components/app-shell";

const empty: AppState = { subjects: [], documents: [], flashcards: [], questions: [], attempts: [], weaknesses: [], tasks: [], messages: [], settings: {} };

function loaded(data: AppState, status: "loaded" | "loaded-empty" = "loaded") {
  mocks.useAppState.mockReturnValue({ data, error: "", status, refresh: vi.fn(), act: vi.fn() });
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("PEBC learner interface", () => {
  it("exposes the learner-oriented navigation and resource section", () => {
    render(React.createElement(AppShell, null, React.createElement("div", null, "content")));
    const navigation = screen.getByRole("navigation", { name: "Navigation principale" });
    for (const label of ["Aujourd’hui", "Mon parcours", "Partie I — QCM", "Partie II — ECOS", "Pharmacien Coach", "Ma progression", "Bibliothèque", "Recherche", "Flashcards", "Sources & guidelines"]) {
      expect(navigation.textContent).toContain(label);
    }
    expect(navigation.textContent).not.toContain("Professeur IA");
  });

  it("renders a complete neutral dashboard without fabricated learner data", () => {
    loaded(empty, "loaded-empty");
    render(React.createElement(Dashboard));
    expect(screen.getByRole("heading", { name: "Votre session, simple et ciblée" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Mon parcours PEBC" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Ma carte de compétences" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Pharmacien Coach" })).toBeTruthy();
    expect(screen.getAllByText("Pas encore évalué").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Aucun badge acquis").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain("% de chances");
    expect(document.body.textContent).not.toContain("Renforcer la législation");
  });

  it("shows only persisted mission, competency and progression observations", () => {
    loaded({
      ...empty,
      subjects: [{ id: 1, name: "Calculs", mastery: 64, color: "#177a63" }],
      attempts: [{ id: 1, module: "QCM", subject: "Calculs", score: 70, duration_minutes: 12, created_at: "2026-08-18" }],
      weaknesses: [{ id: 1, subject: "Calculs", topic: "Conversions", confidence: "Moyenne", cause: "Observation", action: "Réviser", status: "active" }],
      tasks: [{ id: 1, title: "Activité réellement planifiée", subject: "Calculs", task_date: new Date().toISOString().slice(0, 10), minutes: 15, priority: "high", status: "todo" }],
    });
    render(React.createElement(Dashboard));
    expect(screen.getByText("Activité réellement planifiée")).toBeTruthy();
    expect(screen.getAllByText("Conversions", { exact: false }).length).toBe(2);
    expect(screen.getByText("64%")).toBeTruthy();
    expect(screen.getByText("70%")).toBeTruthy();
  });

  it("presents Part I and Part II hubs while removing the former hardcoded clinical case", () => {
    loaded(empty);
    const partOne = render(React.createElement(Quizzes));
    expect(screen.getByRole("heading", { name: "Examen d’aptitude — Partie I (QCM)" })).toBeTruthy();
    expect(screen.getByText("Aucune question disponible.")).toBeTruthy();
    partOne.unmount();
    render(React.createElement(ClinicalCases));
    expect(screen.getByRole("heading", { name: "Examen d’aptitude — Partie II (ECOS)" })).toBeTruthy();
    expect(screen.getByText("Stations ECOS")).toBeTruthy();
    expect(document.body.textContent).not.toContain("Mme L.");
    expect(document.body.textContent).not.toContain("bêtabloquant");
  });
});
