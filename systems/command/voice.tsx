"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { useAskConfig } from "@/systems/ask/lib/config";
import { isQuestionLike } from "@/systems/ask/lib/intent";
import { showNotice } from "@/systems/dock";
import { Glow } from "@/systems/glow";
import { useVoiceInput, VOICE_LANG, type VoiceInput } from "@/systems/voice";
import { Mic } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useCommand } from "./provider";

// =============================================================================
// Voice in the palette: speak into the search field.
//
// The microphone sits in the field's trailing cluster (both shells). Pressed,
// the field listens (systems/voice): the words fill it as they are heard, the
// results filter as they would for typing in browser mode. With Whisper,
// the completed recording fills the field after release. `/` `V` also starts
// voice input from the slash list.
//
// Without Whisper, a tap starts browser recognition until the speaker's
// pause, and a hold of HOLD_MS or more stops on release. With Whisper, the
// microphone and V key record while held, then transcribe on release. Three
// ways in, all inside the palette, so none can
// collide with a system-wide dictation key (Fn / Globe, Win+H, ⌥Space, which
// a page cannot see or should not take):
//
//   the microphone          press / press and hold
//   `/` `V`                 tap / hold the V
//   Space in an empty field hold (a tap does nothing; a leading space
//                           means nothing to a search)
//
// While it listens, the field shows the site's glow along its bottom edge,
// a beat after it starts (a glow on the first instant reads as a flash):
// the `line` shape of the same light the About rings the screen with
// (systems/glow). It rises and spreads with the voice and ripples with its
// bands. When the speaker pauses and the words are being settled, it gathers
// into one beam travelling the edge (the glow's `processing`) and fades once
// the final phrase is in.
//
// On a touch screen, the microphone pressed while a field holds the keyboard
// up lets the keyboard go: listening wants the screen, and the words arrive
// in the field anyway. The glow then waits longer, for the keyboard's slide
// to finish: the two together drop frames on a phone. Both waits are Ask's
// settings (systems/ask/lib/config.ts: `glowDelay`, `keyboardDelay`).
// =============================================================================

/**
 * What was said, as a query: the field hears intent, not a sentence. "Go to
 * the writing", "open works", "show me the wallpaper", "打开写作" arrive as
 * "writing", "works", "wallpaper", "写作": the words cmdk can match.
 */
const FILLER_EN =
  /^(?:(?:please|hey|ok|okay)[,\s]+)?(?:(?:go|take me|navigate|jump|switch)\s+to|open(?:\s+up)?|show(?:\s+me)?|search(?:\s+for)?|find|play|turn(?:\s+on|\s+off)?)\s+(?:(?:the|my|a)\s+)?/i;
const FILLER_ZH = /^(?:请|帮我)?(?:打开|去|前往|显示|搜索|查找|播放|切换到?)(?:一下)?/;

export function toQuery(said: string): string {
  const text = said.trim().replace(/[.。!！?？]+$/, "");
  const stripped = text.replace(FILLER_EN, "").replace(FILLER_ZH, "").trim();
  return stripped || text;
}

/**
 * What goes in the field: a command as a query, a question as it was said.
 * Spoken questions are long and full of the words `toQuery` strips; they go
 * to Ask (systems/ask), which wants the whole sentence, question mark and all.
 */
export function toFieldText(said: string): string {
  return isQuestionLike(said) ? said.trim() : toQuery(said);
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
    lang: VOICE_LANG[locale],
    onInterim: (said) => setValue(toFieldText(said)),
    onFinal: (said) => setValue(toFieldText(said)),
  });

  // `/` `V`: each request starts one session, whether it opened the palette
  // (this field mounts with it pending) or arrived while the field was up.
  // Counted at module level, so a field remounting never replays an old one.
  // A request made by a key follows that key: its repeats are swallowed (they
  // would type into the field, which takes focus), and letting go after a
  // hold sends what was said. Letting go of a tap changes nothing.
  const { start, stop, mode } = voice;
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
      if (mode === "whisper" || performance.now() - t0 >= HOLD_MS) stop();
      done();
    };
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    window.addEventListener("blur", done);
    return done;
  }, [voiceRequest, voiceHoldKey, start, stop, mode]);

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

/** When the microphone last sent a keyboard down, `performance.now()`. */
let keyboardDismissedAt = -Infinity;

