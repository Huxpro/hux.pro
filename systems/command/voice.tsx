"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { Glow } from "@/systems/glow";
import { useVoiceInput, type VoiceInput } from "@/systems/voice";
import { Mic } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { useCommand } from "./provider";

// =============================================================================
// Voice in the palette — speak into the search field.
//
// The microphone sits in the field's trailing cluster (both shells). Pressed,
// the field listens (systems/voice): the words fill it as they are heard, the
// results filter as they would for typing, and the final phrase stays for
// ↵ / a tap. `/` `V` does the same from the slash list.
//
// Every way in answers a tap and a hold, the way dictation tools do (Wispr
// Flow's held Fn, macOS's Globe): a tap starts listening and the speaker's
// pause ends it; a hold of HOLD_MS or more is push-to-talk — letting go
// sends what was said. Three ways in, all inside the palette, so none can
// collide with a system-wide dictation key (Fn / Globe, Win+H, ⌥Space —
// which a page cannot see or should not take):
//
//   the microphone          press / press and hold
//   `/` `V`                 tap / hold the V
//   Space in an empty field hold (a tap does nothing — a leading space
//                           means nothing to a search)
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

/** How long a press must last to be a hold (push-to-talk), ms. */
export const HOLD_MS = 300;

/** The last `/` `V` request a field has acted on. */
let consumedRequest = 0;

/** The palette's voice session, writing into the field. */
export function useCommandVoice(setValue: (text: string) => void): VoiceInput {
  const { locale } = useLocale();
  const { voiceRequest, voiceHoldKey } = useCommand();
  const voice = useVoiceInput({
    lang: LANG[locale],
    onInterim: (said) => setValue(toQuery(said)),
    onFinal: (said) => setValue(toQuery(said)),
  });

  // `/` `V`: each request starts one session — whether it opened the palette
  // (this field mounts with it pending) or arrived while the field was up.
  // Counted at module level, so a field remounting never replays an old one.
  // A request made by a key follows that key: its repeats are swallowed (they
  // would type into the field, which takes focus), and letting go after a
  // hold sends what was said. Letting go of a tap changes nothing.
  const { start, stop } = voice;
  useEffect(() => {
    if (voiceRequest <= consumedRequest) return;
    consumedRequest = voiceRequest;
    start();
    const key = voiceHoldKey?.toLowerCase();
    if (!key) return;
    const t0 = performance.now();
    const onDown = (e: globalThis.KeyboardEvent) => {
      if (e.key.toLowerCase() === key) e.preventDefault();
    };
    const done = () => {
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp, true);
      window.removeEventListener("blur", done);
    };
    const onUp = (e: globalThis.KeyboardEvent) => {
      if (e.key.toLowerCase() !== key) return;
      e.preventDefault();
      if (performance.now() - t0 >= HOLD_MS) stop();
      done();
    };
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    window.addEventListener("blur", done);
    return done;
  }, [voiceRequest, voiceHoldKey, start, stop]);

  return voice;
}

/**
 * Hold Space in the empty field to talk; let go to send. Spread the result on
 * the field. A space typed into text, or while listening, stays a space.
 */
export function useSpaceToTalk(voice: VoiceInput, empty: boolean) {
  const hold = useRef<{ timer: number; started: boolean } | null>(null);
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== " " || e.nativeEvent.isComposing) return;
    if (hold.current) {
      e.preventDefault(); // the held key's repeats
      return;
    }
    if (!empty || !voice.supported || voice.listening) return;
    e.preventDefault();
    const h = { timer: 0, started: false };
    h.timer = window.setTimeout(() => {
      h.started = true;
      voice.start();
    }, HOLD_MS);
    hold.current = h;
  };
  const onKeyUp = (e: KeyboardEvent<HTMLInputElement>) => {
    const h = hold.current;
    if (e.key !== " " || !h) return;
    window.clearTimeout(h.timer);
    if (h.started) voice.stop();
    hold.current = null;
  };
  const onBlur = () => {
    const h = hold.current;
    if (!h) return;
    window.clearTimeout(h.timer);
    if (h.started) voice.stop();
    hold.current = null;
  };
  return { onKeyDown, onKeyUp, onBlur };
}

/** The microphone button. Renders nothing where speech is not recognised. */
export function VoiceButton({ voice, className }: { voice: VoiceInput; className?: string }) {
  const { locale } = useLocale();
  const press = useRef<number | null>(null);
  if (!voice.supported) return null;
  const label = voice.listening
    ? t(locale, "voiceStop")
    : voice.state === "denied"
      ? t(locale, "voiceDenied")
      : t(locale, "voiceListen");
  return (
    <button
      type="button"
      // Press to start (or to stop, while listening); hold to talk and let go
      // to send. The pointer is captured so the release lands here.
      onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        if (voice.listening) {
          voice.stop();
          press.current = null;
          return;
        }
        voice.start();
        press.current = performance.now();
      }}
      onPointerUp={() => {
        if (press.current !== null && performance.now() - press.current >= HOLD_MS) voice.stop();
        press.current = null;
      }}
      onPointerCancel={() => (press.current = null)}
      // The keyboard's Enter / Space arrive as a click with no pointer.
      onClick={(e) => e.detail === 0 && voice.toggle()}
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
