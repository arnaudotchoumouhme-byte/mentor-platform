// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppState } from "@/hooks/use-state";
import Flashcards from "./page";
const mocks = vi.hoisted(() => ({ useAppState: vi.fn() }));
vi.mock("@/hooks/use-state", () => ({ useAppState: mocks.useAppState }));
const card = (id: number, status = "active", due_at = "2020-01-01"): AppState["flashcards"][number] => ({id, front: `Recto ${id}`, back: `Verso ${id}`, subject: "Calculs", difficulty: "Moyen", status, due_at, interval_days: 1});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function setup(cards: AppState["flashcards"], fail = false) {
  const data = {flashcards: cards};
  const act = vi.fn(async (input: {id: number; rating: string}) => {
    if (fail) throw new Error("offline");
    if (input.rating !== "À revoir") data.flashcards = data.flashcards.map(item => item.id === input.id ? {...item, due_at: "2099-01-01"} : item);
  });
  mocks.useAppState.mockImplementation(() => ({data, act}));
  render(React.createElement(Flashcards)); return act;
}
async function rate(rating: string, id: number) {
  fireEvent.click(screen.getByText(`Recto ${id}`));
  fireEvent.click(screen.getByRole("button", {name: rating}));
}
describe("Flashcard series", () => {
  it("excludes inactive and future cards", () => {
    setup([card(1, "archived"), card(2, "active", "2099-01-01"), card(3)]);
    expect(screen.getByText("Recto 3")).toBeTruthy();
    expect(screen.getByLabelText("Avancement de la série").textContent).toBe("0 / 1 cartes revues");
  });
  it("keeps the queue and denominator stable after each persisted rating", async () => {
    const act = setup([card(1), card(2), card(3)]);
    await rate("Facile", 1); await screen.findByText("Recto 2");
    expect(screen.getByLabelText("Avancement de la série").textContent).toBe("1 / 3 cartes revues");
    await rate("Difficile", 2); await screen.findByText("Recto 3");
    expect(screen.getByLabelText("Avancement de la série").textContent).toBe("2 / 3 cartes revues");
    await rate("Moyen", 3); await screen.findByText("Série terminée");
    expect(act.mock.calls.map(([input]) => input.id)).toEqual([1,2,3]);
    expect(screen.queryByRole("button", {name: "Revoir les cartes encore dues"})).toBeNull();
  });
  it("keeps Again due without trapping the learner in this series", async () => {
    setup([card(1), card(2)]);
    await rate("À revoir", 1); await screen.findByText("Recto 2");
    await rate("Facile", 2); await screen.findByText("Série terminée");
    fireEvent.click(screen.getByRole("button", {name: "Revoir les cartes encore dues"}));
    expect(screen.getByText("Recto 1")).toBeTruthy();
    expect(screen.getByLabelText("Avancement de la série").textContent).toBe("0 / 1 cartes revues");
  });
  it("does not advance on failure or submit a double rating", async () => {
    const act = setup([card(1)], true);
    fireEvent.click(screen.getByText("Recto 1"));
    const button = screen.getByRole("button", {name: "Facile"}); fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(act).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Avancement de la série").textContent).toBe("0 / 1 cartes revues");
  });
  it("renders an honest empty state and real exit links", () => {
    setup([]); expect(screen.getByText("Aucune révision due")).toBeTruthy();
    expect(screen.getByRole("link", {name: "Retour à l’accueil"}).getAttribute("href")).toBe("/");
  });
});
