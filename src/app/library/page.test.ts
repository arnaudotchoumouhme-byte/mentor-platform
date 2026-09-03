// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppState } from "@/hooks/use-state";
import { ClientRequestError, clientFetch } from "@/shared/api/client-fetch";
import LibraryPage from "./page";

vi.mock("@/hooks/use-state", () => ({ useAppState: vi.fn() }));
vi.mock("@/shared/api/client-fetch", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/shared/api/client-fetch")>();
  return { ...original, clientFetch: vi.fn() };
});

const refresh = vi.fn();
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "x-trace-id": "trace-upload" } });

function fileInput() { return document.querySelector('input[type="file"]') as HTMLInputElement; }

describe("LibraryPage", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.mocked(clientFetch).mockReset();
    vi.mocked(useAppState).mockReturnValue({ data: { subjects: [], documents: [] }, refresh, act: vi.fn() } as unknown as ReturnType<typeof useAppState>);
  });
  afterEach(cleanup);

  it("reports a successful import and refreshes state", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(response({ imported: ["document"], documents: [], rejected: [] }, 201));
    render(React.createElement(LibraryPage));
    const input = fileInput();
    Object.defineProperty(input, "value", { value: "C:\\fakepath\\cours.txt", writable: true });
    fireEvent.change(input, { target: { files: [new File(["texte"], "cours.txt", { type: "text/plain" })] } });
    expect((await screen.findByRole("status")).textContent).toContain("1 document(s) importé(s)");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(input.value).toBe("");
  });

  it("shows a traceable server error without a false success", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(response({ error: { message: "Import refusé.", traceId: "trace-upload" } }, 403));
    render(React.createElement(LibraryPage));
    fireEvent.change(fileInput(), { target: { files: [new File(["texte"], "cours.txt")] } });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Import refusé.");
    expect(alert.textContent).toContain("trace-upload");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("leaves upload busy state after a network failure and blocks duplicates", async () => {
    let rejectRequest: (reason: unknown) => void = () => undefined;
    vi.mocked(clientFetch).mockImplementationOnce(() => new Promise((_, reject) => { rejectRequest = reject; }));
    render(React.createElement(LibraryPage));
    const files = [new File(["texte"], "cours.txt")];
    fireEvent.change(fileInput(), { target: { files } });
    fireEvent.change(fileInput(), { target: { files } });
    expect(clientFetch).toHaveBeenCalledTimes(1);
    rejectRequest(new ClientRequestError("NET_REQUEST_FAILED", "trace-network"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("trace-network"));
    expect(screen.getByRole("button", { name: "Importer" })).toBeTruthy();
  });

  it("preserves upload success when refresh fails and retries only the refresh", async () => {
    vi.mocked(clientFetch).mockResolvedValueOnce(response({ imported: ["document"], documents: [], rejected: [] }, 201));
    refresh.mockRejectedValueOnce(new Error("refresh failed")).mockResolvedValueOnce(undefined);
    render(React.createElement(LibraryPage));
    fireEvent.change(fileInput(), { target: { files: [new File(["texte"], "cours.txt")] } });
    expect((await screen.findByRole("status")).textContent).toContain("1 document(s) importé(s)");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("L’import a réussi");
    expect(alert.textContent).not.toContain("Import impossible");
    fireEvent.click(screen.getByRole("button", { name: "Rafraîchir la bibliothèque" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(clientFetch).toHaveBeenCalledTimes(1);
  });

  it("blocks a new upload while a refresh retry is pending", async () => {
    let finishRetry: () => void = () => undefined;
    vi.mocked(clientFetch)
      .mockResolvedValueOnce(response({ imported: ["first"], documents: [], rejected: [] }, 201))
      .mockResolvedValueOnce(response({ imported: ["second"], documents: [], rejected: [] }, 201));
    refresh
      .mockRejectedValueOnce(new Error("initial refresh failed"))
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishRetry = resolve; }))
      .mockResolvedValueOnce(undefined);
    render(React.createElement(LibraryPage));
    fireEvent.change(fileInput(), { target: { files: [new File(["first"], "first.txt")] } });
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Rafraîchir la bibliothèque" }));
    expect((screen.getByRole("button", { name: "Importer après actualisation…" }) as HTMLButtonElement).disabled).toBe(true);
    const input = fileInput();
    input.disabled = false;
    fireEvent.change(input, { target: { files: [new File(["second"], "second.txt")] } });
    expect(clientFetch).toHaveBeenCalledTimes(1);
    finishRetry();
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect((screen.getByRole("button", { name: "Importer" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(fileInput(), { target: { files: [new File(["second"], "second.txt")] } });
    await waitFor(() => expect(clientFetch).toHaveBeenCalledTimes(2));
  });
});
