// =============================================================================
// The models Ask may run on: the list the picker shows and the only ids the
// chat route accepts. One vendor-neutral id per model (Vercel AI Gateway's
// `provider/model`); `direct` is the same model's id at its own provider, for
// running on that provider's key when there is no gateway key.
// =============================================================================

export interface AskModel {
  id: string;
  label: string;
  /** Provider-native id, for `@ai-sdk/<provider>` without the gateway. */
  direct: string;
}

export const ASK_MODELS: AskModel[] = [
  { id: "anthropic/claude-opus-5.5", label: "Claude Opus 5.5", direct: "claude-opus-5-5" },
  { id: "anthropic/claude-sonnet-5.5", label: "Claude Sonnet 5.5", direct: "claude-sonnet-5-5" },
  { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5", direct: "claude-haiku-4-5" },
  { id: "openai/gpt-6.1-sol", label: "GPT-6.1 Sol", direct: "gpt-6.1-sol" },
  { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash", direct: "gemini-3.8-flash" },
];

export const DEFAULT_ASK_MODEL = ASK_MODELS[0].id;

export function askModelOf(id: unknown): AskModel {
  return ASK_MODELS.find((m) => m.id === id) ?? ASK_MODELS[0];
}
