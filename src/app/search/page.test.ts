// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppState } from "@/hooks/use-state";
import { ClientRequestError, clientFetch } from "@/shared/api/client-fetch";
import SearchPage from "./page";

vi.mock("@/hooks/use-state", () => ({ useAppState: vi.fn() }));
vi.mock("@/shared/api/client-fetch", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/shared/api/client-fetch")>();
  return { ...original, clientFetch: vi.fn() };
});

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "x-trace-id": "trace-search" } });

describe("SearchPage", () => {
  beforeEach(() => {
    vi.mocked(useAppState).mockReturnValue({ data: { subjects: [{ id: 1, name: "SNC" }] } } as ReturnType<typeof useAppState>);
    vi.mocked(clientFetch).mockReset();
  });
  afterEach(cleanup);

  it("shows results after a successful search", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(response({ results: [{ id: 1, name: "Cours SNC", subject: "SNC", content: "Passage indexé", status: "READY" }] }));
    render(React.createElement(SearchPage));
    fireEvent.change(screen.getByPlaceholderText(/biodisponibilité/), { target: { value: "serotonine" } });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    expect(await screen.findByText("Passage indexé")).toBeTruthy();
  });

  it("leaves the busy state and exposes a safe traceable HTTP error", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(response({ error: { message: "Recherche indisponible.", traceId: "trace-search" } }, 503));
    render(React.createElement(SearchPage));
    fireEvent.change(screen.getByPlaceholderText(/biodisponibilité/), { target: { value: "serotonine" } });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    expect((await screen.findByRole("alert")).textContent).toContain("trace-search");
    expect(screen.getByRole("button", { name: "Rechercher" })).toBeTruthy();
  });

  it("reports a timeout and prevents synchronous duplicate requests", async () => {
    let rejectRequest: (reason: unknown) => void = () => undefined;
    vi.mocked(clientFetch).mockImplementationOnce(() => new Promise((_, reject) => { rejectRequest = reject; }));
    render(React.createElement(SearchPage));
    fireEvent.change(screen.getByPlaceholderText(/biodisponibilité/), { target: { value: "serotonine" } });
    const button = screen.getByRole("button", { name: "Rechercher" });
    fireEvent.click(button); fireEvent.click(button);
    expect(clientFetch).toHaveBeenCalledTimes(1);
    rejectRequest(new ClientRequestError("NET_REQUEST_TIMEOUT", "trace-timeout"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("trace-timeout"));
    expect(screen.getByRole("button", { name: "Rechercher" })).toBeTruthy();
  });
});
