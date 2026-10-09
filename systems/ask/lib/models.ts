// =============================================================================
// The models Ask may run on: the list the picker shows and the only ids the
// chat route accepts (anything else falls back to the first). Vercel AI
// Gateway ids, `provider/model`.
//
// Chosen to cost little and to run on the gateway's free tier: every one is
// `availableToFreeTier` in the gateway's catalog, takes tools, reasons,
// reads Chinese and English, and is served without training on prompts. Claude,
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
  // $0.10 / $0.40, 1M context, explicit caching. The default: a third of
  // Gemini's price, and it searches eagerly; the route's tool budget is what
  // makes it answer.
  { id: "alibaba/qwen3.5-flash", label: "Qwen 3.5 Flash" },
  // $0.30 / $2.50. Searches less, answers well on the site's questions.
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  // Qwen 3.8 Flash ($0.15 / $0.47) and DeepSeek V4.1 Flash Fast ($0.30 /
  // $1.20, the build served without training on prompts) were here: neither
  // is on the free tier. Back in when there are gateway credits.
  // Kimi K2 Thinking was here and did not connect through the gateway.
];

export const DEFAULT_ASK_MODEL = ASK_MODELS[0].id;

export function askModelOf(id: unknown): AskModel {
  return ASK_MODELS.find((m) => m.id === id) ?? ASK_MODELS[0];
}

// -----------------------------------------------------------------------------
// How hard the model thinks: the AI SDK's portable `reasoning` setting, which
// each provider maps to its own (effort, a thinking budget). Picked per
// viewer; the route accepts only these.
// -----------------------------------------------------------------------------

export const ASK_EFFORTS = ["low", "medium", "high"] as const;

export type AskEffort = (typeof ASK_EFFORTS)[number];

export const DEFAULT_ASK_EFFORT: AskEffort = "low";

export function askEffortOf(value: unknown): AskEffort {
  return ASK_EFFORTS.includes(value as AskEffort) ? (value as AskEffort) : DEFAULT_ASK_EFFORT;
}
