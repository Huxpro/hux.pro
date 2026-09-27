// =============================================================================
// The glow's palette — one light for the whole site.
//
// Siri's ring, as five stops laid around a loop: blue · violet · pink · amber
// · cyan, and back to blue. Every glow on the site — the About's screen-edge
// ring, the command bar listening, a badge under the pointer — is drawn from
// these, by the same shader (lib/shader.ts), so a glow reads as one kind of
// light wherever it appears. The CSS fallback (no WebGL) and anything else
// drawn in CSS take the same stops from `GLOW_CSS_STOPS`.
//
// Change a colour here and it changes everywhere; do not write a glow colour
// anywhere else. Over a wallpaper the light takes colours in harmony with it
// instead (lib/harmony.ts); these are the palette it falls back to, and the
// one the `siri` rule keeps.
// =============================================================================

/** The stops, linear 0–1 RGB, in order around the ring. */
export const GLOW_STOPS: ReadonlyArray<readonly [number, number, number]> = [
  [0.3, 0.52, 1.0], // blue
  [0.7, 0.36, 1.0], // violet
  [1.0, 0.34, 0.66], // pink
  [1.0, 0.63, 0.3], // amber
  [0.26, 0.86, 1.0], // cyan
];

const hex = ([r, g, b]: readonly [number, number, number]) =>
  "#" +
  [r, g, b]
    .map((c) => Math.round(c * 255).toString(16).padStart(2, "0"))
    .join("");

/** The stops as CSS colours, closed into a loop — for a conic gradient. */
export const GLOW_CSS_STOPS = [...GLOW_STOPS, GLOW_STOPS[0]].map(hex).join(", ");

/**
 * GLSL for `vec3 ring(float t)`: the palette as a smooth cyclic ramp, over
 * the five stops in `uPal` — Siri's (these) or the wallpaper's, per frame
 * (lib/harmony.ts).
 */
export function glslRing(): string {
  const n = GLOW_STOPS.length;
  const lines = GLOW_STOPS.map((_, i) => {
    const test = i < n - 1 ? `if (x < ${(i + 1).toFixed(1)}) ` : "";
    return `  ${test}return mix(uPal[${i}], uPal[${(i + 1) % n}], f);`;
  });
  return `uniform vec3 uPal[${n}];

vec3 ring(float t) {
  float x = fract(t) * ${n.toFixed(1)};
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
${lines.join("\n")}
}`;
}
