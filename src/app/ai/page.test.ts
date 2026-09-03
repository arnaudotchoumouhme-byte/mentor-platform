// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppState } from "@/hooks/use-state";
import { ClientRequestError, clientFetch } from "@/shared/api/client-fetch";
import AiPage from "./page";

vi.mock("@/hooks/use-state", () => ({ useAppState: vi.fn() }));
vi.mock("@/shared/api/client-fetch", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/shared/api/client-fetch")>();
  return { ...original, clientFetch: vi.fn() };
});

const data = { subjects: [], documents: [], flashcards: [], questions: [], attempts: [], weaknesses: [], tasks: [], messages: [], settings: {} };
const refresh = vi.fn(async () => undefined);
const response = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "x-trace-id": "trace-safe" } });

describe("AiPage request failures", () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.mocked(clientFetch).mockReset();
    vi.mocked(useAppState).mockReturnValue({ data, refresh } as unknown as ReturnType<typeof useAppState>);
  });
  afterEach(cleanup);

  it("shows a safe traceable Coach HTTP error and returns to idle", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(response({ error: { message: "Session refusée.", traceId: "trace-safe", code: "PILOT_ACCESS_DENIED" } }, 403));
    render(React.createElement(AiPage));
    fireEvent.click(screen.getByRole("button", { name: "Commencer un cas synthétique" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Session refusée.");
    expect(alert.textContent).toContain("trace-safe");
    expect(screen.getByRole("button", { name: "Commencer un cas synthétique" })).toBeTruthy();
  });

  it("reports a Coach timeout without exposing the underlying error and blocks duplicate requests", async () => {
    let rejectRequest: (reason: unknown) => void = () => undefined;
    vi.mocked(clientFetch).mockImplementationOnce(() => new Promise((_, reject) => { rejectRequest = reject; }));
    render(React.createElement(AiPage));
    const button = screen.getByRole("button", { name: "Commencer un cas synthétique" });
    fireEvent.click(button); fireEvent.click(button);
    expect(clientFetch).toHaveBeenCalledTimes(1);
    rejectRequest(new ClientRequestError("NET_REQUEST_TIMEOUT", "trace-timeout", { cause: new Error("private detail") }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("La requête a expiré");
    expect(alert.textContent).toContain("trace-timeout");
    expect(alert.textContent).not.toContain("private detail");
    expect(screen.getByRole("button", { name: "Commencer un cas synthétique" })).toBeTruthy();
  });

  it("shows a documentary HTTP error without clearing the question or refreshing state", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(response({ error: { message: "Quota documentaire atteint.", traceId: "trace-safe", code: "PILOT_QUOTA_EXCEEDED" } }, 429));
    render(React.createElement(AiPage));
    fireEvent.click(screen.getByRole("button", { name: "Question à la bibliothèque" }));
    const field = screen.getByRole("textbox", { name: "Question à la bibliothèque" });
    fireEvent.change(field, { target: { value: "Question synthétique" } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Quota documentaire atteint.");
    expect((field as HTMLTextAreaElement).value).toBe("Question synthétique");
    expect(refresh).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Envoyer" })).toBeTruthy());
  });
});
