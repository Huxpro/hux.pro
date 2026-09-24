// =============================================================================
// The voice meter — how loud, and where in the spectrum, right now.
//
// One AudioContext for the page, one analyser per microphone stream, nothing
// connected to the speakers: the voice is measured, never played. Reading the
// meter is cheap and lazy — the glow calls `level()` / `bands()` once a frame
// and the analysis happens then, so a meter nobody reads costs nothing.
//
// The raw numbers are shaped the way voice-glow shapes them (Libraries.dev),
// because raw RMS is a poor picture of a voice:
//
//   gain        a laptop microphone at speaking distance reads 0.03–0.2 RMS;
//               lifted into the range the curve expects.
//   gate        below the threshold is silence, so room noise stays dark.
//   saturation  a soft knee, so a shout rounds off instead of clipping.
//   envelope    fast up (attack), slow down (release): the glow leaps with a
//               syllable and settles between words instead of flickering.
//   bands       80–300 Hz (the voice's body), 300–2000 (vowels), 2–6 kHz
//               (sibilance), each on its own envelope — so the glow's beams
//               ripple with a sentence rather than pumping in unison.
// =============================================================================

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  if (!context) context = new Ctor();
  if (context.state === "suspended") void context.resume().catch(() => {});
  return context;
}

/** Create (and resume) the shared context. Call inside the gesture that
 *  starts listening: Safari only lets audio start in one. */
export function primeAudio() {
  audioContext();
}

const BANDS: ReadonlyArray<readonly [number, number]> = [
  [80, 300],
  [300, 2000],
  [2000, 6000],
];
const GAIN = 5;
const BAND_GAIN = 1.7;
const THRESHOLD = 0.02;
const ATTACK = 0.12;
const RELEASE = 0.55;

function shape(raw: number, threshold: number) {
  if (raw <= threshold) return 0;
  const t = (raw - threshold) / (1 - threshold);
  return Math.min(1, (1 - Math.exp(-3 * t)) / (1 - Math.exp(-3)));
}

function follow(prev: number, target: number, dt: number) {
  const tau = target > prev ? ATTACK : RELEASE;
  return prev + (target - prev) * (1 - Math.exp(-dt / tau));
}

export interface VoiceMeter {
  /** Smoothed loudness, 0–1. */
  level: () => number;
  /** Smoothed low / mid / high energy, 0–1 each. */
  bands: () => readonly [number, number, number];
  /** Disconnect the analyser. The stream itself is the caller's to stop. */
  release: () => void;
}

/** A meter on a microphone stream, or null without Web Audio / an audio track. */
export function createMeter(stream: MediaStream): VoiceMeter | null {
  const ctx = audioContext();
  if (!ctx || stream.getAudioTracks().length === 0) return null;
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.5;
  source.connect(analyser);

  const time = new Float32Array(analyser.fftSize);
  const freq = new Uint8Array(analyser.frequencyBinCount);
  const binHz = ctx.sampleRate / analyser.fftSize;
  let level = 0;
  const bands: [number, number, number] = [0, 0, 0];
  let lastRead = 0;

  // Both getters share one analysis per frame.
  const read = () => {
    const now = performance.now();
    if (now - lastRead < 8) return;
    const dt = lastRead ? Math.min(0.05, (now - lastRead) / 1000) : 1 / 60;
    lastRead = now;
    analyser.getFloatTimeDomainData(time);
    let sum = 0;
    for (let i = 0; i < time.length; i++) sum += time[i] * time[i];
    level = follow(level, shape(Math.sqrt(sum / time.length) * GAIN, THRESHOLD), dt);
    analyser.getByteFrequencyData(freq);
    for (let b = 0; b < 3; b++) {
      const from = Math.max(0, Math.floor(BANDS[b][0] / binHz));
      const to = Math.min(freq.length - 1, Math.ceil(BANDS[b][1] / binHz));
      let acc = 0;
      for (let i = from; i <= to; i++) acc += freq[i];
      const avg = acc / (to - from + 1) / 255;
      bands[b] = follow(bands[b], shape(avg * BAND_GAIN, THRESHOLD * 0.6), dt);
    }
  };

  return {
    level: () => {
      read();
      return level;
    },
    bands: () => {
      read();
      return bands;
    },
    release: () => {
      try {
        source.disconnect();
        analyser.disconnect();
      } catch {
        /* already gone */
      }
    },
  };
}
