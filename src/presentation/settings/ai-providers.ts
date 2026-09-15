/** Public metadata only. Availability must follow the server adapter, never a saved preference. */
export type AiProviderOption = Readonly<{
  id: string;
  value: string;
  label: string;
  status: "available" | "not-integrated";
}>;

export const AI_PROVIDERS: readonly AiProviderOption[] = [
  { id: "local", value: "Mode local", label: "Mode local", status: "available" },
  { id: "openai", value: "OpenAI", label: "OpenAI", status: "not-integrated" },
  { id: "anthropic", value: "Anthropic", label: "Anthropic — Claude", status: "not-integrated" },
  { id: "google", value: "Gemini", label: "Google — Gemini", status: "not-integrated" },
];
