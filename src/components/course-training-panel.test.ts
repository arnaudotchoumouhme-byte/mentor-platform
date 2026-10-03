// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CourseTrainingPanel } from "./course-training-panel";
import { clientFetch } from "@/shared/api/client-fetch";
import type { CourseCoverage } from "@/application/mcq/course-coverage";

vi.mock("@/shared/api/client-fetch", () => ({ clientFetch: vi.fn() }));
vi.mock("./mcq-session-runner", () => ({ McqSessionRunner: ({ documentId }: { documentId: number }) => React.createElement("p", {}, `Session cours ${documentId}`) }));
const q = { itemId: "private-item", version: 1, status: "DRAFT", stem: "Question synthétique", choices: ["a", "b", "c", "d"].map(id => ({ id, text: `Choix ${id}` })), correctChoiceId: "a", explanation: "Correction sourcée", reference: "Cours synthétique", mappings: [{ competencyId: "1.1" }] };
const coverage: CourseCoverage = { pageCount: 10, ranges: [], lastPageCovered: 0, pagesRemaining: 10, publishedQuestions: 0, rejectedQuestions: 0, completed: false, trackingBlocked: false };
const response = (questions: unknown[], overrides: Partial<typeof coverage> = {}) => new Response(JSON.stringify({ name: "Cours synthétique", coverage: { ...coverage, ...overrides }, questions }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe("course review UI", () => {
  it("shows review content and rejects a draft without exposing a study action", async () => {
    const explanation = "Raisonnement du pharmacien\n\nSynthétique\n\nA — VRAI\n\nJustification A\n\nB — FAUX\n\nJustification B\n\nC — FAUX\n\nJustification C\n\nD — FAUX\n\nJustification D";
    vi.mocked(clientFetch).mockResolvedValueOnce(response([{ ...q, explanation }], { ranges: [{ pageStart: 1, pageEnd: 3 }], lastPageCovered: 3, pagesRemaining: 7 })).mockResolvedValueOnce(response([{ ...q, explanation, version: 2, status: "RETIRED" }], { ranges: [{ pageStart: 1, pageEnd: 3 }], lastPageCovered: 3, pagesRemaining: 7, rejectedQuestions: 1 }));
    render(React.createElement(CourseTrainingPanel, { documentId: 1 }));
    expect(await screen.findByText(q.stem)).toBeTruthy();
    for (const id of ["a", "b", "c", "d"]) expect(screen.getByText(`${id.toUpperCase()}. Choix ${id}`)).toBeTruthy();
    expect(screen.getByText("Bonne réponse : A")).toBeTruthy();
    fireEvent.click(screen.getByText("Voir la correction et la provenance"));
    expect(screen.getByText((_content, element) => element?.tagName === "P" && element.textContent === explanation)).toBeTruthy();
    expect(screen.getByText("Référence : Cours synthétique")).toBeTruthy();
    fireEvent.click(screen.getByText("Rejeter"));
    expect(await screen.findByText("Question 1 — Rejetée")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Préparer les 2 questions suivantes" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Question 1" })).queryByText("Valider")).toBeNull();
    expect(screen.queryByText("Commencer l’entraînement")).toBeNull();
    expect(JSON.parse(vi.mocked(clientFetch).mock.calls[1][1]!.body as string)).toEqual({ action: "reject", itemId: q.itemId, expectedVersion: 1 });
    expect(vi.mocked(clientFetch)).toHaveBeenCalledTimes(2);
  });
  it("requests exactly two drafts for human review without publishing", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(response([])).mockResolvedValueOnce(response([q, { ...q, itemId: "second", stem: "Deuxième question" }]));
    render(React.createElement(CourseTrainingPanel, { documentId: 1 }));
    fireEvent.click(await screen.findByRole("button", { name: "Préparer 2 questions" }));
    expect(await screen.findByText("Deuxième question")).toBeTruthy();
    expect(screen.queryByText("Préparer 10 questions")).toBeNull();
    const writes = vi.mocked(clientFetch).mock.calls.filter(([, init]) => init?.method === "POST");
    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toBe("/api/courses/1/training");
    expect(JSON.parse(writes[0][1]!.body as string)).toEqual({ action: "generate", desiredQuestionCount: 2 });
    expect((screen.getByText("Publier les questions validées") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("Commencer l’entraînement")).toBeNull();
  });
  it("requires individual approval and explicit final confirmation, hides technical IDs", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(response([q])).mockResolvedValueOnce(response([{ ...q, version: 2, status: "IN_REVIEW" }])).mockResolvedValueOnce(response([{ ...q, version: 3, status: "PUBLISHED" }]));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(React.createElement(CourseTrainingPanel, { documentId: 1 }));
    expect(await screen.findByText("Question synthétique")).toBeTruthy();
    expect((screen.getByText("Publier les questions validées") as HTMLButtonElement).disabled).toBe(true);
    expect(document.body.textContent).not.toContain("private-item");
    fireEvent.click(screen.getByText("Valider"));
    await waitFor(() => expect((screen.getByText("Publier les questions validées") as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByText("Publier les questions validées"));
    fireEvent.click(await screen.findByText("Commencer l’entraînement"));
    expect(await screen.findByText("Session cours 1")).toBeTruthy();
    expect(JSON.parse(vi.mocked(clientFetch).mock.calls[2][1]!.body as string)).toMatchObject({ action: "publish", confirmReviewed: true });
  });
  it("saves edits as drafts without validating implicitly", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(response([q])).mockResolvedValueOnce(response([{ ...q, stem: "Revu", version: 2 }]));
    render(React.createElement(CourseTrainingPanel, { documentId: 1 }));
    fireEvent.click(await screen.findByText("Modifier"));
    fireEvent.change(screen.getByLabelText("Question"), { target: { value: "Revu" } });
    fireEvent.click(screen.getByText("Enregistrer le brouillon"));
    expect(await screen.findByText("Revu")).toBeTruthy();
    expect(JSON.parse(vi.mocked(clientFetch).mock.calls[1][1]!.body as string)).toMatchObject({ action: "edit", edit: { stem: "Revu" } });
  });
  it("replaces generation with a completed coverage summary", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(response(
      [{ ...q, status: "PUBLISHED" }, { ...q, itemId: "retired", status: "RETIRED" }],
      { ranges: [{ pageStart: 1, pageEnd: 10 }], lastPageCovered: 10, pagesRemaining: 0, publishedQuestions: 1, rejectedQuestions: 1, completed: true },
    ));
    render(React.createElement(CourseTrainingPanel, { documentId: 1 }));
    expect(await screen.findByText("Couverture du cours terminée")).toBeTruthy();
    expect(screen.getByText("10 pages couvertes · 1 questions publiées · 1 questions rejetées")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Préparer/ })).toBeNull();
  });
});
