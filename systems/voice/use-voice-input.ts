"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createMeter, primeAudio, type VoiceMeter } from "./lib/meter";

// =============================================================================
// useVoiceInput — speak instead of type.
//
// Two things run while it listens, from one press:
//
//   words   the Web Speech API (`SpeechRecognition`, `webkitSpeechRecognition`
//           in Safari and Chrome): interim words as they are heard, the final
//           phrase when the speaker pauses. The browser does the recognition —
//           on-device or its vendor's service; nothing goes through this site.
//   voice   a microphone stream through the voice meter (lib/meter.ts), for
//           the glow to follow — how loud, which bands. Where a second capture
//           is refused (some Android browsers hold the microphone for the
//           recogniser alone), the level is synthesised from the recogniser's
//           own sound / speech events, so the glow still answers the voice.
//
// States:  idle → listening → processing (the speaker has paused; the final
//          words are on their way) → idle. `denied` and `error` say why a
//          start failed; `supported` is false where there is no recogniser
//          (Firefox), and callers hide the microphone there.
// =============================================================================

type RecognitionState = "idle" | "listening" | "processing" | "denied" | "error";

interface SpeechAlternative {
  transcript: string;
}
interface SpeechResult {
  isFinal: boolean;
  0: SpeechAlternative;
  length: number;
}
interface SpeechResultEvent {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechResult };
}
interface SpeechErrorEvent {
  error: string;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onsoundstart: (() => void) | null;
  onsoundend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Whether this browser can recognise speech at all (Firefox cannot). */
export function isVoiceSupported(): boolean {
  return recognitionCtor() !== null;
}

export interface VoiceInputOptions {
  /** BCP 47 language: `en-US`, `zh-CN`. */
  lang: string;
  /** The words so far, as they are heard. */
  onInterim?: (text: string) => void;
  /** The phrase, once the speaker pauses. */
  onFinal?: (text: string) => void;
}

export interface VoiceInput {
  supported: boolean;
  state: RecognitionState;
  listening: boolean;
  /** Start (from a press — the microphone is only granted in a gesture). */
  start: () => void;
  stop: () => void;
  toggle: () => void;
  /** Loudness 0–1 for the glow, read every frame. */
  level: () => number;
  /** Low / mid / high 0–1 for the glow, read every frame. */
  bands: () => readonly [number, number, number];
}

export function useVoiceInput({ lang, onInterim, onFinal }: VoiceInputOptions): VoiceInput {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<RecognitionState>("idle");
  const recognition = useRef<Recognition | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const meter = useRef<VoiceMeter | null>(null);
  // The synthetic level, for when no meter could be had.
  const synth = useRef({ sound: false, speech: false, pulse: 0, t0: 0 });
  const callbacks = useRef({ onInterim, onFinal });
  useEffect(() => {
    callbacks.current = { onInterim, onFinal };
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: a browser capability
    setSupported(recognitionCtor() !== null);
  }, []);

  const release = useCallback(() => {
    meter.current?.release();
    meter.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    synth.current = { sound: false, speech: false, pulse: 0, t0: 0 };
  }, []);

  const stop = useCallback(() => {
    recognition.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor || recognition.current) return;
    primeAudio();
    const r = new Ctor();
    r.lang = lang;
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;
    recognition.current = r;
    synth.current.t0 = performance.now();

    r.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) final += res[0].transcript;
        else interim += res[0].transcript;
      }
      synth.current.pulse = performance.now();
      if (final) {
        callbacks.current.onFinal?.(final.trim());
      } else if (interim) {
        callbacks.current.onInterim?.(interim.trim());
      }
    };
    r.onsoundstart = () => (synth.current.sound = true);
    r.onsoundend = () => (synth.current.sound = false);
    r.onspeechstart = () => (synth.current.speech = true);
    r.onspeechend = () => {
      synth.current.speech = false;
      setState((s) => (s === "listening" ? "processing" : s));
    };
    r.onerror = (e) => {
      setState(e.error === "not-allowed" || e.error === "service-not-allowed" ? "denied" : "error");
    };
    r.onend = () => {
      recognition.current = null;
      release();
      setState((s) => (s === "denied" || s === "error" ? s : "idle"));
    };

    try {
      r.start();
      setState("listening");
    } catch {
      recognition.current = null;
      setState("error");
      return;
    }

    // The meter, alongside. Its failure only costs the glow its precision.
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        })
        .then((s) => {
          if (recognition.current !== r) {
            s.getTracks().forEach((t) => t.stop());
            return;
          }
          stream.current = s;
          meter.current = createMeter(s);
        })
        .catch(() => {
          /* synthesised level instead */
        });
    }
  }, [lang, release]);

  const toggle = useCallback(() => {
    if (recognition.current) stop();
    else start();
  }, [start, stop]);

  // Stop on unmount.
  useEffect(
    () => () => {
      recognition.current?.abort();
      recognition.current = null;
      release();
    },
    [release],
  );

  const level = useCallback(() => {
    if (meter.current) return meter.current.level();
    const s = synth.current;
    if (!s.t0) return 0;
    const t = (performance.now() - s.t0) / 1000;
    // Words arriving are the surest sign of a voice: each result is a beat.
    const beat = Math.exp(-(performance.now() - s.pulse) / 260);
    const base = s.speech ? 0.5 : s.sound ? 0.3 : 0.12;
    return Math.min(1, base + 0.35 * beat + 0.08 * Math.sin(t * 7.3));
  }, []);

  const bands = useCallback((): readonly [number, number, number] => {
    if (meter.current) return meter.current.bands();
    const l = level();
    const t = performance.now() / 1000;
    return [l, l * (0.72 + 0.28 * Math.sin(t * 9.1)), l * (0.6 + 0.4 * Math.sin(t * 13.7 + 2))];
  }, [level]);

  return {
    supported,
    state,
    listening: state === "listening" || state === "processing",
    start,
    stop,
    toggle,
    level,
    bands,
  };
}
