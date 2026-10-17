/* eslint-disable @typescript-eslint/no-explicit-any -- ported as written (Huxpro/airtalk#845) */
/**
 * How one intent's value is settled in a context, from what its writers have said.
 *
 * Writers, in precedence order:
 *   human — a person's decision (stored): about this intent, or, at the deck scope, about every
 *           intent of its name; the one about this intent comes first
 *   model — a model's distribution over the kinds (stored; acted on only when sure enough)
 *   code  — the default the component computes as it reads (never stored)
 *
 * A person's value may be partial — piecewise on a context axis, defined on some segments only —
 * and where it is not defined the next writer speaks. A person may also only rule kinds out
 * (`{ $not }`): the rest stay open to the model and to code.
 *
 * When the intent is moot in a context (`open: false`: nothing to decide here), only a person's
 * value overrides code. When nobody sure has spoken, the value is Unresolved: code's pick as the
 * fallback, with the model's belief and the bounds a person set.
 *
 * When the intent lists its kinds, a person's value that is not one of them does not apply: the
 * program no longer has that kind (a model rewrote it). It falls through to the next writer and
 * is reported as `waiting`; it is not deleted, so when the kind is back, so is the decision.
 */

export type Dist = Record<string, number>;

export type Segment<T> = { lo?: number | null; hi?: number | null; value: T | undefined };
/** Defined segment by segment along one axis of a context (`'Screen.ratio'`): lo ≤ x < hi. */
export type Piecewise<T> = { $axis: string; segments: Segment<T>[] };
export type Not = { $not: string[] };
export type Said<T> = T | Piecewise<T> | Not;

export type Writer = 'human' | 'model';
/** Where a person's decision was made: about this intent, or about every intent of its name in the deck. */
export type Scope = 'self' | 'deck';
export type By = Writer | 'code' | 'unresolved' | 'unknown';

/** How sure a model must be (best minus second best) to act without asking. */
export const TAU = 0.2;

export declare const UNRESOLVED_BRAND: unique symbol;
export type Unresolved<T> = {
  readonly [UNRESOLVED_BRAND]: true;
  /** Code's pick, within the bounds; what to show until someone decides. */
  readonly fallback: T | undefined;
  readonly belief?: Dist;
  readonly not?: string[];
  readonly ask: boolean;
};
/** The intent's data is not loaded here (a page held as a placeholder): not "nobody decided". */
export const UNKNOWN = Symbol.for('reintent.unknown');
export type Unknown = typeof UNKNOWN;

export const isUnresolved = <T>(v: unknown): v is Unresolved<T> =>
  !!v && typeof v === 'object' && (v as any).$unresolved === true;
export const isPiecewise = (v: unknown): v is Piecewise<unknown> =>
  !!v && typeof v === 'object' && typeof (v as any).$axis === 'string';
export const isNot = (v: unknown): v is Not => !!v && typeof v === 'object' && Array.isArray((v as any).$not);

export function margin(p: Dist): number {
  const v = Object.values(p).sort((a, b) => b - a);
  return v.length < 2 ? 1 : v[0] - v[1];
}
export const argmax = (p: Dist): string | undefined => Object.entries(p).sort((a, b) => b[1] - a[1])[0]?.[0];

/** A piecewise value read at a point; a constant is itself everywhere. */
export function at<T>(
  v: Said<T> | undefined,
  axis: (name: string) => number | undefined,
): T | Not | undefined {
  if (!isPiecewise(v)) return v as T | Not | undefined;
  const x = axis(v.$axis);
  if (x === undefined) return undefined;
  const s = v.segments.find((s) => (s.lo ?? -Infinity) <= x && x < (s.hi ?? Infinity));
  return s?.value as T | Not | undefined;
}

export type Inputs<T> = {
  human?: Said<T>;
  /** A person's decision about every intent of this name. */
  deck?: Said<T>;
  model?: Said<Dist>;
  code: T | undefined;
  /** The kinds the program has here (learned ones included); absent: any value applies. */
  kinds?: readonly unknown[];
  open: boolean;
  ask: boolean;
  axis: (name: string) => number | undefined;
};
export type Outcome<T> = { value: T | Unresolved<T>; by: By; scope?: Scope; belief?: Dist; waiting?: unknown };

const sameKind = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function settle<T>(i: Inputs<T>): Outcome<T> {
  // A person's value of a kind the program does not have (now): kept, not applied.
  let waiting: unknown;
  const has = (v: unknown) => !i.kinds || isNot(v) || i.kinds.some((k) => sameKind(k, v));
  const keep = (v: T | Not | undefined) => {
    if (v === undefined || has(v)) return v;
    waiting ??= v;
    return undefined;
  };
  const w = (o: Outcome<T>): Outcome<T> => (waiting === undefined ? o : { ...o, waiting });
  const said = keep(at(i.human, i.axis));
  if (said !== undefined && !isNot(said)) return { value: said as T, by: 'human' };
  if (!i.open) return w({ value: i.code as T, by: 'code' });
  const wide = keep(at(i.deck, i.axis));
  const not = [...(isNot(said) ? said.$not : []), ...(isNot(wide) ? wide.$not : [])];
  const allowed = (k: unknown) => !(typeof k === 'string' && not.includes(k));
  if (wide !== undefined && !isNot(wide) && allowed(wide))
    return w({ value: wide as T, by: 'human', scope: 'deck' });
  const raw = at(i.model, i.axis) as Dist | undefined;
  let belief: Dist | undefined;
  if (raw && !isNot(raw)) {
    const kept = Object.entries(raw).filter(([k]) => allowed(k));
    const sum = kept.reduce((a, [, p]) => a + p, 0) || 1;
    belief = Object.fromEntries(kept.map(([k, p]) => [k, p / sum]));
    if (kept.length && margin(belief) >= TAU) return w({ value: argmax(belief) as T, by: 'model', belief });
  }
  const fallback = allowed(i.code) ? i.code : undefined;
  const value = {
    $unresolved: true,
    fallback,
    ...(belief && { belief }),
    ...(not.length && { not }),
    ask: i.ask,
  } as unknown as Unresolved<T>;
  return w({ value, by: 'unresolved', belief });
}
