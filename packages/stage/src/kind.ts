// What a kind is: one sort of thing on the stage (a globe of lights, a glow),
// written once and placed by a scene. The only place logic lives.
//
//   init    its state, once, when it is placed (seeded randomness only)
//   step    what must be simulated: it changes the state by `dt` (a pointer
//           followed, rings that come and go). Deterministic: the same seed,
//           inputs and dts give the same state.
//   frame   what is drawn now, from state, props and time. No side effects:
//           the same arguments give the same output.
//   draw    paints the output. The only thing that touches the canvas.
//   measure where the output is, for the inspector, the rules and anchors.
//
// The host calls them in that order every frame; React renders only when the
// scene's phase changes.

import type { Shape } from "sem";
import type { Param } from "sem";

export type Point = { x: number; y: number };

export interface Layout {
  w: number;
  h: number;
  dpr: number;
  center: Point;
  /** `pct` percent of the shorter side, as CSS vmin. */
  vmin(pct: number): number;
}

export interface Time {
  /** Seconds since this run of the stage began. */
  now: number;
  /** Seconds since the last frame (at most a quarter: a hidden tab is not caught up). */
  dt: number;
  phase: string;
  /** Seconds since `phase` was entered; -1 if it has not been. */
  since(phase: string): number;
}

/** A seeded random source: the same seed, the same sequence. */
export interface Rng {
  (): number;
}

export interface Ctx {
  t: Time;
  layout: Layout;
  /** This node's own random source, seeded from the stage's seed and its id. */
  rng: Rng;
  /** The pointer, while it is over the stage. */
  pointer: Point | null;
  /** Another node's output this frame (it must come earlier in the scene). */
  out<O = unknown>(id: string): O | null;
  /** Tell the scene something happened: it may move the machine; its payload becomes `ref(event)`. */
  emit(event: string, payload?: unknown): void;
}

/** A param's description; its value is whatever the scene passed for that prop. */
export type ParamSpec = Omit<Param, "value">;

export interface KindDef<P, S, O> {
  /** The component's name, and the symbol to find it by. */
  name: string;
  /** The semantic kind: agent, field, effect, sound... */
  kind: string;
  names?: string[];
  intent: string;
  /** Where it is written, for whoever regenerates it. */
  source?: string;
  /** The props that are knobs: units, ranges, what they do. */
  params?: Partial<Record<keyof P & string, ParamSpec>>;
  backend?: "canvas2d" | "none";

  init?(props: P, ctx: Ctx): S;
  step?(state: S, props: P, ctx: Ctx): void;
  frame(state: S, props: P, ctx: Ctx): O;
  draw?(g: CanvasRenderingContext2D, out: O, props: P, ctx: Ctx): void;

  measure?(out: O, state: S, ctx: Ctx): Shape | null;
  /** Where other nodes anchor to it: steadier than `measure` (no breathing). */
  anchor?(out: O, state: S, ctx: Ctx): Shape | null;
  count?(state: S, out: O): number;
  item?(state: S, out: O, i: number): Shape | null;
  itemName?(i: number): string | undefined;
  /** What the inspector shows of it now. Keep it small. */
  inspect?(state: S, out: O, ctx: Ctx): Record<string, unknown>;

  /** A press on the stage, topmost node first; true when this node took it. */
  pointerDown?(state: S, out: O | null, p: Point, ctx: Ctx, props: P): boolean;
  pointerUp?(state: S, out: O | null, ctx: Ctx, props: P): void;
  /** The scene entered a phase. */
  enter?(state: S, props: P, phase: string, ctx: Ctx): void;
  /** It is leaving (the scene starts over, or goes): let go of what it holds (an audio context). */
  dispose?(state: S): void;
}
