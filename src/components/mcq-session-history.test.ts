// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { McqSessionHistory } from "./mcq-session-history";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("reads the protected history endpoint and renders fixed answers and recorded score without controls", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "COMPLETED", sessionKind: "STANDARD", completedAt: "2026-09-25", score: { percentage: 50, correct: 1, total: 2 }, items: [
    { itemId: "q", itemVersion: 1, position: 0, stem: "Question ancienne", choices: [{ id: "a", text: "Exact" }, { id: "b", text: "Faux" }], answer: { choiceId: "b", correct: false, correctChoiceId: "a", explanation: "Correction détaillée historique" } },
  ] }) });
  vi.stubGlobal("fetch", fetch);
  render(React.createElement(McqSessionHistory, { sessionId: "session" }));
  expect(await screen.findByText("Correction détaillée historique")).toBeTruthy();
  expect(screen.getByText("Score enregistré : 50% · 1/2")).toBeTruthy();
  expect(screen.getByText("Réponse enregistrée : B. Faux")).toBeTruthy();
  expect(screen.getByText("Bonne réponse : A. Exact")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.queryByRole("radio")).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith("/api/mcq/sessions/session/history", expect.objectContaining({ cache: "no-store" }));
});

it("does not show corrections when access is denied", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
  render(React.createElement(McqSessionHistory, { sessionId: "other" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText(/Score enregistré/)).toBeNull();
});
