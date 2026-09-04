// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppState } from "@/hooks/use-state";
import MockExams from "./page";

vi.mock("@/hooks/use-state", () => ({ useAppState: vi.fn() }));

const emptyData = {
  subjects: [], documents: [], flashcards: [], questions: [], attempts: [], weaknesses: [], tasks: [], messages: [], settings: {},
};

function state(value: Partial<ReturnType<typeof useAppState>>) {
  vi.mocked(useAppState).mockReturnValue(value as ReturnType<typeof useAppState>);
}

describe("MockExams", () => {
  afterEach(cleanup);

  it.each([
    ["unauthenticated", "Authentification requise"],
    ["access-denied", "Accès refusé"],
    ["conflict", "État incompatible"],
    ["quota-exceeded", "Quota atteint"],
    ["server-error", "Chargement impossible"],
  ] as const)("leaves loading for the terminal %s state", (status, title) => {
    state({ data: null, status, error: "Erreur sûre", refresh: vi.fn() });
    render(React.createElement(MockExams));
    expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    expect(screen.queryByText("Chargement…")).toBeNull();
  });

  it("shows an actionable empty state without mounting the legacy runner", () => {
    state({ data: emptyData, status: "loaded-empty", error: undefined, refresh: vi.fn(), act: vi.fn() });
    render(React.createElement(MockExams));
    expect(screen.getByRole("heading", { name: "Aucune question disponible" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir la Partie I — QCM" }).getAttribute("href")).toBe("/quizzes");
    expect(screen.queryByText(/Question 1\//)).toBeNull();
  });
});
