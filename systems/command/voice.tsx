"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { Glow } from "@/systems/glow";
import { useVoiceInput, type VoiceInput } from "@/systems/voice";
import { Mic } from "lucide-react";
import { useEffect } from "react";
import { useCommand } from "./provider";

// =============================================================================
// Voice in the palette — speak into the search field.
//
// The microphone sits in the field's trailing cluster (both shells). Pressed,
// the field listens (systems/voice): the words fill it as they are heard, the
// results filter as they would for typing, and the final phrase stays for
// ↵ / a tap. `/` `V` does the same from the slash list.
//
// While it listens, the field wears the site's glow along its bottom edge —
// the `line` shape of the same light the About rings the screen with
// (systems/glow). It rises and spreads with the voice and ripples with its
// bands; when the speaker pauses and the words are being settled, it gathers
// into one beam travelling the edge — the glow's `processing` — and fades as
// the phrase lands.
// =============================================================================

const LANG = { en: "en-US", zh: "zh-CN" } as const;

/**
 * What was said, as a query: the field hears intent, not a sentence. "Go to
 * the writing", "open works", "show me the wallpaper", "打开写作" arrive as
 * "writing", "works", "wallpaper", "写作" — the words cmdk can match.
 */
const FILLER_EN =
  /^(?:(?:please|hey|ok|okay)[,\s]+)?(?:(?:go|take me|navigate|jump|switch)\s+to|open(?:\s+up)?|show(?:\s+me)?|search(?:\s+for)?|find|play|turn(?:\s+on|\s+off)?)\s+(?:(?:the|my|a)\s+)?/i;
const FILLER_ZH = /^(?:请|帮我)?(?:打开|去|前往|显示|搜索|查找|播放|切换到?)(?:一下)?/;

export function toQuery(said: string): string {
  const text = said.trim().replace(/[.。!！?？]+$/, "");
  const stripped = text.replace(FILLER_EN, "").replace(FILLER_ZH, "").trim();
  return stripped || text;
}

/** The last `/` `V` request a field has acted on. */
let consumedRequest = 0;

/** The palette's voice session, writing into the field. */
export function useCommandVoice(setValue: (text: string) => void): VoiceInput {
  const { locale } = useLocale();
  const { voiceRequest } = useCommand();
  const voice = useVoiceInput({
    lang: LANG[locale],
    onInterim: (said) => setValue(toQuery(said)),
    onFinal: (said) => setValue(toQuery(said)),
  });

  // `/` `V`: each request starts one session — whether it opened the palette
  // (this field mounts with it pending) or arrived while the field was up.
  // Counted at module level, so a field remounting never replays an old one.
  const { start } = voice;
  useEffect(() => {
    if (voiceRequest <= consumedRequest) return;
    consumedRequest = voiceRequest;
    start();
  }, [voiceRequest, start]);

  return voice;
}

/** The microphone button. Renders nothing where speech is not recognised. */
export function VoiceButton({ voice, className }: { voice: VoiceInput; className?: string }) {
  const { locale } = useLocale();
  if (!voice.supported) return null;
  const label = voice.listening
    ? t(locale, "voiceStop")
    : voice.state === "denied"
      ? t(locale, "voiceDenied")
      : t(locale, "voiceListen");
  return (
    <button
      type="button"
      onClick={voice.toggle}
      aria-label={label}
      aria-pressed={voice.listening}
      title={label}
      className={cn(
        "pressable flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
        "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-accent",
        voice.listening && "text-foreground",
        voice.state === "denied" && "text-tertiary-foreground",
        className,
      )}
    >
      <Mic className={cn("h-4 w-4", voice.listening && "voice-mic-live")} />
    </button>
  );
}

/**
 * The field's glow while it listens. Place it inside the field's header,
 * which must be `relative`; it reads the header's radius.
 */
export function VoiceGlow({ voice }: { voice: VoiceInput }) {
  return (
    <Glow
      active={voice.listening}
      shape="line"
      level={voice.level}
      bands={voice.bands}
      processing={voice.state === "processing"}
      strength={0.95}
    />
  );
}
