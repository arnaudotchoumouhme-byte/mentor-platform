// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientFetch } from "@/shared/api/client-fetch";
import { McqSessionRunner } from "./mcq-session-runner";

vi.mock("@/shared/api/client-fetch", () => ({ clientFetch: vi.fn() }));
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", "x-trace-id": "trace_12345678" } });
const failure = (status: number, code: string, retriable = false) => response({ error: { code, traceId: "trace_12345678", retriable } }, status);
const sessionId = "11111111-1111-4111-8111-111111111111";
const choices = [{ id: "a", text: "Choix A" }, { id: "b", text: "Choix B" }, { id: "c", text: "Choix C" }, { id: "d", text: "Choix D" }];
const before = { sessionId, status: "IN_PROGRESS" as const, items: [{ itemId: "item", itemVersion: 1, position: 0, stem: "Question publiée", choices, difficulty: "FOUNDATION", answer: null }], score: null };
const after = { ...before, items: [{ ...before.items[0], answer: { choiceId: "a", correct: true, correctChoiceId: "a", explanation: "Explication après réponse" } }] };

function catalog() { return response({ blueprints: [{ blueprintVersionId: "bp", itemCount: 1 }] }); }
function catalogWithResume() { return response({ blueprints: [{ blueprintVersionId: "bp", itemCount: 1 }], resumableSession: { sessionId } }); }
function emptyCatalogWithResume() { return response({ blueprints: [], resumableSession: { sessionId } }); }
function sessionPosts() { return vi.mocked(clientFetch).mock.calls.filter(([url, init]) => url === "/api/mcq/sessions" && init?.method === "POST"); }
function answerPosts() { return vi.mocked(clientFetch).mock.calls.filter(([url]) => String(url).endsWith("/answers")); }
async function startSession() { fireEvent.click(await screen.findByRole("button", { name: "Commencer" })); expect(await screen.findByText("Question publiée")).toBeTruthy(); }

