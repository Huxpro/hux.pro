// =============================================================================
// The wind field — a small, real patch of moving air behind the wallpaper.
//
// Until now a gust was a number with a place bolted on: one strength, one
// point, a falloff. Air does not work like that. Air is a velocity at every
// point, it carries itself along, it curls, and a disturbance left in it drifts
// downwind and comes apart rather than fading where it was made.
//
// So there is a field. A grid of a few thousand cells holds a velocity, and one
// pass per frame:
//
//   1. ADVECTS it by itself — every cell asks where the air now arriving at it
//      came from a moment ago, and takes that. This is what makes a gust travel
//      instead of sitting still, and what lets one gust wrap around another.
//   2. RELAXES toward the forecast's own wind, so a sky nobody has touched is
//      exactly the sky the forecast asked for, and a stirred one returns to it.
//   3. TAKES the hand's stroke, by dragging the air it passes through TOWARD
//      the hand's own velocity — never past it, because a hand cannot drive air
//      faster than it is itself moving. Pouring in momentum instead is the
//      obvious way to write it and it has no ceiling: the push balances only
//      against the settling, which lands an equilibrium far outside the byte,
//      so any stroke held for a second clips the whole blob flat. A stroke
//      still accumulates, in area — a long one brings more air up to speed.
//
// There is no vorticity confinement, and there was. Advection alone carries a
// stirred eddy perfectly well at this grid size — the two were indistinguishable
// side by side, frame for frame — while confinement feeds on whatever curl it
// is given, and the dither below is all curl. It cost twelve taps a cell to
// farm its own noise into a wind the sky never came back from.
//
// The same pass keeps two LAGGED copies of the field beside the air itself, at
// a raindrop's time constant and a snowflake's. That is what a particle really
// answers to — it is dragged toward the air rather than handed its velocity —
// and doing it per cell rather than per layer means a flake at the edge of a
// gust lags on its own account, not on the sky's average. Depth then reads off
// a mix between the two, which is a legitimate in-between of two first-order
// responses to the same input.
//
// Why RGBA8 and not a float texture: every WebGL2 context can render to RGBA8
// and filter it linearly, while the float formats need extensions that phones
// do not all have, and the linear filtering advection depends on needs another.
// A byte across ±VELOCITY_MAX is about 0.02 of a screen height per second,
// which is finer than the sky can show.
//
// A byte is not fine enough for the SETTLING, though, and that is worth
// knowing. Relaxing toward the forecast moves a cell by (v − ambient)·dt/τ per
// frame, which at a sixtieth of a second is a hundredth of a byte — it rounds
// back to where it was, every frame, and the field freezes part-way home. Two
// lines fix it: the write is dithered, so a change smaller than a step still
// lands on the far side of the rounding some of the time, and anything within
// a step of the forecast is snapped onto it so the sky has a true rest.
// =============================================================================

/** Cells down the screen. Width follows the aspect so the cells stay square. */
export const FIELD_ROWS = 96;

/** Velocity that maps to the ends of a byte. Anything faster is clipped. */
export const VELOCITY_MAX = 1.6;

/**
 * The fastest a hand is taken to be moving, in screen heights per second.
 * Approached through `tanh`, so a frantic hand saturates gently rather than
 * clipping — and kept under VELOCITY_MAX so the air it drags always fits.
 */
export const HAND_MAX = 1.3;

/**
 * A gust's momentum is spent over this radius, in screen heights. Wide enough
 * that a stroke reads as air being pushed rather than as a cursor with a brush.
 */
export const HAND_RADIUS = 0.38;

export const FIELD_VERTEX = /* glsl */ `#version 300 es
precision highp float;
const vec2 POS[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() {
  gl_Position = vec4(POS[gl_VertexID], 0.0, 1.0);
}
`;

export const FIELD_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;

// Two targets, written together: the air and the raindrop's lagged copy of it
// in one, the snowflake's in the other.
layout(location = 0) out vec4 outAir;   // rg = air, ba = what a raindrop has
layout(location = 1) out vec4 outSnow;  // rg = what a flake has, ba unused

