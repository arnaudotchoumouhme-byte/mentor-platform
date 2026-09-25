// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CourseTrainingPanel } from "./course-training-panel";
import { clientFetch } from "@/shared/api/client-fetch";

vi.mock("@/shared/api/client-fetch", () => ({ clientFetch: vi.fn() }));
vi.mock("./mcq-session-runner", () => ({ McqSessionRunner: ({ documentId }: { documentId: number }) => React.createElement("p", {}, `Session cours ${documentId}`) }));
const q = { itemId: "private-item", version: 1, status: "DRAFT", stem: "Question synthétique", choices: ["a", "b", "c", "d"].map(id => ({ id, text: `Choix ${id}` })), correctChoiceId: "a", explanation: "Correction sourcée", reference: "Cours synthétique", mappings: [{ competencyId: "1.1" }] };
const response = (questions: unknown[]) => new Response(JSON.stringify({ name: "Cours synthétique", questions }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe("course review UI", () => {
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
});
