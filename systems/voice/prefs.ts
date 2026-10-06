"use client";

import { makeStore } from "@/components/post/persisted-setting";
import { DEFAULT_VOICE_MODEL, voiceModelOf, type VoiceModelChoice } from "./models";

export const voiceModelPref = makeStore<VoiceModelChoice>(
  "hux_voice_model",
  "hux-voice-model",
  DEFAULT_VOICE_MODEL,
  voiceModelOf,
);