describe("McqSessionRunner", () => {
  beforeEach(() => vi.mocked(clientFetch).mockReset());
  afterEach(cleanup);

  it("keeps the normal flow and answer-key boundary unchanged", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(catalog()).mockResolvedValueOnce(response({ sessionId }, 201)).mockResolvedValueOnce(response(before)).mockResolvedValueOnce(response(after));
    render(React.createElement(McqSessionRunner)); await startSession();
    expect(screen.getAllByRole("button", { name: /^[A-D]\. / })).toHaveLength(4);
    expect(screen.queryByText("Explication après réponse")).toBeNull();
    expect(JSON.stringify(before)).not.toContain("correctChoiceId");
    fireEvent.click(screen.getByRole("button", { name: "A. Choix A" }));
    expect(await screen.findByText("Explication après réponse")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("status")));
  });

  it("reconciles a created session when the POST response is lost without creating another", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(catalog()).mockRejectedValueOnce(new Error("response lost")).mockResolvedValueOnce(response(before));
    render(React.createElement(McqSessionRunner)); await startSession();
    expect(sessionPosts()).toHaveLength(1);
  });

  it("reuses the same client session id only after reconciliation confirms no creation", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(catalog()).mockRejectedValueOnce(new Error("response lost")).mockResolvedValueOnce(failure(404, "MCQ_SESSION_NOT_FOUND")).mockResolvedValueOnce(response({ sessionId }, 201)).mockResolvedValueOnce(response(before));
    render(React.createElement(McqSessionRunner));
    fireEvent.click(await screen.findByRole("button", { name: "Commencer" }));
    const retry = await screen.findByRole("button", { name: "Réessayer en sécurité" });
    const firstId = JSON.parse(String(sessionPosts()[0]?.[1]?.body)).sessionId;
    fireEvent.click(retry); await screen.findByText("Question publiée");
    const secondId = JSON.parse(String(sessionPosts()[1]?.[1]?.body)).sessionId;
    expect(secondId).toBe(firstId); expect(sessionPosts()).toHaveLength(2);
  });

  it("reconciles an answer recorded before its response was lost without resubmitting", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(catalog()).mockResolvedValueOnce(response({ sessionId }, 201)).mockResolvedValueOnce(response(before)).mockRejectedValueOnce(new Error("response lost")).mockResolvedValueOnce(response(after));
    render(React.createElement(McqSessionRunner)); await startSession();
    fireEvent.click(screen.getByRole("button", { name: "A. Choix A" }));
    expect(await screen.findByText("Explication après réponse")).toBeTruthy();
    expect(answerPosts()).toHaveLength(1); expect(screen.queryByRole("button", { name: "Réessayer la réponse" })).toBeNull();
  });

  it("allows one explicit retry only after reconciliation confirms the answer is absent", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(catalog()).mockResolvedValueOnce(response({ sessionId }, 201)).mockResolvedValueOnce(response(before)).mockRejectedValueOnce(new Error("request failed")).mockResolvedValueOnce(response(before)).mockResolvedValueOnce(response(after));
    render(React.createElement(McqSessionRunner)); await startSession();
    fireEvent.click(screen.getByRole("button", { name: "A. Choix A" }));
    const retry = await screen.findByRole("button", { name: "Réessayer la réponse" });
    expect(answerPosts()).toHaveLength(1); fireEvent.click(retry);
    expect(await screen.findByText("Explication après réponse")).toBeTruthy(); expect(answerPosts()).toHaveLength(2);
  });

  it("reconciles a 409 answer conflict instead of blindly retrying", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(catalog()).mockResolvedValueOnce(response({ sessionId }, 201)).mockResolvedValueOnce(response(before)).mockResolvedValueOnce(failure(409, "MCQ_ANSWER_DUPLICATE")).mockResolvedValueOnce(response(after));
    render(React.createElement(McqSessionRunner)); await startSession();
    fireEvent.click(screen.getByRole("button", { name: "A. Choix A" }));
    expect(await screen.findByText("Explication après réponse")).toBeTruthy(); expect(answerPosts()).toHaveLength(1);
  });

  it.each([[403, "PILOT_ACCESS_DENIED"], [404, "MCQ_CATALOG_NOT_FOUND"]] as const)("treats catalogue HTTP %s as a safe exit without blind retry", async (status, code) => {
    vi.mocked(clientFetch).mockResolvedValueOnce(failure(status, code)); render(React.createElement(McqSessionRunner));
    expect((await screen.findByRole("alert")).textContent).toContain(code);
    expect(screen.getByRole("link", { name: "Sortir en sécurité" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Réessayer/ })).toBeNull();
  });

  it("fails closed when answer reconciliation also fails", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(catalog()).mockResolvedValueOnce(response({ sessionId }, 201)).mockResolvedValueOnce(response(before)).mockRejectedValueOnce(new Error("response lost")).mockResolvedValueOnce(failure(503, "DB_NOT_READY", true));
    render(React.createElement(McqSessionRunner)); await startSession();
    fireEvent.click(screen.getByRole("button", { name: "A. Choix A" }));
    expect(await screen.findByRole("link", { name: "Retour au tableau de bord" })).toBeTruthy();
    expect(answerPosts()).toHaveLength(1); expect(screen.queryByRole("button", { name: /Réessayer/ })).toBeNull();
  });

  it("preserves synchronous double-click protection", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(catalog()).mockResolvedValueOnce(response({ sessionId }, 201)).mockResolvedValueOnce(response(before)).mockResolvedValueOnce(response(after));
    render(React.createElement(McqSessionRunner)); await startSession();
    const choice = screen.getByRole("button", { name: "A. Choix A" }); fireEvent.click(choice); fireEvent.click(choice);
    await screen.findByText("Explication après réponse"); expect(answerPosts()).toHaveLength(1);
  });

  it("asks the learner before using an owned in-progress session", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(catalogWithResume());
    render(React.createElement(McqSessionRunner));
    expect(await screen.findByRole("button", { name: "Reprendre ma session" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Commencer une nouvelle session" })).toBeTruthy();
    expect(sessionPosts()).toHaveLength(0);
  });

  it("offers and restores a persisted session even when the current catalogue is empty", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(emptyCatalogWithResume()).mockResolvedValueOnce(response(before));
    render(React.createElement(McqSessionRunner));
    expect(await screen.findByRole("button", { name: "Reprendre ma session" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aucun nouveau QCM disponible" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Reprendre ma session" }));
    expect(await screen.findByText("Question publiée")).toBeTruthy();
    expect(screen.queryByText("Aucune question disponible.")).toBeNull();
  });

  it("resumes once and restores the first unanswered item", async () => {
    const answered = { ...before.items[0], answer: { choiceId: "a", correct: true, correctChoiceId: "a", explanation: "Déjà répondu" } };
    const second = { ...before.items[0], itemId: "item-2", position: 1, stem: "Question à reprendre", answer: null };
    vi.mocked(clientFetch).mockResolvedValueOnce(catalogWithResume()).mockResolvedValueOnce(response({ ...before, items: [answered, second] }));
    render(React.createElement(McqSessionRunner));
    const resume = await screen.findByRole("button", { name: "Reprendre ma session" });
    fireEvent.click(resume); fireEvent.click(resume);
    expect(await screen.findByText("Question à reprendre")).toBeTruthy();
    expect(vi.mocked(clientFetch).mock.calls.filter(([url]) => url === `/api/mcq/sessions/${sessionId}`)).toHaveLength(1);
    expect(sessionPosts()).toHaveLength(0);
  });

  it("creates only one new session after the explicit choice and preserves the old one", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(catalogWithResume()).mockResolvedValueOnce(response({ sessionId }, 201)).mockResolvedValueOnce(response(before));
    render(React.createElement(McqSessionRunner));
    const startNew = await screen.findByRole("button", { name: "Commencer une nouvelle session" });
    fireEvent.click(startNew); fireEvent.click(startNew);
    expect(await screen.findByText("Question publiée")).toBeTruthy();
    expect(sessionPosts()).toHaveLength(1);
    expect(vi.mocked(clientFetch).mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  });

  it("shows a terminal retry state when resume fails over the network", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(catalogWithResume()).mockRejectedValueOnce(new Error("offline"));
    render(React.createElement(McqSessionRunner));
    fireEvent.click(await screen.findByRole("button", { name: "Reprendre ma session" }));
    expect((await screen.findByRole("alert")).textContent).toContain("NET_REQUEST_FAILED");
    expect(screen.getByRole("button", { name: "Réessayer la reprise" })).toBeTruthy();
    expect(screen.queryByText(/Reprise en cours/)).toBeNull();
  });

  it("returns to the historical start screen after completion without creating automatically", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(catalog()).mockResolvedValueOnce(response({ sessionId }, 201)).mockResolvedValueOnce(response(before)).mockResolvedValueOnce(response(after)).mockResolvedValueOnce(response({ score: { percentage: 100, correct: 1, total: 1 } }));
    render(React.createElement(McqSessionRunner)); await startSession();
    fireEvent.click(screen.getByRole("button", { name: "A. Choix A" }));
    fireEvent.click(await screen.findByRole("button", { name: "Terminer" }));
    fireEvent.click(await screen.findByRole("button", { name: "Nouvelle session" }));
    expect(await screen.findByRole("button", { name: "Commencer" })).toBeTruthy();
    expect(sessionPosts()).toHaveLength(1);
  });

  it("leaves loading for an empty catalogue", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(response({ blueprints: [] })); render(React.createElement(McqSessionRunner));
    expect(await screen.findByText("Aucune question disponible.")).toBeTruthy(); expect(screen.queryByText(/Chargement du corpus/)).toBeNull();
  });
});
