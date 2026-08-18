// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { clientFetch, ClientRequestError } from "./client-fetch";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("clientFetch", () => {
  it("adds a trace ID to every client request", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      new Response(null, {
        headers: { "x-seen-trace": new Headers(init?.headers).get("x-trace-id") ?? "" },
      }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await clientFetch("/api/test");
    expect(response.headers.get("x-seen-trace")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("aborts a suspended request at the explicit timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))));
    const pending = clientFetch("/api/test", {}, 50);
    const assertion = expect(pending).rejects.toBeInstanceOf(ClientRequestError);
    await vi.advanceTimersByTimeAsync(51);
    await assertion;
  });
});
