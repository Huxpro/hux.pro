// =============================================================================
// The timeline: when things happen, what the scene's moments are called, and
// what a person does to it.
//
//   beats    named times, in seconds, each with a length when it takes one
//            (the door opens at 9.5, over 6.5). "门慢一点" is beat.door.over.
//   phases   the states of the scene's machine, named: what a still is in,
//            what "我醒了" points at.
//   inputs   what a person does, and the numbers that shape it (how long a
//            blink has to last to count).
//
// Declared once, beside the scene's (state, t) function, and read through
// useTimeline() (or the values the stage hands its callbacks), which lays
// overrides over it: keys "beat.door" (at, over) and "input.hold" (its
// params). The inspector or a sentence can retime a scene without its code
// changing, the same way params reshape a thing.
// =============================================================================

import { defaults, type Params, type ParamValues } from "./spec";

export interface BeatSpec {
  at: number;
  /** How long it takes, when it takes time. */
  over?: number;
  aka?: readonly string[];
  /** One line: what happens then. */
  note?: string;
}

export interface PhaseSpec {
  label?: string;
  aka?: readonly string[];
}

export interface InputSpec<P extends Params = Params> {
  aka?: readonly string[];
  /** One line: what it does. */
  does?: string;
  params?: P;
}

export interface TimelineSpec {
  beats: Readonly<Record<string, BeatSpec>>;
  phases: Readonly<Record<string, PhaseSpec>>;
  inputs?: Readonly<Record<string, InputSpec>>;
}

export interface Timing {
  at: number;
  over: number;
  /** at + over */
  end: number;
}

type InputValues<I> = { [K in keyof I]: I[K] extends { params: infer P extends Params } ? ParamValues<P> : Record<string, never> };

export interface TimelineValues<T extends TimelineSpec = TimelineSpec> {
  beat: { [K in keyof T["beats"]]: Timing };
  input: InputValues<NonNullable<T["inputs"]>>;
}

export function beat(at: number, o: Omit<BeatSpec, "at"> = {}): BeatSpec {
  return { at, ...o };
}

// The one timeline on the page, for the manifest and for names: like the
// declarations, it exists before anything mounts.
let DECLARED: TimelineSpec | null = null;

/** Declare the scene's timeline. Returns it, typed, for <Stage timeline> and useTimeline(). */
export function timeline<const T extends TimelineSpec>(spec: T): T {
  DECLARED = spec;
  return spec;
}

export function declaredTimeline(): TimelineSpec | null {
  return DECLARED;
}

/** Is "beat.door", "phase.awake" or "input.hold" (or a param under it) declared? */
export function inTimeline(root: string, name: string | null): boolean {
  const tl = DECLARED;
  if (!tl) return false;
  if (!name) return true;
  const [head, sub] = name.split(".");
  if (root === "beat") return head in tl.beats && (!sub || sub === "at" || sub === "over");
  if (root === "phase") return head in tl.phases && !sub;
  if (root === "input") {
    const input = tl.inputs?.[head];
    return !!input && (!sub || sub in (input.params ?? {}));
  }
  return false;
}

/** The timeline's values, with overrides laid over the declared ones. */
export function resolveTimeline<T extends TimelineSpec>(spec: T, overrides: (key: string) => Record<string, unknown> | undefined): TimelineValues<T> {
  const beatValues: Record<string, Timing> = {};
  for (const [name, b] of Object.entries(spec.beats)) {
    const o = overrides(`beat.${name}`);
    const at = Number(o?.at ?? b.at);
    const over = Number(o?.over ?? b.over ?? 0);
    beatValues[name] = { at, over, end: at + over };
  }
  const inputValues: Record<string, Record<string, unknown>> = {};
  for (const [name, input] of Object.entries(spec.inputs ?? {})) {
    inputValues[name] = { ...defaults(input.params), ...overrides(`input.${name}`) };
  }
  return { beat: beatValues, input: inputValues } as TimelineValues<T>;
}
