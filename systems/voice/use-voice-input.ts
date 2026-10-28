"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createMeter, primeAudio, type VoiceMeter } from "./lib/meter";
import type { VoiceModelChoice } from "./models";
import { voiceModelPref } from "./prefs";

// =============================================================================
// useVoiceInput: speak instead of type.
//
// Two recognition paths share one microphone glow:
//
//   browser  the Web Speech API (`SpeechRecognition`, `webkitSpeechRecognition`
//           in Safari and Chrome): interim words as they are heard, the final
//           phrase when the speaker pauses. The browser does the recognition,
//           on-device or via its vendor's service; nothing goes through this
//           site.
//   gateway  MediaRecorder captures after a tap or during a hold; stopping
//           sends the clip through this site's server to the selected model.
//   glow    a microphone stream through the voice meter (lib/meter.ts), for
//           the glow to follow: how loud, which bands. Where a second capture
//           is refused (some Android browsers hold the microphone for the
//           recogniser alone), the level is synthesised from the recogniser's
//           own sound / speech events, so the glow still answers the voice.
//   idle    from the press, a slow breath under the level (IDLE): the glow
//           and the waveform move at once, before the microphone is open
//           and between words, instead of waking at the first syllable.
//
// States: idle → listening → processing → idle. `denied` and `error` say why
//          a start or transcription failed. `supported` is true if either
//          a server-enabled Gateway model or browser recogniser is available.
// =============================================================================

type RecognitionState = "idle" | "listening" | "processing" | "denied" | "error";
type VoiceMode = "browser" | "gateway";
type VoiceGesture = "idle" | "hold" | "cancel";

function recordingType(): string | null {
  if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  return ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"]
    .find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

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
  /** `send` is true only for a Gateway hold released inside the field. */
  onFinal?: (text: string, send?: boolean) => void;
}

export interface VoiceInput {
  supported: boolean;
  mode: VoiceMode;
  state: RecognitionState;
  listening: boolean;
  gesture: VoiceGesture;
  setGesture: (gesture: VoiceGesture) => void;
  /** Start (from a press: the microphone is only granted in a gesture). */
  start: () => void;
  /** Finish recording. `send` asks the consumer to submit the transcript. */
  stop: (send?: boolean) => void;
  /** Stop and drop what is still to come: words heard after this are not
   *  delivered (a field that has just been sent wants nothing more). */
  abort: () => void;
  toggle: () => void;
  /** Loudness 0–1 for the glow, read every frame. */
  level: () => number;
  /** Low / mid / high 0–1 for the glow, read every frame. */
  bands: () => readonly [number, number, number];
}

/** The breath under a listening level: its floor, its swing, its rate. */
const IDLE = { floor: 0.17, swing: 0.06, rate: 2.4 } as const;

