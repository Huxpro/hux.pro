// =============================================================================
// The waking, shared by the dreams.
//
// However the dream ends, the waking is the same: a beat of black, the eyes
// snap open, a gasp, the panting slowing until the clock in the house is
// heard. Still night, only the room. Calm. Then the breath catches and the
// wardrobe door opens on its own, and in the gap, the glint.
//
// Each dream spreads WAKING_BEATS into its own timeline (so "门慢一点" is
// beat.door.over in either), calls waking(u, beats) for the picture, u
// seconds into its awake phase, and wakingSound() from its director.
// =============================================================================

import { beat, type Timing } from "scene";
import type { Sound } from "./sound";

export const WAKING_BEATS = {
  snap: beat(1.0, { aka: ["睁眼", "惊醒", "the eyes open"], note: "黑了一拍，眼睛猛地睁开，一口气 · a beat of black, the eyes snap open, a gasp" }),
  blink1: beat(3.6, { aka: ["眨眼"], note: "一次眨眼 · a blink" }),
  clock: beat(4.5, { aka: ["钟", "滴答", "the clock"], note: "钟声被听见 · the clock is heard" }),
  blink2: beat(7.4, { aka: ["眨眼"], note: "又一次眨眼 · another blink" }),
  door: beat(9.5, { over: 6.5, aka: ["柜门打开", "门开", "开门", "the door opens"], note: "呼吸一停，柜门开始打开 · the breath catches; the door begins to open" }),
  peek: beat(16, { over: 2.6, aka: ["门缝里的眼睛", "the eye in the gap"], note: "门缝里，那点反光 · in the gap, the glint" }),
  line: beat(18.5, { aka: ["那句话", "the words"], note: "字出现 · the words" }),
};

export type WakingBeats = { [K in keyof typeof WAKING_BEATS]: Timing };

export const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// -----------------------------------------------------------------------------
// The breath after waking: fast and deep at first, slower and smaller as it
// settles; held when the door moves. Its phase is the integral of 1/period,
// tabulated once, so it is a function of time and not of frames. Both are in
// seconds since the eyes opened (u - beat.snap.at).
// -----------------------------------------------------------------------------

const breathPeriod = (d: number) => 0.62 + (3.0 - 0.62) * ease(d / 8);
const BREATH_STEP = 0.01;
const BREATH_TABLE: number[] = (() => {
  const out = [0];
  for (let i = 1; i <= 40 / BREATH_STEP; i++) out.push(out[i - 1] + BREATH_STEP / breathPeriod((i - 0.5) * BREATH_STEP));
  return out;
})();

/** Breaths taken since the eyes opened (fractional), d seconds after. */
export function breathPhase(d: number): number {
  if (d <= 0) return 0;
  const x = Math.min(d / BREATH_STEP, BREATH_TABLE.length - 1);
  const i = Math.floor(x);
  return lerp(BREATH_TABLE[i], BREATH_TABLE[Math.min(i + 1, BREATH_TABLE.length - 1)], x - i);
}

export const breathAmp = (d: number) => 1 - 0.78 * ease(d / 8);

function breathLift(u: number, b: WakingBeats): number {
  if (u < b.snap.at) return 0;
  const at = (v: number) => {
    const d = v - b.snap.at;
    const ph = breathPhase(d) % 1;
    return (ph < 0.42 ? ease(ph / 0.42) : 1 - ease((ph - 0.42) / 0.58)) * breathAmp(d);
  };
  if (u < b.door.at) return at(u);
  // Held at the top of a breath.
  const held = at(b.door.at);
  return 0.5 + (held - 0.5) * Math.exp(-3 * (u - b.door.at));
}

// -----------------------------------------------------------------------------
// The picture, u seconds into waking
// -----------------------------------------------------------------------------

