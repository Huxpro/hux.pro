// =============================================================================
// The Wardrobe as a function of (state, t).
//
// Everything that moves is computed here from where the dream is (the phase
// and when it began), the clock, and the timeline's values (its beats, with
// whatever overrides lie over them). Nothing is integrated frame by frame and
// nothing reads the wall clock, so any moment can be held, and the same moment
// always draws the same picture. The scene (Wardrobe.tsx) draws what this says;
// the director plays the sounds it implies.
// =============================================================================

import { beat, num, timeline, type TimelineValues } from "scene";

/** The dream's phases, in order: the gap, in the wardrobe, at the bed, awake. */
export const PHASES = ["gap", "inside", "bedside", "awake"] as const;

export const TIMELINE = timeline({
  // The waking's beats, in seconds since the last release.
  beats: {
    snap: beat(1.0, { aka: ["睁眼", "惊醒", "the eyes open"], note: "黑了一拍，眼睛猛地睁开，一口气 · a beat of black, the eyes snap open, a gasp" }),
    blink1: beat(3.6, { aka: ["眨眼"], note: "一次眨眼 · a blink" }),
    clock: beat(4.5, { aka: ["钟", "滴答", "the clock"], note: "钟声被听见 · the clock is heard" }),
    blink2: beat(7.4, { aka: ["眨眼"], note: "又一次眨眼 · another blink" }),
    door: beat(9.5, { over: 6.5, aka: ["柜门打开", "门开", "开门", "the door opens"], note: "呼吸一停，柜门开始打开 · the breath catches; the door begins to open" }),
    peek: beat(16, { over: 2.6, aka: ["门缝里的眼睛", "the eye in the gap"], note: "门缝里，那点反光 · in the gap, the glint" }),
    line: beat(18.5, { aka: ["那句话", "the words"], note: "字出现 · the words" }),
  },
  phases: {
    gap: { label: "门缝 · the gap", aka: ["门缝", "柜门开了一条缝"] },
    inside: { label: "衣柜里 · in the wardrobe", aka: ["站在衣柜里面", "in the wardrobe"] },
    bedside: { label: "床头 · at the bed", aka: ["站在我的床头", "at the bed"] },
    awake: { label: "醒来 · awake", aka: ["我醒了", "醒了", "I woke"] },
  },
  inputs: {
    hold: {
      aka: ["按住", "闭眼", "hold", "close your eyes"],
      does: "按住闭眼，松开睁眼；每睁开一次，梦往前走一步 · hold to close the eyes, let go to open them; each opening moves the dream on",
      params: { minBlink: num(0.52, { min: 0.1, max: 2, step: 0.01, unit: "s", aka: ["眨眼至少多久", "a blink's least length"] }) },
    },
    tap: { aka: ["再梦一次", "dream again"], does: "字出现之后，点一下再梦一次 · after the words, tap to dream again" },
  },
});

export type Timeline = TimelineValues<typeof TIMELINE>;
export type Beats = Timeline["beat"];

export type Stage = 0 | 1 | 2 | 3;

export interface State {
  /** 0 the gap · 1 in the wardrobe · 2 at the bed · 3 awake (PHASES) */
  stage: Stage;
  /** When this stage began, on the scene's clock. */
  at: number;
  /** In a dream stage: are the eyes being held shut? */
  closed: boolean;
  closedAt: number;
  /** Released, waiting for the blink to have lasted long enough. */
  pending: boolean;
  /** How the stage was entered: the first look, a blink, a replay, a still. */
  via: "start" | "blink" | "replay" | "still";
}

export const initial: State = { stage: 0, at: 0, closed: false, closedAt: 0, pending: false, via: "start" };

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

