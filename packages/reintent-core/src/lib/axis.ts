/**
 * Choices along an ordered axis of a context (a screen's width/height): a person picks a kind on
 * one screen, and it spreads along the axis until it meets another choice. Away from the base end
 * the chosen kind takes this point and everything below it in its segment; the base kind takes
 * this point and everything above it in its segment. What it builds is a core Piecewise value;
 * the core only reads it.
 */
import { isNot, isPiecewise, type Piecewise, type Said, type Segment } from '../core/index';

const EPS = 1e-9;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function choose<T>(
  prev: Said<T> | undefined,
  axis: string,
  x: number,
  kind: T,
  base: T,
): Piecewise<T> {
  let segs: Segment<T>[] =
    isPiecewise(prev) && prev.$axis === axis
      ? prev.segments.map((s) => ({ ...s }))
      : [{ lo: null, hi: null, value: prev === undefined || isNot(prev) ? undefined : (prev as T) }];
  const i = segs.findIndex((s) => (s.lo ?? -Infinity) <= x && x < (s.hi ?? Infinity));
  const s = segs[i];
  const cut = same(kind, base) ? x : x + EPS;
  const lower = { lo: s.lo ?? null, hi: cut, value: same(kind, base) ? s.value : kind };
  const upper = { lo: cut, hi: s.hi ?? null, value: same(kind, base) ? kind : s.value };
  segs.splice(i, 1, lower, upper);
  segs = segs.filter((s) => (s.lo ?? -Infinity) < (s.hi ?? Infinity));
  const merged: Segment<T>[] = [];
  for (const s of segs) {
    const last = merged[merged.length - 1];
    if (last && same(last.value, s.value)) last.hi = s.hi;
    else merged.push(s);
  }
  return { $axis: axis, segments: merged };
}
