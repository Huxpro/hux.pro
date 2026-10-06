// =============================================================================
// Voice System: speak to the site.
//
//   const voice = useVoiceInput({ lang: "en-US", onInterim, onFinal });
//   <VoiceButton voice={voice} />
//   <Glow active={voice.listening} shape="line" level={voice.level}
//         bands={voice.bands} processing={voice.state === "processing"} />
//
// With AI Gateway credentials, a held recording goes to Whisper on release.
// Otherwise the words come from the browser's Web Speech API. The glow follows
// the microphone meter (lib/meter.ts). See
// docs/system-glow.md.
// =============================================================================

export { isVoiceSupported, useVoiceInput } from "./use-voice-input";
export type { VoiceInput, VoiceInputOptions } from "./use-voice-input";
export { createMeter, primeAudio } from "./lib/meter";
export type { VoiceMeter } from "./lib/meter";

/** The speech language for each of the site's locales. */
export const VOICE_LANG = { en: "en-US", zh: "zh-CN" } as const;