export interface Waking {
  /** The wardrobe's right door, and the glint in the gap. */
  door: number;
  peek: number;
  /** The room, rising and falling with the breath (an svg transform). */
  room: string;
  /** Focus coming back (css filter), and the head off the pillow (css transform). */
  filter: string;
  jolt: string;
  lids: { closed: boolean; speed: number };
  line: boolean;
}

export function waking(u: number, b: WakingBeats): Waking {
  const lift = breathLift(u, b);
  const k = ease((u - b.snap.at) / 2.2);
  const blur = u < b.snap.at ? 9 : 9 * (1 - k);
  const bright = u < b.snap.at ? 0.45 : 0.45 + 0.55 * k;
  const parts = [];
  if (bright < 0.999) parts.push(`brightness(${bright.toFixed(3)})`);
  if (blur > 0.05) parts.push(`blur(${blur.toFixed(2)}px)`);

  let jolt = "none";
  if (u >= b.snap.at && u < b.snap.at + 0.8) {
    const p = (u - b.snap.at) / 0.8;
    const [y, sc] =
      p < 0.35
        ? [lerp(22, -6, ease(p / 0.35)), lerp(1.07, 1.01, ease(p / 0.35))]
        : [lerp(-6, 0, ease((p - 0.35) / 0.65)), lerp(1.01, 1, ease((p - 0.35) / 0.65))];
    jolt = `translateY(${y.toFixed(2)}px) scale(${sc.toFixed(4)})`;
  }

  return {
    door: 0.36 * ease((u - b.door.at) / b.door.over),
    peek: ease((u - b.peek.at) / b.peek.over),
    room: `translate(195 776) scale(${(1 + 0.016 * lift).toFixed(4)}) translate(-195 -776) translate(0 ${(-5 * lift).toFixed(2)})`,
    filter: parts.join(" ") || "none",
    jolt,
    lids: {
      closed: u < b.snap.at || (u >= b.blink1.at && u < b.blink1.at + 0.11) || (u >= b.blink2.at && u < b.blink2.at + 0.11),
      speed: u < b.blink1.at ? 0.13 : 0.09,
    },
    line: u > b.line.at,
  };
}

// -----------------------------------------------------------------------------
// The sound: from the director, every frame of the waking, with the last
// frame's u (pu) and this one's. Edges only: each thing is played once.
// -----------------------------------------------------------------------------

export function wakingSound(sound: Sound, pu: number, u: number, b: WakingBeats): void {
  const crossed = (beat: number) => pu < beat && u >= beat;
  if (crossed(b.snap.at)) {
    sound.gasp();
    sound.roomTo(0.1, 0.8);
    if (navigator.vibrate) navigator.vibrate(60);
  }
  // The breath, until it catches.
  const d = u - b.snap.at;
  if (d > 0 && u < b.door.at) {
    const before = breathPhase(pu - b.snap.at);
    const after = breathPhase(d);
    if (Math.floor(after) > Math.floor(before)) sound.breathe(true, breathAmp(d));
    if (before % 1 < 0.42 && after % 1 >= 0.42 && Math.floor(before) === Math.floor(after)) sound.breathe(false, breathAmp(d));
  }
  // The heart: loud at first, gone by the time the clock is heard; back when the door moves.
  const since = u - b.door.at - 1;
  const beatEvery = d < 4 ? 0.48 + 0.4 * (d / 4) : u > b.door.at ? 1 - 0.42 * Math.min(1, since / 6) : 0;
  if (beatEvery && d > 0 && Math.floor(u / beatEvery) > Math.floor(pu / beatEvery)) {
    sound.thump(d < 4 ? 0.6 * (1 - d / 4) + 0.05 : 0.12 + 0.5 * Math.min(1, since / 6));
  }
  if (u > b.clock.at && Math.floor(u - b.clock.at) > Math.floor(pu - b.clock.at)) sound.tick(Math.min(1, (u - b.clock.at) / 2.5));
  if (crossed(b.door.at)) sound.creak(b.door.over, 0.6);
}