function breathLift(u: number, b: Beats): number {
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
// The picture
// -----------------------------------------------------------------------------

export interface View {
  u: number; // seconds into this stage
  dream: boolean;
  doors: { left: number; right: number };
  manInWardrobe: { tilt: number; eyes: number } | null;
  manAtBed: { scale: number; lean: number; eyes: number } | null;
  /** The room: the dream's swim and breathing, or the waking breath. */
  room: string;
  double: string | null; // the dream's second image
  filter: string;
  jolt: string;
  lids: { closed: boolean; speed: number };
  hint: "hint" | "again" | null;
  line: boolean;
}

export function view(s: State, t: number, { beat: b }: Timeline): View {
  const u = Math.max(0, t - s.at);
  const dream = s.stage < 3;

  // Doors: how far each stands open.
  let left = 0;
  let right = 0;
  if (s.stage === 0) right = 0.12 + 0.06 * ease((u - 2) / 8);
  if (s.stage === 1) { left = 0.74 + 0.02 * Math.sin(u * 0.6); right = 0.7 + 0.02 * Math.sin(u * 0.7 + 1); }
  if (s.stage === 2) { left = 0.74; right = 0.7; }
  if (s.stage === 3) right = 0.36 * ease((u - b.door.at) / b.door.over);

  // Him.
  const eyesOpen = !s.closed;
  const manInWardrobe =
    s.stage === 2
      ? null
      : {
          tilt: s.stage === 1 ? -1.2 * ease((u - 1) / 3) : 0,
          eyes: s.stage === 0 && eyesOpen ? ease((u - 2.6) / 2.2) : s.stage === 3 ? ease((u - b.peek.at) / b.peek.over) : 0,
        };
  const manAtBed = s.stage === 2 ? { scale: 1.9 + 0.1 * ease(u / 7), lean: -2.5 - 1.5 * ease(u / 7), eyes: eyesOpen ? ease((u - 1.4) / 2.2) : 0 } : null;

  // The room breathes. In the dream: slowly, faster as he nears, and it swims.
  const TAU = Math.PI * 2;
  let room: string;
  let double: string | null = null;
  if (dream) {
    const period = [4.2, 3.1, 2.2][s.stage];
    const b = 0.5 - 0.5 * Math.cos((TAU * t) / period);
    const w = (TAU * t) / 9;
    room =
      `translate(195 776) scale(${(1 + 0.012 * b + 0.006 * (1 - Math.cos(w))).toFixed(4)}) translate(-195 -776) ` +
      `translate(0 ${(-b).toFixed(2)}) rotate(${(0.5 * Math.sin(w)).toFixed(3)} 195 470) skewX(${(0.6 * Math.sin(w + 1)).toFixed(3)})`;
    const g = (TAU * t) / 6.5;
    double = `translate(${(7.5 * Math.cos(g)).toFixed(2)} ${(1 - 4 * Math.cos(g)).toFixed(2)}) translate(195 470) scale(${(1.021 - 0.005 * Math.cos(g)).toFixed(4)}) translate(-195 -470)`;
  } else {
    const lift = breathLift(u, b);
    room = `translate(195 776) scale(${(1 + 0.016 * lift).toFixed(4)}) translate(-195 -776) translate(0 ${(-5 * lift).toFixed(2)})`;
  }

  // Focus: each opening in the dream comes into focus; waking, slower.
  let blur = 0;
  let bright = 1;
  if (dream && s.via !== "start" && s.via !== "still") {
    const k = ease(u / 0.7);
    blur = 5 * (1 - k);
    bright = 0.8 + 0.2 * k;
  }
  if (!dream) {
    const k = ease((u - b.snap.at) / 2.2);
    blur = u < b.snap.at ? 9 : 9 * (1 - k);
    bright = u < b.snap.at ? 0.45 : 0.45 + 0.55 * k;
  }
  const parts = [];
  if (dream) parts.push(`saturate(0.8) hue-rotate(14deg) brightness(${(1.06 * bright).toFixed(3)})`);
  else if (bright < 0.999) parts.push(`brightness(${bright.toFixed(3)})`);
  if (blur > 0.05) parts.push(`blur(${blur.toFixed(2)}px)`);
  const filter = parts.join(" ") || "none";

  // Waking: the head off the pillow.
  let jolt = "none";
  if (!dream && u >= b.snap.at && u < b.snap.at + 0.8) {
    const p = (u - b.snap.at) / 0.8;
    const [y, sc] = p < 0.35 ? [lerp(22, -6, ease(p / 0.35)), lerp(1.07, 1.01, ease(p / 0.35))] : [lerp(-6, 0, ease((p - 0.35) / 0.65)), lerp(1.01, 1, ease((p - 0.35) / 0.65))];
    jolt = `translateY(${y.toFixed(2)}px) scale(${sc.toFixed(4)})`;
  }

  // The lids.
  let closed = s.closed || (s.via === "replay" && s.stage === 0 && u < 0.9);
  let speed = closed ? 0.26 : 0.7;
  if (!dream) {
    closed = u < b.snap.at || (u >= b.blink1.at && u < b.blink1.at + 0.11) || (u >= b.blink2.at && u < b.blink2.at + 0.11);
    speed = u < b.blink1.at ? 0.13 : 0.09;
  }

  const hint = !dream || s.closed || s.pending ? null : s.stage === 0 ? (u > 1.2 ? "hint" : null) : u > 3.9 ? "again" : null;

  return {
    u,
    dream,
    doors: { left, right },
    manInWardrobe,
    manAtBed,
    room,
    double,
    filter,
    jolt,
    lids: { closed, speed },
    hint,
    line: !dream && u > b.line.at,
  };
}

// -----------------------------------------------------------------------------
// Stills: the moments an inspector, a thumbnail or a sentence can go to.
// -----------------------------------------------------------------------------

// Each is a phase and a time in it; the waking's are set against its beats,
// so a retimed waking still holds the same moments.
export const STILLS = [
  { name: "gap", label: "门缝 · the gap", phase: "gap", u: () => 5.5, expect: ["man[wardrobe].eyes", "wardrobe.door.right"] },
  { name: "inside", label: "衣柜里 · in the wardrobe", phase: "inside", u: () => 4, expect: ["man[wardrobe]"] },
  { name: "bedside", label: "床头 · at the bed", phase: "bedside", u: () => 4, expect: ["man[bedside]", "man[bedside].eyes"] },
  { name: "calm", label: "平静 · calm", phase: "awake", u: (b: Beats) => b.door.at - 2.5, expect: ["wardrobe", "bed.blanket"] },
  { name: "door", label: "开门 · the door", phase: "awake", u: (b: Beats) => b.peek.at + 1.5, expect: ["wardrobe.door.right", "man[wardrobe].eyes"] },
] as const;

export type StillName = (typeof STILLS)[number]["name"];

export type Action =
  | { type: "close"; t: number }
  | { type: "release"; t: number }
  | { type: "tick"; t: number; minBlink: number }
  | { type: "replay"; t: number }
  | { type: "still"; name: string | null; t: number; u: number };

export function reduce(s: State, a: Action): State {
  switch (a.type) {
    case "close":
      return s.stage < 3 && !s.closed && !s.pending ? { ...s, closed: true, closedAt: a.t } : s;
    case "release":
      return s.closed && !s.pending ? { ...s, pending: true } : s;
    case "tick": {
      if (!s.pending || a.t - s.closedAt < a.minBlink) return s;
      // The third: the eyes stay shut, the dream stops, you wake.
      if (s.stage === 2) return { stage: 3, at: a.t, closed: false, closedAt: 0, pending: false, via: "blink" };
      return { stage: (s.stage + 1) as Stage, at: a.t, closed: false, closedAt: 0, pending: false, via: "blink" };
    }
    case "replay":
      return { ...initial, at: a.t, via: "replay" };
    case "still": {
      if (a.name === null) return s;
      const still = STILLS.find((x) => x.name === a.name);
      if (!still) return s;
      return { stage: PHASES.indexOf(still.phase) as Stage, at: a.t - a.u, closed: false, closedAt: 0, pending: false, via: "still" };
    }
  }
}
