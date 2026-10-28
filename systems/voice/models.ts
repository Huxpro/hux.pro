/** Recorded-audio transcription models offered through Vercel AI Gateway. */
export const VOICE_MODELS = [
  { id: "openai/whisper-1", label: "Whisper", pricePerHour: "$0.36/hr" },
  { id: "spacexai/grok-stt", label: "Grok STT", pricePerHour: "$0.10/hr" },
] as const;

export type VoiceModelId = (typeof VOICE_MODELS)[number]["id"];
export type VoiceModelChoice = VoiceModelId | "browser";

// Keep Whisper until the cheaper model has been tried on real English and
// Chinese dictation; the DevTool lets a visitor compare them immediately.
export const DEFAULT_VOICE_MODEL: VoiceModelChoice = "openai/whisper-1";

export function voiceModelOf(value: unknown): VoiceModelChoice {
  return value === "browser" || VOICE_MODELS.some((model) => model.id === value)
    ? value as VoiceModelChoice
    : DEFAULT_VOICE_MODEL;
}

export function gatewayVoiceModelOf(value: unknown): VoiceModelId {
  return VOICE_MODELS.find((model) => model.id === value)?.id ?? "openai/whisper-1";
}
