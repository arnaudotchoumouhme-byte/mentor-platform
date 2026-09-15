// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
    expect(screen.getByRole("heading", { name: "Votre prochaine meilleure action" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Mon parcours PEBC" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Ma carte de compétences" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Pharmacien Coach" })).toBeTruthy();
    expect(screen.queryByText("Pas encore évalué")).toBeNull();
    expect(screen.queryByText("Aucun badge acquis")).toBeNull();
    expect(screen.getByRole("link", { name: "Préparer ma première session" }).getAttribute("href")).toBe("/study-plan");
    const disclosure = screen.getByText("Voir mes repères d’engagement").closest("details")!;
    expect(disclosure.open).toBe(false);
    fireEvent.click(screen.getByText("Voir mes repères d’engagement"));
    expect(disclosure.open).toBe(true);
    expect(disclosure.textContent).toContain("XP clinique");
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
    expect(screen.getByText("70%")).toBeTruthy();
    expect(screen.queryByText("64%")).toBeNull();
    expect(document.body.textContent).not.toContain("Maîtrisé");
    expect(screen.getByText("70% · score moyen enregistré")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir mon action prioritaire" }).getAttribute("href")).toBe("/weaknesses#weakness-1");
    expect(within(screen.getByRole("region", { name: "Votre prochaine meilleure action" })).queryByText("Priorité élevée")).toBeNull();
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

describe("guided dashboard states", () => {
  it.each([
    ["unauthenticated", "Authentification requise"],
    ["access-denied", "Accès refusé"],
    ["quota-exceeded", "Quota atteint"],
    ["network-error", "Chargement impossible"],
    ["server-error", "Chargement impossible"],
    ["conflict", "État incompatible"],
  ])("preserves %s without presenting a fabricated recommendation", (status, title) => {
    const refresh = vi.fn();
    mocks.useAppState.mockReturnValue({ data: null, error: "", status, refresh });
    render(React.createElement(Dashboard));
    expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    expect(screen.queryByText("Votre prochaine meilleure action")).toBeNull();
    if (status === "network-error" || status === "server-error" || status === "conflict") {
      fireEvent.click(screen.getByRole("button"));
      expect(refresh).toHaveBeenCalledOnce();
    }
    if (status === "unauthenticated") expect(screen.getByRole("link", { name: "Se connecter" }).getAttribute("href")).toBe("/auth/login");
    if (status === "access-denied") expect(screen.getByRole("link", { name: "Se déconnecter" }).getAttribute("href")).toBe("/auth/logout");
  });
  it("keeps loading separate from first use", () => {
    mocks.useAppState.mockReturnValue({ status: "loading", data: null });
    render(React.createElement(Dashboard));
    expect(screen.queryByText("Votre prochaine meilleure action")).toBeNull();
    expect(document.body.textContent).toContain("Chargement");
  });
  it.each(["loaded", "loaded-empty"] as const)("offers one first step and all existing paths in %s", status => {
    loaded(empty, status);
    render(React.createElement(Dashboard));
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const hero = screen.getByRole("region", { name: "Votre prochaine meilleure action" });
    expect(within(hero).getByRole("link", { name: "Préparer ma première session" }).getAttribute("href")).toBe("/study-plan");
    expect(within(hero).getByRole("link", { name: /Choisir moi-même/ }).getAttribute("href")).toBe("#explore-activities");
    expect(within(hero).queryByText(/\d+ min|Priorité élevée|\d+%/)).toBeNull();
    const path = screen.getByRole("region", { name: "Mon parcours PEBC" });
    expect(within(path).getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["/study-plan", "/quizzes", "/clinical-cases", "/progress"]);
    expect(within(path).getByText("Planifier mes prérequis")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Explorer les activités" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ouvrir le Coach" }).className).toContain("btn-secondary");
  });
  it("shows the stored task duration and keeps engagement counts out of the header", () => {
    loaded({ ...empty, tasks: [{ id: 7, title: "Révision réelle", subject: "Calculs", task_date: new Date().toLocaleDateString("en-CA"), minutes: 25, priority: "medium", status: "todo" }], attempts: [{ id: 1, module: "QCM", subject: "Calculs", score: 64, duration_minutes: 10, created_at: "2026-08-18" }] });
    render(React.createElement(Dashboard));
    const hero = screen.getByRole("region", { name: "Votre prochaine meilleure action" });
    expect(within(hero).getByText("25 min")).toBeTruthy();
    expect(within(hero).getByText("Priorité moyenne")).toBeTruthy();
    expect(within(hero).getByRole("link", { name: "Ouvrir mon activité" }).getAttribute("href")).toBe("/study-plan#task-7");
    expect(screen.queryByLabelText("Repères d’engagement")).toBeNull();
    expect(screen.getByRole("region", { name: "Défis & objectif" }).textContent).toContain("1 activité terminée");
  });
});
