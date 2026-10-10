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

import { num, timeline, type TimelineValues } from "scene";
import { WAKING_BEATS, ease, waking } from "../common/waking";

/** The dream's phases, in order: the gap, in the wardrobe, at the bed, awake. */
export const PHASES = ["gap", "inside", "bedside", "awake"] as const;

export const TIMELINE = timeline({
  // The waking's beats (shared with the other dreams), in seconds since the last release.
  beats: WAKING_BEATS,
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

  // Awake: the shared waking (common/waking.ts), in this room.
  if (s.stage === 3) {
    const w = waking(u, b);
    return {
      u,
      dream: false,
      doors: { left: 0, right: w.door },
      manInWardrobe: { tilt: 0, eyes: w.peek },
      manAtBed: null,
      room: w.room,
      double: null,
      filter: w.filter,
      jolt: w.jolt,
      lids: w.lids,
      hint: null,
      line: w.line,
    };
  }

  // Doors: how far each stands open.
  let left = 0;
  let right = 0;
  if (s.stage === 0) right = 0.12 + 0.06 * ease((u - 2) / 8);
  if (s.stage === 1) { left = 0.74 + 0.02 * Math.sin(u * 0.6); right = 0.7 + 0.02 * Math.sin(u * 0.7 + 1); }
  if (s.stage === 2) { left = 0.74; right = 0.7; }

  // Him.
  const eyesOpen = !s.closed;
  const manInWardrobe =
    s.stage === 2 ? null : { tilt: s.stage === 1 ? -1.2 * ease((u - 1) / 3) : 0, eyes: s.stage === 0 && eyesOpen ? ease((u - 2.6) / 2.2) : 0 };
  const manAtBed = s.stage === 2 ? { scale: 1.9 + 0.1 * ease(u / 7), lean: -2.5 - 1.5 * ease(u / 7), eyes: eyesOpen ? ease((u - 1.4) / 2.2) : 0 } : null;

  // The room breathes: slowly, faster as he nears, and it swims; a second
  // room a few pixels off the first.
  const TAU = Math.PI * 2;
  const period = [4.2, 3.1, 2.2][s.stage];
  const breath = 0.5 - 0.5 * Math.cos((TAU * t) / period);
  const w = (TAU * t) / 9;
  const room =
    `translate(195 776) scale(${(1 + 0.012 * breath + 0.006 * (1 - Math.cos(w))).toFixed(4)}) translate(-195 -776) ` +
    `translate(0 ${(-breath).toFixed(2)}) rotate(${(0.5 * Math.sin(w)).toFixed(3)} 195 470) skewX(${(0.6 * Math.sin(w + 1)).toFixed(3)})`;
  const g = (TAU * t) / 6.5;
  const double = `translate(${(7.5 * Math.cos(g)).toFixed(2)} ${(1 - 4 * Math.cos(g)).toFixed(2)}) translate(195 470) scale(${(1.021 - 0.005 * Math.cos(g)).toFixed(4)}) translate(-195 -470)`;

  // Focus: each opening in the dream comes into focus.
  let blur = 0;
  let bright = 1;
  if (s.via !== "start" && s.via !== "still") {
    const k = ease(u / 0.7);
    blur = 5 * (1 - k);
    bright = 0.8 + 0.2 * k;
  }
  const filter = `saturate(0.8) hue-rotate(14deg) brightness(${(1.06 * bright).toFixed(3)})${blur > 0.05 ? ` blur(${blur.toFixed(2)}px)` : ""}`;

  // The lids.
  const closed = s.closed || (s.via === "replay" && s.stage === 0 && u < 0.9);
  const hint = s.closed || s.pending ? null : s.stage === 0 ? (u > 1.2 ? "hint" : null) : u > 3.9 ? "again" : null;

  return {
    u,
    dream: true,
    doors: { left, right },
    manInWardrobe,
    manAtBed,
    room,
    double,
    filter,
    jolt: "none",
    lids: { closed, speed: closed ? 0.26 : 0.7 },
    hint,
    line: false,
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
