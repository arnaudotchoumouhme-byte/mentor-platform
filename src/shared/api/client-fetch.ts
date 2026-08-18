export const CLIENT_REQUEST_TIMEOUT_MS = 10_000;

export class ClientRequestError extends Error {
  constructor(
    readonly code: "NET_REQUEST_TIMEOUT" | "NET_REQUEST_FAILED",
    readonly traceId: string,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "ClientRequestError";
  }
}

export async function clientFetch(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = CLIENT_REQUEST_TIMEOUT_MS): Promise<Response> {
  const traceId = crypto.randomUUID();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(init.headers);
  if (!headers.has("x-trace-id")) headers.set("x-trace-id", traceId);
  try {
    return await fetch(input, { ...init, headers, signal: controller.signal });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    throw new ClientRequestError(
      timedOut ? "NET_REQUEST_TIMEOUT" : "NET_REQUEST_FAILED",
      headers.get("x-trace-id") ?? traceId,
      { cause: error },
    );
  } finally {
    window.clearTimeout(timer);
  }
}
