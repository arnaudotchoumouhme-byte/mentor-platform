// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const data = {
  subjects: [{ id: 1, name: "Matière synthétique", mastery: 0, color: "#000" }],
  documents: [], flashcards: [], questions: [], attempts: [], weaknesses: [], messages: [], settings: {},
  tasks: [{ id: 1, title: "Activité synthétique", subject: "Matière synthétique", task_date: "2026-09-01", minutes: 30, priority: "normal", status: "todo" }],
};
const act = vi.fn(async () => undefined);
vi.mock("@/hooks/use-state", () => ({ useAppState: () => ({ data, act, refresh: vi.fn(async () => undefined) }) }));

import AiPage from "./ai/page";
import SearchPage from "./search/page";
import StudyPlan from "./study-plan/page";

describe("active pilot forms accessibility", () => {
  afterEach(() => { cleanup(); act.mockClear(); });

  it("exposes names for every study-plan field and task action", () => {
    render(React.createElement(StudyPlan));
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une activité" }));
    expect(screen.getByRole("textbox", { name: "Activité" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Matière" })).toBeTruthy();
    expect(screen.getByLabelText("Date")).toBeTruthy();
    expect(screen.getByRole("spinbutton", { name: "Durée en minutes" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Marquer comme terminée : Activité synthétique" })).toBeTruthy();
  });

  it("exposes names for document search controls", () => {
    render(React.createElement(SearchPage));
    expect(screen.getByRole("textbox", { name: "Termes recherchés" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Matière" })).toBeTruthy();
  });

  it("exposes a name for the library question field", () => {
    render(React.createElement(AiPage));
    fireEvent.click(screen.getByRole("button", { name: "Question à la bibliothèque" }));
    expect(screen.getByRole("textbox", { name: "Question à la bibliothèque" })).toBeTruthy();
  });
});
