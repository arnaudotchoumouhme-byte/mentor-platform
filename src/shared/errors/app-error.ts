export type AppErrorOptions = Readonly<{
  code: string;
  userMessage: string;
  internalMessage?: string;
  cause?: unknown;
}>;

export class AppError extends Error {
  readonly code: string;
  readonly userMessage: string;

  constructor(options: AppErrorOptions) {
    super(options.internalMessage ?? options.userMessage, { cause: options.cause });
    this.name = "AppError";
    this.code = options.code;
    this.userMessage = options.userMessage;
  }
}