uniform sampler2D uAir;
uniform sampler2D uSnow;

uniform vec2  uTexel;       // 1 / field size, in uv
uniform float uAspect;      // field uv x → screen heights
uniform float uDt;          // seconds since the last step, clamped
uniform float uVMax;        // VELOCITY_MAX, the byte's range

/** The forecast's own wind, which the field is always falling back toward. */
uniform vec2  uAmbient;
/** How long that takes: a stirred sky settles, it does not snap. */
uniform float uSettle;
/** How fast a drop and a flake are dragged toward the air. */
uniform float uRainTau;
uniform float uSnowTau;

/** The hand: where (field uv), how fast, and 0 radius when it is away. */
uniform vec2  uHandAt;
uniform vec2  uHandVel;
uniform float uHandRadius;
/** How quickly the air at the very centre is brought up to the hand's speed. */
uniform float uHandGrip;

uniform float uDither;      // ±half a byte
uniform float uRoll;        // a fresh number each frame, or the dither is a
                            // fixed pattern per cell and rounds the same way
                            // every time — which is the freeze it is there to
                            // prevent, wearing a disguise
uniform float uStep;        // one byte, expressed as a velocity

vec2 decode(vec4 c) { return (c.rg - 0.5) * (2.0 * uVMax); }
vec2 decodeBA(vec4 c) { return (c.ba - 0.5) * (2.0 * uVMax); }

float hash1(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

/** To the byte, with a dither so sub-step changes are not rounded away. */
vec2 encode(vec2 v, vec2 seed) {
  vec2 n = vec2(hash1(seed), hash1(seed + 7.31)) - 0.5;
  return clamp(v / (2.0 * uVMax) + 0.5 + n * uDither, 0.0, 1.0);
}

/** Within a byte of the forecast is the forecast: otherwise there is no rest. */
vec2 settled(vec2 v) {
  vec2 d = v - uAmbient;
  return dot(d, d) < uStep * uStep ? uAmbient : v;
}

void main() {
  vec2 uv = gl_FragCoord.xy * uTexel;
  vec4 hereAir = texture(uAir, uv);
  vec2 air = decode(hereAir);

  // 1 — advect. Trace back along the velocity to where this air was, and take
  // what was there. In field uv: one screen height is 1 in y and uAspect in x.
  vec2 back = uv - uDt * vec2(air.x / uAspect, air.y);
  vec2 moved = decode(texture(uAir, clamp(back, vec2(0.0), vec2(1.0))));

  // 2 — settle back toward the forecast. Everything the visitor did is a
  // departure from this, and every departure is on its way home.
  moved = mix(moved, uAmbient, 1.0 - exp(-uDt / uSettle));

  // 3 — and take the hand's stroke: drag the air toward the hand's velocity,
  // fastest at the middle of the blob and not at all outside it. Measured in
  // screen heights, so the blob is round on any aspect.
  if (uHandRadius > 0.0) {
    vec2 d = (uv - uHandAt) * vec2(uAspect, 1.0) / uHandRadius;
    float grip = 1.0 - exp(-uDt * uHandGrip * exp(-dot(d, d)));
    moved = mix(moved, uHandVel, grip);
  }

  // The lagged copies. A particle is dragged toward the air, so this is the
  // same first-order lag the layers used to do in JS — except per cell, so the
  // flake at the edge of a gust lags on its own account.
  moved = settled(moved);
  vec2 rain = settled(mix(decodeBA(hereAir), moved, 1.0 - exp(-uDt / uRainTau)));
  vec2 snow = settled(mix(decode(texture(uSnow, uv)), moved, 1.0 - exp(-uDt / uSnowTau)));

  outAir = vec4(encode(moved, uv + uRoll), encode(rain, uv + 3.7 + uRoll));
  outSnow = vec4(encode(snow, uv + 9.1 + uRoll), 0.0, 1.0);
}
`;
