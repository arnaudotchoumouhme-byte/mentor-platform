// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StudyPlan from "./page";

const mocks = vi.hoisted(() => ({ useAppState: vi.fn() }));
vi.mock("@/hooks/use-state", () => ({ useAppState: mocks.useAppState }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function setup(names: string[]) {
  const act = vi.fn().mockResolvedValue(undefined);
  mocks.useAppState.mockReturnValue({ data: { subjects: names.map((name, id) => ({ id, name })), tasks: [] }, act });
  render(React.createElement(StudyPlan));
  fireEvent.click(screen.getByRole("button", { name: "Ajouter une activité" }));
  fireEvent.change(screen.getByLabelText("Activité"), { target: { value: "Révision clinique" } });
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-09-20" } });
  fireEvent.change(screen.getByLabelText("Durée en minutes"), { target: { value: "45" } });
  return act;
}

describe("Study plan subject entry", () => {
  it.each([
    { names: [], subject: "Système nerveux autonome" },
    { names: ["Cardiologie", "Pharmacologie"], subject: "Pharmacologie" },
    { names: ["Cardiologie"], subject: "Neurologie" },
  ])("submits a text subject with catalogue $names", async ({ names, subject }) => {
    const act = setup(names);
    const field = screen.getByLabelText("Matière") as HTMLInputElement;
    expect(field.tagName).toBe("INPUT");
    expect(field.value).toBe(names[0] ?? "");
    const suggestions = document.getElementById(field.getAttribute("list")!);
    expect(Array.from(suggestions!.querySelectorAll("option")).map(option => option.value)).toEqual(names);
    fireEvent.change(field, { target: { value: subject } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(act).toHaveBeenCalledExactlyOnceWith({ action: "addTask", title: "Révision clinique", subject, date: "2026-09-20", minutes: 45 }));
    await waitFor(() => expect(screen.queryByLabelText("Matière")).toBeNull());
  });
});
