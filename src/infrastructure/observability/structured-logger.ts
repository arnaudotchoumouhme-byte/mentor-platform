import "server-only";

export type LogLevel = "debug" | "info" | "warn" | "error" | "critical";

export type LogEvent = Readonly<{
  level: LogLevel;
  module: string;
  operation: string;
  status: "success" | "failure" | "degraded" | "skipped";
  message: string;
  traceId?: string;
  errorCode?: string;
  context?: Readonly<Record<string, unknown>>;
}>;

const SENSITIVE_KEY = /authorization|cookie|password|secret|token|api[-_]?key|private[-_]?key/i;

export function redactLogValue(value: unknown, key = ""): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => redactLogValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([nestedKey, nestedValue]) => [
        nestedKey,
        redactLogValue(nestedValue, nestedKey),
      ]),
    );
  }
  return value;
}

export interface Logger {
  log(event: LogEvent): void;
}

export const structuredLogger: Logger = {
  log(event) {
    const safeEvent = redactLogValue({
      timestamp: new Date().toISOString(),
      ...event,
    });
    const serialized = JSON.stringify(safeEvent);
    if (event.level === "error" || event.level === "critical") console.error(serialized);
    else if (event.level === "warn") console.warn(serialized);
    else console.info(serialized);
  },
};
