// =============================================================================
// The models Ask may run on: the list the picker shows and the only ids the
// chat route accepts (anything else falls back to the first). Vercel AI
// Gateway ids, `provider/model`.
//
// Chosen to cost little and to run on the gateway's free tier: every one is
// `availableToFreeTier` in the gateway's catalog, takes tools, reasons, reads
// Chinese and English, and is served without training on prompts. Claude,
// GPT and Gemini 3 need purchased gateway credits; add them here when there
// are some (an entry with `direct` also runs on that provider's own key).
// Prices per million tokens, input / output, as listed 2026-10.
// =============================================================================

export interface AskModel {
  id: string;
  label: string;
  /** Provider-native id, for `@ai-sdk/anthropic` / `@ai-sdk/openai` without
   *  the gateway. Only those two providers are wired directly. */
  direct?: string;
}

export const ASK_MODELS: AskModel[] = [
  // $0.10 / $0.40, 1M context, explicit caching.
  { id: "alibaba/qwen3.5-flash", label: "Qwen 3.5 Flash" },
  // $0.30 / $2.50.
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  // $0.47 / $2.00, the strongest of the three at agentic tool use.
  { id: "moonshotai/kimi-k2-thinking", label: "Kimi K2 Thinking" },
];

export const DEFAULT_ASK_MODEL = ASK_MODELS[0].id;

export function askModelOf(id: unknown): AskModel {
  return ASK_MODELS.find((m) => m.id === id) ?? ASK_MODELS[0];
}