export function useVoiceInput({ lang, onInterim, onFinal }: VoiceInputOptions): VoiceInput {
  const [supported, setSupported] = useState(false);
  const [mode, setMode] = useState<VoiceMode>("browser");
  const [gatewayEnabled, setGatewayEnabled] = useState(false);
  const [failedModel, setFailedModel] = useState<VoiceModelChoice | null>(null);
  const selectedModel = voiceModelPref.use();
  const [state, setState] = useState<RecognitionState>("idle");
  const [gesture, setGesture] = useState<VoiceGesture>("idle");
  const recognition = useRef<Recognition | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const awaitingMicrophone = useRef(false);
  const activeMode = useRef<VoiceMode | null>(null);
  const session = useRef(0);
  const upload = useRef<AbortController | null>(null);
  const sendOnFinal = useRef(false);
  const recordingTimer = useRef<number | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const meter = useRef<VoiceMeter | null>(null);
  // The synthetic level, for when no meter could be had. `t0` is when
  // listening began (0 when not listening): the idle breath's clock.
  const synth = useRef({ sound: false, speech: false, pulse: 0, t0: 0 });
  const floored = useRef<[number, number, number]>([0, 0, 0]);
  const callbacks = useRef({ onInterim, onFinal });
  useEffect(() => {
    callbacks.current = { onInterim, onFinal };
  });

  useEffect(() => {
    let alive = true;
    if (!recordingType()) return;
    fetch("/api/voice", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((config) => {
        if (!alive || !config?.enabled) return;
        setGatewayEnabled(true);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (activeMode.current) return;
    const gatewayReady = gatewayEnabled && selectedModel !== "browser" && selectedModel !== failedModel;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe browser capability
    setMode(gatewayReady ? "gateway" : "browser");
    setSupported(recognitionCtor() !== null || gatewayReady);
  }, [gatewayEnabled, failedModel, selectedModel, state]);

  const release = useCallback(() => {
    meter.current?.release();
    meter.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    synth.current = { sound: false, speech: false, pulse: 0, t0: 0 };
  }, []);

  const stop = useCallback((send = false) => {
    setGesture("idle");
    if (activeMode.current === "gateway") {
      if (!recorder.current) {
        if (!awaitingMicrophone.current) return;
        // A quick release can precede the microphone permission response.
        session.current++;
        awaitingMicrophone.current = false;
        activeMode.current = null;
        release();
        setState("idle");
        return;
      }
      if (recorder.current.state === "recording") {
        sendOnFinal.current = send;
        setState("processing");
        recorder.current.stop();
      }
      return;
    }
    recognition.current?.stop();
  }, [release]);

  const abort = useCallback(() => {
    setGesture("idle");
    sendOnFinal.current = false;
    session.current++;
    upload.current?.abort();
    upload.current = null;
    if (recordingTimer.current !== null) window.clearTimeout(recordingTimer.current);
    recordingTimer.current = null;
    if (recorder.current) {
      recorder.current.onstop = null;
      if (recorder.current.state === "recording") recorder.current.stop();
      recorder.current = null;
    }
    activeMode.current = null;
    awaitingMicrophone.current = false;
    release();
    setState("idle");
    const r = recognition.current;
    if (!r) return;
    r.onresult = null;
    r.abort();
  }, [release]);

  const start = useCallback(() => {
    if (mode === "gateway") {
      const type = recordingType();
      if (!type || activeMode.current) return;
      const id = ++session.current;
      sendOnFinal.current = false;
      activeMode.current = "gateway";
      awaitingMicrophone.current = true;
      primeAudio();
      synth.current.t0 = performance.now();
      setState("listening");
      navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
        if (session.current !== id) {
          s.getTracks().forEach((track) => track.stop());
          return;
        }
        awaitingMicrophone.current = false;
        stream.current = s;
        meter.current = createMeter(s);
        const r = new MediaRecorder(s, { mimeType: type });
        recorder.current = r;
        let startedAt = 0;
        const chunks: Blob[] = [];
        r.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
        r.onerror = () => {
          if (session.current !== id) return;
          session.current++;
          if (recordingTimer.current !== null) window.clearTimeout(recordingTimer.current);
          recordingTimer.current = null;
          activeMode.current = null;
          awaitingMicrophone.current = false;
          recorder.current = null;
          sendOnFinal.current = false;
          release();
          setState("error");
          if (voiceModelPref.get() === selectedModel) setFailedModel(selectedModel);
        };
        r.onstop = () => {
          if (session.current !== id) return;
          recorder.current = null;
          if (recordingTimer.current !== null) window.clearTimeout(recordingTimer.current);
          recordingTimer.current = null;
          release();
          if (performance.now() - startedAt < 300) {
            sendOnFinal.current = false;
            activeMode.current = null;
            setState("idle");
            return;
          }
          const audio = new Blob(chunks, { type: r.mimeType });
          if (!audio.size) {
            sendOnFinal.current = false;
            activeMode.current = null;
            setState("idle");
            return;
          }
          const controller = new AbortController();
          upload.current = controller;
          fetch("/api/voice", {
            method: "POST",
            headers: { "Content-Type": audio.type, "X-Voice-Model": selectedModel },
            body: audio,
            signal: controller.signal,
          }).then(async (response) => {
            if (!response.ok) throw new Error("Transcription failed");
            return response.json() as Promise<{ text: string }>;
          }).then(({ text }) => {
            if (session.current === id && text) {
              const shouldSend = sendOnFinal.current;
              sendOnFinal.current = false;
              callbacks.current.onFinal?.(text, shouldSend);
            }
            if (session.current === id) {
              setFailedModel(null);
              activeMode.current = null;
              setState("idle");
            }
          }).catch(() => {
            if (session.current !== id) return;
            sendOnFinal.current = false;
            activeMode.current = null;
            setState("error");
            if (voiceModelPref.get() === selectedModel) setFailedModel(selectedModel);
          }).finally(() => {
            if (upload.current === controller) upload.current = null;
          });
        };
        r.start();
        startedAt = performance.now();
        recordingTimer.current = window.setTimeout(() => stop(), 60_000);
      }).catch((error: DOMException) => {
        if (session.current !== id) return;
        release();
        activeMode.current = null;
        awaitingMicrophone.current = false;
        setState(error.name === "NotAllowedError" ? "denied" : "error");
        if (error.name !== "NotAllowedError" && voiceModelPref.get() === selectedModel) setFailedModel(selectedModel);
      });
      return;
    }
    const Ctor = recognitionCtor();
    if (!Ctor || recognition.current) return;
    activeMode.current = "browser";
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
      activeMode.current = null;
      release();
      setState((s) => (s === "denied" || s === "error" ? s : "idle"));
    };

    try {
      r.start();
      setState("listening");
    } catch {
      recognition.current = null;
      activeMode.current = null;
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
  }, [lang, mode, release, selectedModel, stop]);

  const toggle = useCallback(() => {
    if (activeMode.current) stop();
    else start();
  }, [start, stop]);

  // Stop on unmount.
  useEffect(
    () => () => {
      recognition.current?.abort();
      recognition.current = null;
      session.current++;
      awaitingMicrophone.current = false;
      upload.current?.abort();
      if (recordingTimer.current !== null) window.clearTimeout(recordingTimer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      release();
    },
    [release],
  );

  // Listening and silent (or not yet heard): the breath, never nothing.
  const idle = useCallback(() => {
    const t0 = synth.current.t0;
    if (!t0) return 0;
    const t = (performance.now() - t0) / 1000;
    return IDLE.floor + IDLE.swing * Math.sin(t * IDLE.rate);
  }, []);

  const level = useCallback(() => {
    if (meter.current) return Math.max(meter.current.level(), idle());
    const s = synth.current;
    if (!s.t0) return 0;
    const t = (performance.now() - s.t0) / 1000;
    // Words arriving are the surest sign of a voice: each result is a beat.
    const beat = Math.exp(-(performance.now() - s.pulse) / 260);
    // Before the recogniser hears anything, only the breath: a Gateway clip
    // never reports sound or speech, and has no meter until the
    // microphone opens.
    if (!s.sound && !s.speech && !s.pulse) return idle();
    const base = s.speech ? 0.5 : s.sound ? 0.3 : 0.12;
    return Math.min(1, Math.max(idle(), base + 0.35 * beat + 0.08 * Math.sin(t * 7.3)));
  }, [idle]);

  const bands = useCallback((): readonly [number, number, number] => {
    if (meter.current) {
      const b = meter.current.bands();
      const floor = idle();
      const out = floored.current;
      for (let i = 0; i < 3; i++) out[i] = Math.max(b[i], floor);
      return out;
    }
    const l = level();
    const t = performance.now() / 1000;
    return [l, l * (0.72 + 0.28 * Math.sin(t * 9.1)), l * (0.6 + 0.4 * Math.sin(t * 13.7 + 2))];
  }, [idle, level]);

  return {
    supported,
    mode,
    state,
    listening: state === "listening" || state === "processing",
    gesture,
    setGesture,
    start,
    stop,
    abort,
    toggle,
    level,
    bands,
  };
}