/** A keyboard sent down this recently is still sliding, ms. */
const KEYBOARD_SLIDE_MS = 800;

/** On a touch screen, let go of the field that holds the keyboard up. */
function dismissKeyboard() {
  const field = document.activeElement as HTMLElement | null;
  if (!field || !(field.tagName === "INPUT" || field.tagName === "TEXTAREA" || field.isContentEditable)) return;
  field.blur();
  keyboardDismissedAt = performance.now();
}

/** The microphone button. Renders nothing when neither voice path is available. */
export function VoiceButton({ voice, className }: { voice: VoiceInput; className?: string }) {
  const { locale } = useLocale();
  const press = useRef<number | null>(null);
  useEffect(() => {
    if (voice.state !== "error" && voice.state !== "denied") return;
    showNotice({
      id: "voice-input-error",
      icon: Mic,
      title: t(locale, voice.state === "denied" ? "voiceDenied" : "voiceError"),
    });
  }, [voice.state, locale]);
  if (!voice.supported) return null;
  const label = voice.state === "processing"
    ? t(locale, "voiceProcessing")
    : voice.state === "listening"
      ? voice.mode === "whisper" ? t(locale, "voiceRelease") : t(locale, "voiceStop")
    : voice.state === "denied"
      ? t(locale, "voiceDenied")
      : voice.state === "error"
        ? t(locale, "voiceError")
        : voice.mode === "whisper" ? t(locale, "voiceHold") : t(locale, "voiceListen");
  return (
    <button
      type="button"
      // Whisper records only while pressed; browser recognition retains its
      // tap-to-toggle gesture. Capture the pointer so release lands here.
      onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
        if (e.button !== 0 || voice.state === "processing") return;
        e.currentTarget.setPointerCapture(e.pointerId);
        if (voice.state === "listening") {
          voice.stop();
          press.current = null;
          return;
        }
        if (e.pointerType !== "mouse") dismissKeyboard();
        voice.start();
        press.current = performance.now();
      }}
      onPointerUp={() => {
        if (press.current !== null && (voice.mode === "whisper" || performance.now() - press.current >= HOLD_MS)) voice.stop();
        press.current = null;
      }}
      onPointerCancel={() => {
        if (press.current !== null && voice.mode === "whisper") voice.abort();
        press.current = null;
      }}
      onKeyDown={(e) => {
        if (voice.mode !== "whisper" || (e.key !== " " && e.key !== "Enter")) return;
        e.preventDefault();
        if (!e.repeat && voice.state !== "processing") voice.start();
      }}
      onKeyUp={(e) => {
        if (voice.mode !== "whisper" || (e.key !== " " && e.key !== "Enter")) return;
        e.preventDefault();
        voice.stop();
      }}
      // The keyboard's Enter / Space arrive as a click with no pointer.
      onClick={(e) => e.detail === 0 && voice.mode === "browser" && voice.toggle()}
      aria-label={label}
      aria-pressed={voice.state === "listening"}
      title={label}
      className={cn(
        "pressable flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
        "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-accent",
        voice.listening && "text-foreground",
        voice.state === "denied" && "text-tertiary-foreground",
        className,
      )}
    >
      <Mic className={cn("h-4 w-4", voice.state === "listening" && "voice-mic-live")} />
    </button>
  );
}

/**
 * The field's glow while it listens. Place it inside the field's header,
 * which must be `relative`; it reads the header's radius.
 */
export function VoiceGlow({ voice }: { voice: VoiceInput }) {
  const { glowDelay, keyboardDelay } = useAskConfig();
  const [lit, setLit] = useState(false);
  const { listening } = voice;
  useEffect(() => {
    if (!listening) return;
    const sliding = performance.now() - keyboardDismissedAt < KEYBOARD_SLIDE_MS;
    const timer = window.setTimeout(() => setLit(true), glowDelay + (sliding ? keyboardDelay : 0));
    return () => {
      window.clearTimeout(timer);
      setLit(false);
    };
    // The wait is fixed when listening starts; a setting changed mid-session
    // applies to the next one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);
  return (
    <Glow
      active={listening && lit}
      shape="line"
      level={voice.level}
      bands={voice.bands}
      processing={voice.state === "processing"}
      strength={0.95}
    />
  );
}
