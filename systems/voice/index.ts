// =============================================================================
// Voice System — speak to the site.
//
//   const voice = useVoiceInput({ lang: "en-US", onInterim, onFinal });
//   <button onClick={voice.toggle}>…</button>
//   <Glow active={voice.listening} shape="line" level={voice.level}
//         bands={voice.bands} processing={voice.state === "processing"} />
//
// The words come from the browser's Web Speech API; the level the glow
// follows comes from a microphone meter (lib/meter.ts). See
// docs/system-glow.md.
// =============================================================================

export { isVoiceSupported, useVoiceInput } from "./use-voice-input";
export type { VoiceInput, VoiceInputOptions } from "./use-voice-input";
export { createMeter, primeAudio } from "./lib/meter";
export type { VoiceMeter } from "./lib/meter";
