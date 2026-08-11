export type AppErrorOptions = Readonly<{
  code: string;
  userMessage: string;
  internalMessage?: string;
  cause?: unknown;
  category?: AppErrorCategory;
  severity?: AppErrorSeverity;
  context?: Readonly<Record<string, unknown>>;
}>;

export type AppErrorCategory =
  | "validation"
  | "configuration"
  | "database"
  | "filesystem"
  | "security"
  | "external"
  | "internal";

export type AppErrorSeverity = "debug" | "info" | "warn" | "error" | "critical";

export class AppError extends Error {
  readonly code: string;
  readonly userMessage: string;
  readonly category: AppErrorCategory;
  readonly severity: AppErrorSeverity;
  readonly context: Readonly<Record<string, unknown>>;

  constructor(options: AppErrorOptions) {
    super(options.internalMessage ?? options.userMessage, { cause: options.cause });
    this.name = "AppError";
    this.code = options.code;
    this.userMessage = options.userMessage;
    this.category = options.category ?? "internal";
    this.severity = options.severity ?? "error";
    this.context = options.context ?? {};
  }
}
