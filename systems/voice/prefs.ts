"use client";

import { makeStore } from "@/components/post/persisted-setting";
import { DEFAULT_VOICE_MODEL, voiceModelOf, type VoiceModelChoice } from "./models";

export const voiceModelPref = makeStore<VoiceModelChoice>(
  "hux_voice_model",
  "hux-voice-model",
  DEFAULT_VOICE_MODEL,
  voiceModelOf,
);

export type VoiceVisualStyle = "glow" | "waveform";
export const DEFAULT_VOICE_VISUAL: VoiceVisualStyle = "glow";

export const voiceVisualPref = makeStore<VoiceVisualStyle>(
  "hux_voice_visual",
  "hux-voice-visual",
  DEFAULT_VOICE_VISUAL,
  (value) => value === "waveform" ? "waveform" : DEFAULT_VOICE_VISUAL,
);
