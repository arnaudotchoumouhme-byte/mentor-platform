// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientFetch } from "@/shared/api/client-fetch";
import { McqSessionRunner } from "./mcq-session-runner";

vi.mock("@/shared/api/client-fetch", () => ({ clientFetch: vi.fn() }));
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", "x-trace-id": "trace_12345678" } });
describe("McqSessionRunner", () => {
  beforeEach(() => vi.mocked(clientFetch).mockReset());
  afterEach(cleanup);
  it("shows a stable empty state when no published item exists", async () => { vi.mocked(clientFetch).mockResolvedValueOnce(response({ blueprints: [] })); render(React.createElement(McqSessionRunner)); expect(await screen.findByText("Aucune question disponible.")).toBeTruthy(); expect(screen.queryByText(/Chargement du corpus/)).toBeNull(); });
  it("never exposes a correction before submission and reveals it after", async () => { const before = { sessionId: "11111111-1111-4111-8111-111111111111", status: "IN_PROGRESS" as const, items: [{ itemId: "item", itemVersion: 1, position: 0, stem: "Question publiée", choices: [{ id: "a", text: "Choix A" }, { id: "b", text: "Choix B" }], difficulty: "FOUNDATION", answer: null }], score: null }; const after = { ...before, items: [{ ...before.items[0], answer: { choiceId: "a", correct: true, correctChoiceId: "a", explanation: "Explication après réponse" } }] }; vi.mocked(clientFetch).mockResolvedValueOnce(response({ blueprints: [{ blueprintVersionId: "bp", itemCount: 1 }] })).mockResolvedValueOnce(response({ sessionId: before.sessionId }, 201)).mockResolvedValueOnce(response(before)).mockResolvedValueOnce(response(after)); render(React.createElement(McqSessionRunner)); fireEvent.click(await screen.findByRole("button", { name: "Commencer" })); expect(await screen.findByText("Question publiée")).toBeTruthy(); expect(screen.queryByText("Explication après réponse")).toBeNull(); fireEvent.click(screen.getByRole("button", { name: "Choix A" })); expect(await screen.findByText("Explication après réponse")).toBeTruthy(); });
  it("exits loading on unauthorized access", async () => { vi.mocked(clientFetch).mockResolvedValueOnce(response({ error: { code: "PILOT_ACCESS_DENIED", traceId: "trace_12345678" } }, 403)); render(React.createElement(McqSessionRunner)); expect((await screen.findByRole("alert")).textContent).toContain("PILOT_ACCESS_DENIED"); await waitFor(() => expect(screen.queryByText(/Chargement du corpus/)).toBeNull()); });
  it("exits loading when the catalogue resource is missing", async () => { vi.mocked(clientFetch).mockResolvedValueOnce(response({ error: { code: "MCQ_CATALOG_NOT_FOUND", traceId: "trace_12345678" } }, 404)); render(React.createElement(McqSessionRunner)); expect((await screen.findByRole("alert")).textContent).toContain("MCQ_CATALOG_NOT_FOUND"); await waitFor(() => expect(screen.queryByText(/Chargement du corpus/)).toBeNull()); });
  it("exits loading on a network failure", async () => { vi.mocked(clientFetch).mockRejectedValueOnce(new Error("network unavailable")); render(React.createElement(McqSessionRunner)); expect((await screen.findByRole("alert")).textContent).toContain("NET_REQUEST_FAILED"); await waitFor(() => expect(screen.queryByText(/Chargement du corpus/)).toBeNull()); });
});
