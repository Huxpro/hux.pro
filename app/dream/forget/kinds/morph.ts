// Magic move, for a canvas: when the layout changes (an intent flips the
// window on its side, a screen is resized), what is drawn does not jump to
// its new place; it moves there, from where it was, over MORPH seconds.

export const MORPH = 0.6;

/** Ease in and out (cubic): leaves gently, arrives gently. */
export const ease = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);

export const lerp = (a: number, b: number, e: number) => a + (b - a) * e;

/** Each numeric field of `to`, from `from`'s, `e` of the way. */
export function blend<T extends Record<string, number>>(from: T, to: T, e: number): T {
  const out = { ...to };
  for (const k of Object.keys(to) as (keyof T)[]) if (typeof from[k] === "number") out[k] = lerp(from[k], to[k], e) as T[keyof T];
  return out;
}
