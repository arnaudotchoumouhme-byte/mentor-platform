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

const SENSITIVE_KEY = /(?:authorization|cookie|password|secret|token|api[-_]?key|private[-_]?key|(?:oidc|actor)[-_]?subject|^sub$|email|e[-_]?mail|phone|address|date[-_]?of[-_]?birth|birth[-_]?date|first[-_]?name|last[-_]?name|full[-_]?name|user[-_]?name|learner[-_]?id|user[-_]?id|account[-_]?id|patient|clinical|diagnos|medication|symptom|allerg|prompt|user[-_]?content|user[-_]?input|user[-_]?output|question|answer|response|document[-_]?content|extracted[-_]?content)/i;
const EMAIL_VALUE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const OIDC_SUBJECT_VALUE = /^(?:auth0|google-oauth2|windowslive|waad|adfs|samlp|oauth2|oidc)\|.+$/i;

export function redactLogValue(value: unknown, key = ""): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (typeof value === "string" && (EMAIL_VALUE.test(value) || OIDC_SUBJECT_VALUE.test(value))) {
    return "[REDACTED]";
  }
  if (Array.isArray(value)) return value.map((item) => redactLogValue(item, key));
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
      environment: process.env.NODE_ENV ?? "development",
      appVersion: process.env.npm_package_version ?? "development",
      eventName: event.operation,
      ...event,
    });
    const serialized = JSON.stringify(safeEvent);
    if (event.level === "error" || event.level === "critical") console.error(serialized);
    else if (event.level === "warn") console.warn(serialized);
    else console.info(serialized);
  },
};
