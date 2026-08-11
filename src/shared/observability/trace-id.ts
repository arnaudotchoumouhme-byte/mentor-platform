const TRACE_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;

export function createTraceId(): string {
  return crypto.randomUUID();
}

export function resolveTraceId(candidate: string | null | undefined): string {
  return candidate && TRACE_ID_PATTERN.test(candidate) ? candidate : createTraceId();
}
