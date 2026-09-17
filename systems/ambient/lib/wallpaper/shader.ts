// =============================================================================
// Wallpaper shader — a single full-screen fragment pass that composites, back
// to front:
//
//   sky gradient + sun glow / disc      (continuous with sun elevation)
//   stars (twinkling) + moon (sphere)   (night only, occluded by cloud)
//   the meteor                          (one aimed streak, on a click — a poke)
//   two parallax cloud decks (fbm)      (cover / density / storminess / wind)
//   fog / haze                          (low-frequency drifting veil, wipeable)
//   lightning                           (stochastic cloud-illuminating flashes)
//   the strike                          (one aimed bolt, on a click — a poke)
//   the meteor                          (one aimed streak, on a click — a poke)
//   the fog wipe                        (a swath of cleared mist — see lib/wipe.ts)
//   rain streaks                        (hash-cell particles, falling along the wind)
//   snow                                (depth-layered flakes, slow and fluttering)
//   …each along its own fall            (wind does not shear the weather; it
//                                        tilts the direction it falls in)
//   theme veil + exposure + dither      (blend toward the page background)
//
// Everything is procedural, so the whole wallpaper is a string of GLSL and the
// renderer only streams a handful of uniforms per frame.
//
// Every horizontal quantity here is screen-space and POSITIVE GOES RIGHT: the
// scene's wind, the cloud deck's accumulated travel, and the sideways half of
// the snow's. The travels are *subtracted* where they are used, because
// sampling a procedural field further right is what walks it left.
// =============================================================================

import {
  WIPE_DECAY,
  WIPE_MAX_POINTS,
  WIPE_RADIUS,
  WIPE_REACH,
  WIPE_TAIL,
} from "../wipe";

export const VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;
const vec2 POS[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() {
  gl_Position = vec4(POS[gl_VertexID], 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec2  uResolution;
uniform float uTime;
uniform float uFrameSec;     // smoothed frame interval; what "one frame" means
uniform float uSeed;
// Accumulated travel, in JS, from the smoothed wind. Positive travels right.
uniform float uCloudDrift;

uniform vec2  uSun;           // screen 0..1, y up
uniform float uSunElevation;  // degrees
uniform float uDaylight;      // 0..1
uniform vec3  uZenith;
uniform vec3  uHorizon;
uniform vec3  uGlow;
uniform float uGlowStrength;

uniform vec2  uMoon;
uniform float uMoonPhase;
uniform float uMoonVisible;
uniform float uMoonSize;
uniform float uHemisphere;    // +1 north (waxing lit on the right), -1 south

uniform float uCloudCover;
uniform float uCloudDensity;
uniform float uCloudDarkness;
uniform float uCloudSpeed;
uniform vec3  uCloudLit;
uniform vec3  uCloudShade;

uniform float uRain;
uniform float uSnow;
// Where the weather is falling, and how far it has fallen. The wind — the
// forecast's and whatever a hand stirs up — reaches the rain and the snow only
// through these four, and through nothing else. See Precipitation.
// Both downs are unit vectors, and the renderer guarantees it — including the
// degenerate frame or two when a 180-degree flip of gravity eases through
// zero, where it sends (0,-1) rather than nothing. So nothing below
// re-normalises them: that was a square root and a divide per pixel, twice
// over, to re-establish something the CPU already knew once a frame.
uniform vec2  uRainDown;      // unit; (0,-1) in a calm sky
uniform float uRainFall;      // seconds of travel; the clock in a calm sky
uniform vec2  uSnowDown;      // unit; the snow's, which is a much flatter angle
uniform vec2  uSnowFall;      // seconds of travel, as a vector; (0,-clock) calm
uniform float uFog;
uniform float uLightning;
uniform float uStars;
// What the murk is hiding — the same night sky without the fog and the deck a
// fog day puts in front of it. Only the wipe asks for these, and only inside
// the swath it has cleared; everywhere else the scene's own values stand.
uniform float uStarsBehind;
uniform float uMoonBehind;

// The poke: whatever the weather answers a click with (see lib/poke.ts). The
// answers are disjoint — one condition arms one of them — so they share one set
// of uniforms instead of each adding its own, and a new answer costs one float.
uniform vec2  uPoke;        // screen 0..1, y up — where the click landed
uniform float uPokeAge;     // seconds since it fired; < 0 when none is running
uniform float uPokeSeed;    // re-rolled per poke, so no two are alike
uniform float uPokeKind;    // 0 none, 1 strike, 3 meteor (2 is spare)

// The wipe is a path, and a fragment shader has no memory: JS keeps a bounded
// ring of the path's recent corners and the shader sweeps the swath along the
// polyline they describe. Corners rather than dots is what makes the trail long
// enough to write with — one entry buys a whole segment.
//
// xy is screen 0..1 y-up; z is how far through its life the corner is, 0..1 (JS
// owns the clock, so the duration lives in one place); w carries two things at
// once — its magnitude is what the hand had left when this corner was made (see
// the hand in lib/wipe.ts), and its sign says whether the corner continues the
// one before it or opens a stroke of its own, which is how two letters do not
// get joined by a line across the gap. A charge is never zero, so the sign is
// always readable. Only the first uWipeCount entries are live.
const int WIPE_MAX = ${WIPE_MAX_POINTS};
uniform vec4  uWipe[WIPE_MAX];
uniform int   uWipeCount;
uniform vec4  uWipeBox;   // the live corners' bounds, screen 0..1: minx, miny, maxx, maxy
// How far a cleared point travels over the whole of its life, screen units. The
// sky has no general notion of a horizontal wind any more — each falling thing
// carries its own aim (see "Where the weather falls") — so the wipe's drift is
// worked out in JS from the same smoothed wind and arrives already resolved.
uniform vec2  uWipeBlow;

uniform vec3  uVeilColor;
uniform float uVeilAmount;
uniform float uExposure;

// ---------------------------------------------------------------------------
// Hash / noise
// ---------------------------------------------------------------------------

float hash1(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 hash2(vec2 p) {
  float h = hash1(p);
  return vec2(h, hash1(p + h + 17.17));
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash1(i);
  float b = hash1(i + vec2(1.0, 0.0));
  float c = hash1(i + vec2(0.0, 1.0));
  float d = hash1(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);

float fbm5(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = ROT * p * 2.03 + 11.7;
    a *= 0.5;
  }
  return v;
}

float fbm3(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * vnoise(p);
    p = ROT * p * 2.03 + 11.7;
    a *= 0.5;
  }
  return v;
}

// ---------------------------------------------------------------------------
// Sky
// ---------------------------------------------------------------------------

// The sun and the moon are the same size in the sky — half a degree each,
// which is why an eclipse fits. One radius for both discs, then; what makes
// the sun read as the sun is the glow around it, not a bigger disc.
const float DISC_R = 0.03;

vec3 skyBase(vec2 uv, vec2 p, vec2 sunP, float aspect) {
  float t = pow(clamp(uv.y, 0.0, 1.0), 0.8);
  vec3 sky = mix(uHorizon, uZenith, t);

  // Sun glow: wide and warm near the horizon, tight and white overhead.
  float lowSun = 1.0 - smoothstep(-8.0, 14.0, uSunElevation);
  float d = length(p - sunP);
  float radius = mix(0.42, 1.15, lowSun);
  float g = exp(-(d * d) / (radius * radius));
  sky += uGlow * g * uGlowStrength * mix(0.55, 0.85, lowSun);

  // Horizon warmth band at dawn/dusk.
  float band = exp(-pow((uv.y - 0.16) / 0.28, 2.0)) * lowSun * uGlowStrength;
  sky += uGlow * band * 0.26;

  // Sun disc when the sun is up and the sky is open.
  float disc = smoothstep(DISC_R + 0.007, DISC_R - 0.007, d);
  float halo = exp(-(d * d) / 0.005);
  float sunVis = smoothstep(-1.5, 2.0, uSunElevation) * (1.0 - smoothstep(0.35, 0.8, uCloudCover));
  sky += (vec3(1.0, 0.97, 0.9) * disc * 0.8 + uGlow * halo * 0.28) * sunVis;

  return sky;
}

float stars(vec2 p, vec2 uv, float amount) {
  if (amount < 0.002) return 0.0;
  float s = 0.0;
  // Two densities: a sparse bright field and a fine dust.
  for (int i = 0; i < 2; i++) {
    float scale = i == 0 ? 42.0 : 110.0;
    vec2 sp = p * scale + uSeed * 3.1 + float(i) * 91.0;
    vec2 cell = floor(sp);
    vec2 f = fract(sp);
    vec2 rnd = hash2(cell);
    float present = step(i == 0 ? 0.86 : 0.93, hash1(cell + 5.3));
    float dist = length(f - (0.15 + rnd * 0.7));
    float size = i == 0 ? 0.075 : 0.05;
    float star = smoothstep(size, 0.0, dist) * present * (0.6 + 0.4 * rnd.x);
    float twinkle = 0.55 + 0.45 * sin(uTime * (1.2 + rnd.x * 2.0) + rnd.y * 6.2831);
    s += star * twinkle * (i == 0 ? 0.85 : 0.4);
  }
  // Fade stars toward the horizon haze.
  return s * amount * smoothstep(0.05, 0.45, uv.y);
}

// One crater per cell: a bowl with a raised rim, jittered inside its cell, so a
// whole field costs a single hash. Returns a height, negative in the floor and
// positive on the rim. The bowl stays inside its cell; the rim is a Gaussian,
// so a large crater's tail is clipped at the cell edge — invisible at this
// relief, but it is why the radius stays small.
float craters(vec2 q, float scale, float depth) {
  vec2 sp = q * scale;
  vec2 cell = floor(sp);
  vec2 rnd = hash2(cell + 19.3);
  // Sparse and unequal: a third of the cells, and the big ones rare, so the
  // field reads as a few landmarks rather than a golf ball.
  float present = step(0.66, hash1(cell + 4.1));
  float rad = 0.07 + 0.22 * rnd.y * rnd.y;
  float u = length(fract(sp) - 0.5 - (rnd - 0.5) * 0.4) / rad;
  float bowl = smoothstep(1.0, 0.3, u);
  float ring = (u - 0.9) * 3.6;
  float rim = exp(-ring * ring);
  return present * depth * (rim * 0.6 - bowl);
}

// Relief of the surface in unwrapped coordinates: rolling highlands plus two
// crater scales. Its gradient — not the values — is what lights the moon, so
// the amplitudes only matter relative to each other.
float moonRelief(vec2 q, vec2 detail) {
  float h = (fbm3(q * 2.2 + 9.0) - 0.5) * 0.8;
  h += craters(q, 3.1, 0.55) * detail.x;
  h += craters(q + 6.1, 6.7, 0.3) * detail.y;
  return h;
}

vec3 moon(vec2 p, vec2 moonP, float visible) {
  if (visible < 0.002) return vec3(0.0);
  float r = DISC_R * uMoonSize;
  vec2 d = (p - moonP) / r;
  d.x *= uHemisphere;
  float md = length(d);

  // One output pixel of edge, so the limb is the rim of a solid body rather
  // than a soft blot — at any disc size, from a 20 px crescent upward. Taken
  // before the early-out, because a derivative under a branch is undefined.
  float px = max(fwidth(md), 1e-4);
  // Beyond five radii the halo is under a tenth of an 8-bit step and the disc
  // is long gone, which spares the rest of the night sky everything below.
  if (md > 5.0) return vec3(0.0);
  float disc = smoothstep(1.0, 1.0 - max(px * 1.6, 0.012), md);

  // The phase, as one turn: cos gives the terminator (α runs 0 at full to π at
  // new, so cos α = -cos 2πphase) and sin puts the sun on the waxing side for
  // the first half of the cycle. Shading a sphere with that is the single
  // strongest cue that the moon is a ball — the terminator becomes a gradient
  // of grazing light instead of a cut edge.
  float turn = uMoonPhase * 6.2831853;
  float k = cos(turn);

  vec3 col = vec3(0.0);
  float lit = 0.0;
  // Only the disc pays for the surface; the halo below covers the rest.
  if (md < 1.0) {
    vec3 lightDir = vec3(sin(turn), 0.0, -k);
    float z = sqrt(max(0.0, 1.0 - md * md));
    vec3 n = vec3(d.x, d.y, z);

    // Unwrap the visible hemisphere by arc angle from the centre of the disc.
    // The texture then foreshortens toward the limb exactly as a sphere's
    // does — craters crowd and flatten at the edge — which is what flat noise
    // across a disc can never do.
    float theta = acos(clamp(z, -1.0, 1.0));
    vec2 q = (md > 1e-4 ? d / md : vec2(0.0)) * theta;

    // How much surface one pixel covers, which grows without bound toward the
    // limb. Detail fades out before it can alias, so a small or grazing moon
    // stays calm instead of boiling — and the last tenth of the radius is
    // flattened outright, where relief is foreshortened into ring-shaped
    // scratches that read as dirt on the lens.
    float foot = px / max(z, 0.06);
    float grazing = smoothstep(0.02, 0.42, z);

    // Maria: the broad dark plains that are all the eye really reads at this
    // size. They are flooded basalt, so they are also the smooth parts — the
    // crater relief is damped inside them.
    float sea = smoothstep(0.42, 0.66, fbm5(q * 1.15 + 4.5));

    // What survives of each crater scale: x the landmarks, y the fine pitting.
    vec2 detail = smoothstep(vec2(0.34, 0.085), vec2(0.12, 0.03), vec2(foot))
                * grazing * (1.0 - vec2(0.7, 0.8) * sea);

    float h = moonRelief(q, detail);
    float e = 0.012;
    vec2 grad = vec2(
      moonRelief(q + vec2(e, 0.0), detail) - h,
      moonRelief(q + vec2(0.0, e), detail) - h
    );
    // Tilt the sphere normal by that gradient, in a tangent frame aligned with
    // the image axes.
    vec3 tx = vec3(1.0, 0.0, 0.0) - n * n.x;
    vec3 ty = vec3(0.0, 1.0, 0.0) - n * n.y;
    tx /= max(length(tx), 1e-4);
    ty /= max(length(ty), 1e-4);
    vec3 nb = normalize(n - (tx * grad.x + ty * grad.y) * (0.014 / e));

    float mu0 = dot(nb, lightDir);
    float mu = max(z, 0.05);
    float lam = clamp(mu0, 0.0, 1.0);
    // Regolith backscatters, which is why the real full moon stays bright to
    // its edge: Lommel-Seeliger for that, a third of Lambert on top to give
    // back the roundness it flattens away, and a little limb darkening.
    float shade = 1.32 * (lam / (lam + mu)) + 0.34 * lam;
    shade *= 1.0 - 0.15 * smoothstep(0.5, 1.0, md);
    // The terminator follows the sphere, not the bumps: relief that catches
    // light past it would fill a crescent's night side with lit rims.
    lit = smoothstep(-0.02, 0.13, dot(n, lightDir)) * disc;
    shade *= lit;

    // Albedo: the seas, a soft mottle over the highlands, and rims a touch
    // brighter than the floors they ring.
    float albedo = mix(1.02, 0.71, sea);
    albedo *= 1.0 + 0.07 * h;
    albedo *= 1.0 + 0.09 * (fbm3(q * 4.5 + 2.0) - 0.5);

    vec3 surface = vec3(0.97, 0.96, 0.92) * albedo;
    // The night side is (almost) invisible against the sky: only a whisper of
    // earthshine, and never darker than its surroundings.
    col = surface * shade + vec3(0.18, 0.2, 0.26) * disc * (1.0 - lit) * 0.03;
  }

  // Atmospheric halo — scattered light *in front of* the moon, so it covers
  // the dark side too instead of outlining it as a black hole. Scaled by how
  // much of the disc is illuminated.
  float illum = 0.5 - 0.5 * k;
  float glow = exp(-md * md * 0.22) * 0.1 * (0.35 + 0.65 * illum);
  col += vec3(0.75, 0.82, 1.0) * glow * (1.0 - lit * 0.6);
  return col * visible;
}

// ---------------------------------------------------------------------------
// Clouds
// ---------------------------------------------------------------------------

struct CloudSample {
  float cov;
  float thick;
  vec3 col;
};

CloudSample cloudLayer(vec2 p, vec2 sunDir, float scale, float speed, float parallaxY, float coverBias) {
  // Subtracted, not added: uCloudDrift is a travel, positive to the right, and
  // sampling further right is what walks a deck left.
  vec2 drift = vec2(-uCloudDrift * speed, 0.0);
  vec2 q = vec2(p.x, p.y * parallaxY) * scale + drift + uSeed * 7.0;
  // Base billows plus a finer detail octave so partial cover thresholds into
  // ragged cumulus rather than round fbm peaks.
  float n = fbm5(q) * 0.82 + fbm3(q * 3.7 + 5.0) * 0.25;
  float cover = clamp(uCloudCover + coverBias, 0.0, 1.0);
  float th = mix(0.96, 0.2, cover);
  float cov = smoothstep(th, th + 0.38, n);
  float thick = cov * cov;

  // Fake lighting: compare with a sample nudged toward the sun.
  float nl = fbm5(q + sunDir * 0.09) * 0.82 + fbm3((q + sunDir * 0.09) * 3.7 + 5.0) * 0.25;
  float rim = clamp((n - nl) * 4.5, 0.0, 1.0);

  vec3 base = mix(uCloudLit, uCloudShade, thick * (0.35 + 0.65 * uCloudDarkness));
  base += uGlow * uGlowStrength * rim * 0.45 * (1.0 - thick * 0.6);
  // Silver lining toward the sun.
  base += uGlow * uGlowStrength * (1.0 - thick) * 0.12;

  CloudSample s;
  s.cov = cov * clamp(uCloudDensity + 0.1, 0.0, 1.0);
  s.thick = thick;
  s.col = base;
  return s;
}

// ---------------------------------------------------------------------------
// Precipitation
//
// WIND DOES NOT SHEAR THE WEATHER. IT TILTS THE WAY IT FALLS.
//
// A drop at terminal velocity is a balance: gravity pulling down, drag pushing
// back along its travel. Put a crosswind on it and it settles into a new
// balance almost at once and falls along the SUM of the two — the same speed
// through the air, aimed somewhere else. So a wind is not a distortion applied
// to falling weather. It is a change to which way down is, for the things that
// fall, and every visible consequence follows from that one vector.
//
// Which is also why this is the same model the gyroscope wants (#158): a tilt
// moves gravity, a wind adds a sideways term, and both arrive as the same
// four uniforms.
//
//   uRainDown   the direction the rain travels. A streak IS a drop's motion
//               blur, so it has to lie along the travel: the rain is sampled
//               in a frame aligned to this — the one rotation in the file.
//               Rotating rather than shearing is the whole difference. A shear
//               stretches a drop as it leans it, so past a breeze the streaks
//               stop reading as rain and start reading as brushwork, and the
//               harder the gust the worse the smear; a rotation leans a drop
//               without ever touching its shape.
//   uRainFall   how far the rain has fallen, in seconds of its own travel. A
//               tilted fall is a longer one — gravity plus wind is the
//               hypotenuse — so a gust quickens the rain as well as leaning
//               it. Accumulated rather than multiplied out of the clock,
//               because a speed that changed under a clock would teleport
//               every drop on the screen.
//   uSnowDown   the same direction for the snow, which is a far flatter angle
//               at the same wind: a flake falls at a thirtieth of a drop's
//               speed, so the same sideways push lays it over much further.
//               The flutter is measured across it, so a flake's wobble stands
//               up along the way it is actually going.
//   uSnowFall   how far the snow has travelled and along what, as a vector of
//               seconds. Keeping the travel rather than multiplying a clock by
//               a direction is what lets the direction come round slowly
//               without dragging the flakes that have already fallen along
//               with it: each one carries on the way it was going and curves
//               into the new one. It is the wind's whole sideways effect on
//               the snow, too — there is no separate drift any more, because a
//               flake blown sideways and a flake falling are the same flake.
//
// A consequence worth naming: the snow's lean is now the same at every depth
// for free. Both halves of a layer's travel are that layer's own fall speed
// times the same vector, so the angle cannot depend on the layer — where
// before it took two depth ramps, tuned to span the same 3x, to arrange it.
//
// In a calm sky both downs are (0,-1), uRainFall is the clock and uSnowFall is
// (0,-clock), and every line below is exactly the line it replaced.
// ---------------------------------------------------------------------------

/**
 * Takes a screen point into a frame whose y runs against 'down': for the rain,
 * whose streaks must lie along their fall.
 *
 * Turned about the middle of the viewport rather than a corner, so the curtain
 * pivots about what you are looking at instead of swinging in from an edge.
 */
vec2 fallSpace(vec2 p, vec2 down, float aspect) {
  // Rows (right, up) = (down turned a quarter turn, -down); GLSL wants columns.
  mat2 m = mat2(-down.y, -down.x, down.x, -down.y);
  vec2 c = vec2(aspect * 0.5, 0.5);
  return m * (p - c) + c;
}

// The point arrives already in the fall's own frame, so down is down in here and the
// fall is just the travel — which is what lets the rain stay the cheap, flat
// loop it always was. A drop lives a few tenths of a second and leaves nothing
// behind it, so it needs no memory of where it was going before.
float rain(vec2 base) {
  if (uRain < 0.002) return 0.0;
  float acc = 0.0;
  float fade = smoothstep(0.0, 0.12, uRain);

  // Four depth layers of thin, short, individually-timed streaks. Every
  // column carries its own phase so drops never line up into visible rows,
  // and each drop picks its own length and position inside a tall cell —
  // the eye reads scattered falling threads, not a striped curtain.
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float depth = 1.0 - fi * 0.2;
    float sc = 46.0 + fi * 24.0;                   // columns per unit height
    float rows = sc * 0.14;                        // tall cells
    float speed = (1.5 + fi * 0.35) * (0.85 + 0.3 * uRain);
    float colId = floor(base.x * sc + fi * 13.7);
    float phase = hash1(vec2(colId, fi * 3.1 + uSeed));
    vec2 q = vec2(base.x * sc + fi * 13.7, (base.y + uRainFall * speed + phase * 5.0) * rows);
    vec2 cell = floor(q);
    vec2 f = fract(q);
    vec2 rnd = hash2(cell + uSeed);
    float density = 0.12 + 0.5 * uRain;
    float present = step(rnd.x, density);
    float x = 0.2 + rnd.y * 0.6;
    float dx = abs(f.x - x);
    float len = 0.14 + 0.28 * hash1(cell + 7.7) * (0.5 + 0.5 * uRain);
    float y0 = 0.05 + hash1(cell + 3.3) * (0.9 - len);
    float head = smoothstep(y0, y0 + 0.05, f.y);
    float tail = smoothstep(y0 + len, y0 + len * 0.45, f.y);
    float streak = smoothstep(0.1, 0.0, dx) * head * tail;
    acc += streak * present * depth * (0.55 + 0.45 * hash1(cell + 9.1));
  }

  // Heavy rain also reads as a faint, fast vertical sheet.
  float sheet = fbm3(vec2(base.x * 18.0, base.y * 1.6 + uRainFall * 2.2) + uSeed) * smoothstep(0.55, 1.0, uRain) * 0.09;

  return (acc * (0.14 + 0.22 * uRain) + sheet) * fade;
}

// A flake is not a dot. What makes falling snow read as snow is that every
// flake is a thin crystal on its own slow helix: it swings sideways as it
// sinks, stalls at the ends of the swing, and tumbles — flashing bright when a
// face catches the light and nearly vanishing edge-on. So each one gets its own
// drift, its own tumble, and a soft body that trails off instead of a disc with
// an edge. The fall speeds are deliberately slow — a flake crosses the frame in
// ten to thirty seconds — because a wallpaper is looked past, not at.
float snow(vec2 p, float aspect) {
  if (uSnow < 0.002) return 0.0;
  float acc = 0.0;
  float fade = smoothstep(0.0, 0.12, uSnow);
  float px = 1.0 / uResolution.y;   // one device pixel in screen units

  // Which way this snow is going, and which way is sideways to it. Only the
  // flutter follows them — a flake is a plate wobbling as it settles, so its
  // wobble stands across whatever it is settling ALONG. Nothing positional may
  // follow them, because a flake's PLACE must not depend on where the fall is
  // aimed: turning the offsets below would slide the whole field across the
  // page as the snow came round, and a page that slides is exactly what a gust
  // must not look like. Calm, these are (0,-1) and (1,0).
  vec2 down = uSnowDown;
  vec2 across = vec2(-down.y, down.x);

  // The whole curtain leans and eases back on two slow beats — a gust that
  // takes twenty seconds to pass, not a shiver.
  float gust = sin(uTime * 0.31) * 0.6 + sin(uTime * 0.13 + 1.7) * 0.4;

  // Five depth layers, far → near. Far flakes are a dense dust of specks that
  // barely seem to move; near ones are a handful of big, soft, out-of-focus
  // blobs. Everything else — size, speed, brightness, how much the wind
  // carries them — is interpolated along the same depth, so a layer never
  // reads as a layer.
  for (int i = 0; i < 5; i++) {
    float z = float(i) * 0.25;                      // 0 far … 1 near
    float sc = mix(44.0, 12.0, z);                  // cells per screen height
    // A depth ramp, and only that: how much faster heavier snow falls is a
    // property of the snow, and it is carried in uSnowFall by the renderer
    // that accumulates it. Keeping it here meant a change of intensity
    // re-scaled every second of fall already banked.
    float fall = mix(0.030, 0.092, z);
    float radius = mix(0.0019, 0.0062, z);          // screen heights
    float soft = mix(0.45, 1.0, z * z);             // only the nearest defocus
    float density = mix(0.30, 0.09, z) * (0.35 + 0.65 * uSnow);

    // Where this layer has got to: its own speed along the travel the renderer
    // accumulates. Both halves of it — down the page and across it — are the
    // same vector times the same speed, which is why the lean comes out the
    // same at every depth without anyone tuning it to.
    vec2 q = (p - uSnowFall * fall) * sc;
    float row = floor(q.y);

    // The long waft. Taken from the row index rather than the continuous
    // coordinate, it is constant across a flake — so the flake travels sideways
    // instead of being sheared — while every row keeps its own tempo and phase.
    // Applied before the cell is picked, so the excursion can be far wider than
    // a cell without clipping anything.
    float rh = hash1(vec2(row, float(i) * 3.7 + uSeed));
    float waft = sin(uTime * (0.4 + fract(rh * 7.3) * 0.5) + rh * 6.2831);
    // The curtain's own wobble, which is not wind and does not belong to the
    // fall: it stays across the page, and its signs carry no meaning.
    q.x += (gust * mix(0.008, 0.02, z)
          + waft * mix(0.022, 0.075, z)) * sc;

    vec2 cell = floor(q);
    vec2 f = fract(q);
    // Six properties per flake out of one hash pair: multiplying a hash by a
    // large irrational and taking the fraction sweeps it through scores of
    // cycles, so the derived value no longer tracks the one it came from.
    vec2 h = hash2(cell + uSeed * 1.3 + float(i) * 31.7);
    // Most cells are empty — between 70% and 91% of them, depending on the
    // layer — and a flake never reaches past its own cell, so leaving early
    // costs nothing and skips the whole model below. A cell is 25 to 90 px
    // across, far wider than a warp, so the branch is coherent.
    if (h.x >= density) continue;
    float cx = fract(h.x * 137.13);
    float cy = fract(h.y * 191.71);
    float tempo = h.y;
    float phase = fract(h.x * 59.71 + h.y * 23.33);
    float grade = fract(h.y * 53.17);               // its size in its layer

    // Every flake rides its own slow ellipse: it swings sideways and stalls at
    // the ends of the swing. That coupling — not the falling — is what the eye
    // reads as fluttering. The swing is across the fall and the stall along
    // it, so the ellipse stands up the way the flake is actually travelling.
    float th = uTime * (0.5 + tempo * 0.85) + phase * 6.2831;
    float sw = sin(th);
    vec2 c = vec2(0.34 + cx * 0.32, 0.3 + cy * 0.4);
    c += across * (sw * (0.07 + 0.06 * tempo));
    c -= down * (cos(th) * 0.09);

    // Tumble. A snow crystal is a thin plate: edge-on it is a sliver and goes
    // dim, then flares as it turns a face back into the light. It turns twice
    // per swing — cos(2th), taken off the sine already in hand — and depth
    // mutes it, because a defocused flake has no edge left to turn.
    float face = mix(abs(1.0 - 2.0 * sw * sw), 1.0, z * 0.5);
    float squash = mix(0.45, 1.0, face);
    float twinkle = mix(0.74, 1.0, face);

    // The flake's own axes, taken straight from the hash — a fixed random tilt
    // for the price of a normalize instead of a sin/cos pair.
    vec2 axis = normalize(vec2(cx, cy) * 2.0 - 1.0 + vec2(0.0013, 0.0007));
    vec2 d = (f - c) / sc;                          // screen units
    vec2 e = vec2(dot(d, axis), dot(d, vec2(-axis.y, axis.x)));
    e.x /= squash;

    // Body plus a fuzzy halo: snow seen against the sky has no rim, it has a
    // soft middle that trails off. The pixel floor keeps the farthest flakes
    // from aliasing into little squares.
    float rad = max(radius * (0.7 + 0.6 * grade), 1.15 * px);
    float invRad = 1.0 / rad;
    float r = length(e) * invRad;
    float edge = max(soft, px * invRad);
    float body = smoothstep(1.0, 1.0 - edge, r);
    float bell = max(0.0, 1.0 - r * r * 0.5);       // a Gaussian's shape, cheap
    float halo = bell * bell * bell;                // and with no tail to clip
    // The body's weight is flat with depth — a near flake is bigger and softer,
    // not brighter. What grows toward the front is the halo, which is what
    // being out of focus looks like.
    acc += (body * 0.36 + halo * mix(0.061, 0.33, z)) * twinkle;
  }

  return acc * (0.55 + 0.45 * uSnow) * fade;
}

// ---------------------------------------------------------------------------
// Lightning
// ---------------------------------------------------------------------------

float lightning(vec2 p, float aspect, out vec2 flashPos) {
  flashPos = vec2(0.0);
  if (uLightning < 0.002) return 0.0;
  float period = 2.6;
  float lt = uTime / period;
  float slot = floor(lt);
  float r = hash1(vec2(slot, uSeed + 3.0));
  float on = step(0.62, r);
  float ft = fract(lt) * period;
  // Sharp strike, then a softer second flicker.
  float env = exp(-ft * 14.0) + 0.55 * exp(-pow(ft - 0.16, 2.0) * 420.0) * step(0.1, ft)
            + 0.25 * exp(-pow(ft - 0.32, 2.0) * 600.0) * step(0.25, ft);
  flashPos = vec2(hash1(vec2(slot, 1.7)) * aspect, 0.72 + 0.22 * hash1(vec2(slot, 2.9)));
  float local = exp(-length(p - flashPos) * 1.9);
  return on * env * uLightning * (0.35 + 1.4 * local);
}

// ---------------------------------------------------------------------------
// The pokes — what a click is answered with (see lib/poke.ts)
//
// One condition arms one answer, so at most one of these ever runs and they
// share the uPoke* uniforms between them. The kind is a uniform, so every
// early-out below is a branch the whole draw takes together — free.
// ---------------------------------------------------------------------------

const float POKE_STRIKE = 1.0;
const float POKE_METEOR = 3.0;

/** Is this kind of poke the one currently in flight? */
bool poking(float kind) {
  return uPokeAge >= 0.0 && abs(uPokeKind - kind) < 0.5;
}

// ---------------------------------------------------------------------------
// The strike — one aimed bolt, on a thunder day
//
// Where lightning() fires on its own schedule, this one is an answer to a
// click: it comes down out of the cloud base onto the point that was asked
// for. It is drawn top-down over ~70 ms, forks twice, flickers and is gone
// inside a second.
// ---------------------------------------------------------------------------

/**
 * Glow of one jagged segment a -> b, with only the first 'grown' of it drawn.
 * The zig-zag is pinched to nothing at both ends, so a bolt leaves the cloud
 * where it should and lands exactly where it was aimed.
 */
float boltSeg(vec2 p, vec2 a, vec2 b, float seed, float width, float grown) {
  vec2 ab = b - a;
  float len = max(length(ab), 1e-4);
  vec2 dir = ab / len;
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 rel = p - a;
  float along = dot(rel, dir);
  float t = clamp(along / len, 0.0, 1.0);

  float taper = sin(t * 3.14159265);
  float wob = (vnoise(vec2(t * 7.0, seed)) - 0.5) * 0.30
            + (vnoise(vec2(t * 26.0, seed + 5.0)) - 0.5) * 0.09;
  float d = abs(dot(rel, nrm) - wob * taper * len);
  // Past either end the segment simply stops.
  d = max(d, max(-along, along - len));

  // Tapered toward the ground, but never below a pixel and a bit: on a short
  // viewport a channel measured in scene units thins out of existence.
  float w = max(width * (1.0 - 0.3 * t), 1.3 / uResolution.y);
  float core = exp(-d / w);
  float halo = exp(-d / (w * 18.0)) * 0.13;
  // The leading edge: everything past 'grown' has not been drawn yet.
  return (core + halo) * smoothstep(grown, grown - 0.1, t);
}

/** Returns the flash on the sky; the channel itself comes back in 'bolt'. */
float strike(vec2 p, float aspect, out float bolt) {
  bolt = 0.0;
  if (!poking(POKE_STRIKE)) return 0.0;
  float age = uPokeAge;

  vec2 hit = vec2(uPoke.x * aspect, uPoke.y);
  // The cloud it leaves is near, but never directly above, the point hit.
  vec2 top = vec2(hit.x + (hash1(vec2(uPokeSeed, 3.7)) - 0.5) * 0.42, 1.06);
  float reach = age / 0.07;
  float trunk = boltSeg(p, top, hit, uPokeSeed, 0.0026, reach);

  // Two forks off the trunk, each a beat later and thinner than the one before.
  vec2 f1 = mix(top, hit, 0.40);
  vec2 f2 = mix(top, hit, 0.68);
  trunk += 0.55 * boltSeg(p, f1,
    f1 + vec2((hash1(vec2(uPokeSeed, 9.1)) - 0.5) * 0.46, -0.28),
    uPokeSeed + 2.0, 0.0017, (age - 0.02) / 0.07);
  trunk += 0.40 * boltSeg(p, f2,
    f2 + vec2((hash1(vec2(uPokeSeed, 4.3)) - 0.5) * 0.38, -0.20),
    uPokeSeed + 6.0, 0.0013, (age - 0.03) / 0.07);

  // The channel holds while the flash has already gone: a strike you can see
  // the shape of, not just a white frame. Two return strokes flicker on it.
  bolt = trunk * (exp(-age * 7.0)
    + 0.80 * exp(-pow(age - 0.13, 2.0) * 700.0)
    + 0.50 * exp(-pow(age - 0.27, 2.0) * 900.0));

  // The flash is the opposite: a spike, brightest around the channel, spent in
  // a tenth of a second — the same shape as the weather's own (see lightning()).
  float env = exp(-age * 12.0)
    + 0.55 * exp(-pow(age - 0.13, 2.0) * 900.0)
    + 0.28 * exp(-pow(age - 0.27, 2.0) * 1100.0);
  return env * (0.35 + 0.7 * exp(-length(p - hit) * 2.6));
}

// ---------------------------------------------------------------------------
// The fog wipe — the foggy-day easter egg (see lib/wipe.ts)
// ---------------------------------------------------------------------------

/**
 * How much of the mist is gone at p: 0 untouched, 1 clear air.
 *
 * The swath is swept along the polyline — the distance to each segment, not to
 * a point — so a drag comes out as one stroke of even width however fast the
 * hand was going, and there are no dots to blend into each other.
 *
 * Nothing about it is a circle, because a circle in fog reads as a lens. The
 * whole field is looked up through a domain warp made of the same drifting
 * noise the fog itself is made of, and the width is pushed around by a second,
 * finer one: the edge tears and feathers along its length, and it keeps moving
 * with the mist rather than sitting on top of it. A long, soft falloff does the
 * rest — a wiped window has no outline.
 *
 * Healing is a fade and a shrink together, run per corner and interpolated
 * along each segment, so the tail of a long stroke silts up while the head is
 * still being drawn. Shrinking alone would pull the swath apart into beads.
 */
float fogWipe(vec2 p, float aspect) {
  // Nothing to arbitrate: a fog scene carries no lightning and no precipitation,
  // so the count is the whole gate (see lib/wipe.ts).
  if (uWipeCount < 2) return 0.0;

  // Everywhere the stroke is not — which, for a scribble, is most of the
  // screen — costs one box test instead of the whole loop. Whole tiles fall on
  // the same side of it, so it is the one early-out a GPU actually likes. The
  // margin covers the widest the swath can be, plus the furthest the warp below
  // can push it, plus the furthest the wind can carry it over a whole life.
  const float REACH = ${WIPE_REACH.toFixed(3)};
  if (p.x < uWipeBox.x * aspect - REACH || p.x > uWipeBox.z * aspect + REACH ||
      p.y < uWipeBox.y - REACH || p.y > uWipeBox.w + REACH) return 0.0;

  vec2 drift = vec2(uTime * 0.014, uTime * -0.011);
  // Two scales of warp rather than one: a slow, broad one that leans the whole
  // stroke around, and a faster one that works on its edges. A single octave
  // holds its shape — you can see the same noise sitting in the same place —
  // and holding a shape is what a drawing does.
  vec2 warp = vec2(
    fbm3(p * 1.7 + drift * 0.45 + uSeed),
    fbm3(p * 1.7 - drift * 0.45 + uSeed + 7.1)
  ) - 0.5
  + 0.55 * (vec2(
    fbm3(p * 4.6 + drift * 1.5 + uSeed + 19.3),
    fbm3(p * 4.6 - drift * 1.5 + uSeed + 31.7)
  ) - 0.5);

  // And the whole thing is carried off. A patch of cleared air is not a mark on
  // the screen, it is a hole in something that is moving: it goes downwind and
  // settles as it ages, so the old end of a stroke has travelled further than
  // the new end and the stroke shears rather than sitting still. This is the
  // single strongest reason the mark reads as weather and not as a board.
  vec2 blow = uWipeBlow;

  // Two scales of fray on the width — big lobes that make one side of the
  // stroke fatter than the other for a while, and a fine tear on top of them —
  // and a third that leaves streaks of mist standing inside the swath. Nothing
  // here is ever the same twice along the path, which is the whole difference
  // between a wiped window and a hole cut in a mask.
  float lobes = fbm3(p * 9.0 + drift * 0.6 + uSeed * 0.7);
  float tear = vnoise(p * 27.0 - drift + uSeed * 1.9);
  float ragged = 0.42 + 1.05 * lobes + 0.26 * (tear - 0.5);
  // What the same fray does to the width once the mist has been working on it
  // for a while. Loop-invariant, so it is worked out once rather than per
  // segment.
  float raggedHeal = ragged * ragged * 1.35;

  float clear = 0.0;
  for (int i = 0; i + 1 < WIPE_MAX; i++) {
    if (i + 1 >= uWipeCount) break;
    vec4 b = uWipe[i + 1];
    // b opens a stroke of its own: there is no segment between it and a.
    if (b.w < 0.0) continue;
    vec4 a = uWipe[i];
    vec2 pa = p - vec2(a.x * aspect, a.y);
    vec2 ba = vec2((b.x - a.x) * aspect, b.y - a.y);
    float bb = max(dot(ba, ba), 1e-6);
    float t = clamp(dot(pa, ba) / bb, 0.0, 1.0);
    float life = clamp(mix(a.z, b.z, t), 0.0, 1.0);
    // No hold: it is closing from the first instant, and the visible life is
    // mostly tail. See WIPE_DECAY.
    float age = exp(-${WIPE_DECAY.toFixed(2)} * life)
      * (1.0 - smoothstep(${WIPE_TAIL.toFixed(3)}, 1.0, life));
    // And what the hand had when this stretch was made. A tired hand covers the
    // same ground — it just stops bringing anything up, so this is strength and
    // not width: the far end of a long stroke is as wide as the near end and a
    // great deal less clear.
    float left = age * mix(abs(a.w), abs(b.w), t);
    if (left < 1e-3) continue;
    // The older this stretch is, the further it has blown and the more the mist
    // has worked on it: the warp grows with age rather than being a fixed
    // texture the stroke wears.
    vec2 qa = pa - blow * life + warp * (0.055 + 0.16 * life);
    float d = length(qa - ba * clamp(dot(qa, ba) / bb, 0.0, 1.0));
    float r = ${WIPE_RADIUS.toFixed(4)} * mix(ragged, raggedHeal, life)
      * (0.45 + 0.55 * age);
    float e = d / max(r, 1e-4);
    // A Gaussian, and one field for the whole effect.
    //
    // Anything with a shoulder — a disc with a soft edge, a core term unioned
    // with a wider halo term, mist made to bead along the boundary — draws an
    // outline, and an outlined stroke is the single most pen-like thing there
    // is. This has no shoulder at any width and no boundary anywhere to put an
    // outline on: it is a density, falling off forever, which is what mist
    // around a wiped patch actually is.
    clear = max(clear, left * exp(-e * e * 1.1));
  }
  if (clear <= 0.0) return 0.0;
  // Wiped, not deleted: what is left of the mist in the swath still drifts.
  // Lightly, though — enough to see the streaks against the sky behind, not so
  // much that the sky behind stops arriving.
  float streak = vnoise(vec2(p.x * 5.0, p.y * 19.0) + drift + uSeed * 2.7);
  return clear * (0.86 + 0.14 * streak);
}

// ---------------------------------------------------------------------------
// The meteor — one aimed streak, on a clear night
//
// The clear night's answer to a click, and deliberately the strike's opposite:
// same grammar (a tap, a point, a second, no state), inverted tone. A thunder
// day answers with violence; a clear night answers with a wish.
//
// It does not launch from your finger — it *passes through* the point you
// clicked. A meteor was always already falling; clicking only says where you
// happened to catch sight of one. So it comes in from off the edge of the
// screen, sweeps through the point, and burns out somewhere past it.
//
// Everything about the path is re-rolled per click: which side it comes from
// and how steeply it falls, which means where on the edge it appears. Nothing
// is fixed for the session — a real shower does share one radiant, and this
// used to model that, but an egg you will click a dozen times wants to be
// unpredictable more than it wants to be right. Two meteors through the same
// point now arrive from two different places.
//
// It is drawn under the cloud decks, unlike the strike's channel: a bolt read
// through cloud is no bolt, but a meteor behind a cloud is simply hidden, which
// is the truth.
// ---------------------------------------------------------------------------

/**
 * The pace and the bounds, in screen heights and seconds. Pace is what is held
 * fixed rather than duration: a long path across the frame should take longer
 * than a short one, the way a real meteor's does — but never longer than
 * METEOR_MAX_FLIGHT, which is what keeps the whole thing inside its budget on a
 * very wide screen (there the head simply moves faster).
 *
 * METEOR_LIFE is POKE_MS.meteor: the renderer retires the poke then, so the
 * trail has to be gone by then or it vanishes mid-fade.
 */
const float METEOR_SPEED = 1.6;
const float METEOR_MIN_FLIGHT = 0.45;
const float METEOR_MAX_FLIGHT = 1.25;
const float METEOR_LIFE = 1.7;
/**
 * How far outside the frame it starts, so it is plainly arriving from away.
 * Wide enough to absorb the bow: the lead-in is measured along the tangent, and
 * the arc it is actually walked along departs from that by up to the sagitta.
 */
const float METEOR_EDGE = 0.1;
/**
 * How fast the wake and the train forget, in seconds — and these are really
 * *lengths*, which is the thing to hold on to: at METEOR_SPEED, a tau of 0.1 s
 * is 0.28 of the screen's height. An earlier cut ran the train at 0.3 s and so
 * drew a streak 833 px long on a 945 px-tall laptop — 88% of the height, still
 * carrying 34/255 halfway down it. That is a light beam, not a meteor. What the
 * eye actually sees of a meteor is a bright dash and a ghost behind it; the
 * long full path only shows up in a photograph, which integrates the whole
 * flight. So the wake is a short bright dash, and the train is faint enough
 * that its greater length never adds up to a band.
 *
 * The wake is the air just behind the head, still hot; the train is what is
 * left of it a moment later. One clock is 3x the other, which is why they read
 * as two things.
 *
 * The wake's clock also has a floor that has nothing to do with meteors and
 * everything to do with displays. The dash is tau x speed long and the head
 * moves speed/fps between frames, so what decides whether consecutive frames
 * overlap is tau x fps — the speed cancels, and slowing a strobing meteor down
 * does not stop it strobing. An earlier cut moved the head 44 px a frame behind
 * a 25 px dash: a row of separate dashes, which is why it looked broken and
 * even slightly bent in motion while every still frame of it looked right. So
 * the wake is never shorter than about two frames of travel, taken from the
 * renderer's own measured frame time rather than from a guess about the
 * hardware; on a machine that drops to 20 fps the dash lengthens to match.
 *
 * The train's decay is deliberately steeper than an exponential, and that is
 * the difference between a train and a line that dims. Under a plain
 * exp(-t/tau) every point ages at the same rate once the head has stopped
 * emitting, so the whole profile scales by the same factor every frame and the
 * thing reads as one rigid stick on a dimmer — measurably so: first and last
 * point both lost exactly half between 0.45 s and 0.60 s. Raised to a power the
 * old end loses disproportionately, so the train retreats toward where the
 * meteor died, which is what a real one does (recombination is not a one-body
 * process and does not decay like one).
 */
const float METEOR_WAKE_TAU = 0.055;
const float METEOR_TRAIN_TAU = 0.17;
const float METEOR_TRAIN_FALL = 1.8;
/** How much of the head's light the train carries — a ghost, not a second tail. */
const float METEOR_TRAIN_GAIN = 0.18;

/**
 * The bow, as the sagitta of the path over its own length. A meteor's track is
 * dead straight in space, and on a narrow field it projects straight too — but
 * this is a wide field, and a wide field bends a great circle, so a little bow
 * is honest as well as prettier. Kept small, and bounded away from zero on
 * purpose: the path is carried as a circular arc, and a radius that grows
 * without bound is a radius float32 cannot subtract accurately.
 */
const float METEOR_BOW_MIN = 0.025;
const float METEOR_BOW_MAX = 0.06;

/**
 * The light curve. A meteor is not a lamp that switches on: it brightens as it
 * digs into thicker air, peaks, and is spent — and it is spent faster than it
 * climbed, because what is burning is running out. So: one peak, asymmetric,
 * and near zero past the end, which means nothing anywhere has to be switched
 * off by hand. It is also what decides the head's size, and what each bit of
 * the train remembers of the head that made it.
 *
 * The climb is the wide side, so it is already burning at a third to a half of
 * its peak when it enters the frame — which is the truth of it: nothing ignites
 * exactly at the edge of a screen. It also means a click near an edge, where
 * the head reaches the point a few frames in, is still answered by something
 * bright.
 */
float meteorGlow(float t, float peak) {
  float z = (t - peak) / (t < peak ? 0.55 : 0.22);
  return exp(-z * z);
}

/**
 * Where the path is, s of arc length from the click. The whole track is one
 * circular arc about c of radius r, which is what makes a bowed path no
 * harder than a straight one: the distance from a pixel to an arc and its
 * position along it are an angle, where for a parabola they would be a cubic.
 * Returning the point rather than a radius also sidesteps the precision trap —
 * length(p - c) - r subtracts two large nearly-equal numbers, this does not.
 */
vec2 meteorAt(vec2 c, float r, float a0, float spin, float s) {
  float a = a0 + spin * s / r;
  return c + r * vec2(cos(a), sin(a));
}

/**
 * Fragmentation. A bright meteor comes apart on the way down, and each break
 * flares: the classic thing a fireball does that a faint streak never does. Two
 * possible bursts, the second only on some of them, and only the top grades
 * get either. Multiplied into the light curve, so the train remembers the flare
 * as a knot where it happened.
 */
float meteorBurst(float t, float fire, float seed) {
  if (fire < 0.002) return 1.0;
  float at1 = 0.34 + 0.22 * hash1(vec2(seed, 12.3));
  float at2 = 0.62 + 0.22 * hash1(vec2(seed, 57.1));
  float again = step(0.45, hash1(vec2(seed, 71.9)));
  float z1 = (t - at1) / 0.05;
  float z2 = (t - at2) / 0.04;
  return 1.0 + fire * (2.0 * exp(-z1 * z1) + again * 1.3 * exp(-z2 * z2));
}

/** Returns the head; the wake behind it and the train it leaves come back out. */
float meteor(vec2 p, float aspect, out float wake, out float train) {
  wake = 0.0;
  train = 0.0;
  if (!poking(POKE_METEOR)) return 0.0;
  float age = uPokeAge;

  // Which way it falls: a side, and a steepness between 20 and 70 degrees off
  // the horizon. Both re-rolled per click, which is the whole of the variety —
  // the angle is what decides where on the frame's edge the thing appears, so
  // randomising it randomises the entry point for free. Never horizontal,
  // never vertical.
  vec2 at = vec2(uPoke.x * aspect, uPoke.y);

  // What kind of meteor this one is — the roll that makes clicking again worth
  // doing. A real sky is mostly faint quick ones with the occasional fireball,
  // and the skew is the payload: pow() puts the median grade at 0.29 and leaves
  // one in eight above 0.8, so most clicks give something modest and now and
  // then you get the one that comes apart. Everything below reads mag: how
  // bright, how big the coma, how far it runs, how long the train lasts, and
  // whether it flares at all.
  float mag = pow(hash1(vec2(uPokeSeed, 44.1)), 1.8);
  float fire = smoothstep(0.62, 0.92, mag);

  float side = hash1(vec2(uPokeSeed, 8.3)) < 0.5 ? -1.0 : 1.0;
  float pitch = mix(0.35, 1.22, hash1(vec2(uPokeSeed, 3.1)));
  float cx = cos(pitch);
  float cy = sin(pitch);
  // Unless the side it drew has no sky in it: a point near the right edge has
  // one long path through it and it runs left. The roll stands wherever there
  // is room, which is nearly everywhere.
  if (((side > 0.0 ? aspect - at.x : at.x) + METEOR_EDGE) < 0.4 * cx) side = -side;
  vec2 dir = vec2(side * cx, -cy);

  // Back the path up from the point until it leaves the frame: that is the
  // entry, a little outside whichever edge the angle happens to meet. Forward,
  // it keeps going a while past the point and burns out — unless an edge
  // arrives first, in which case it just leaves, which is also what they do.
  float lead = min(((side > 0.0 ? at.x : aspect - at.x) + METEOR_EDGE) / cx,
                   (1.0 + METEOR_EDGE - at.y) / cy);
  float burn = mix(0.55, 1.05, hash1(vec2(uPokeSeed, 5.9))) * mix(0.62, 1.2, mag);
  float leave = min(((side > 0.0 ? aspect - at.x : at.x) + METEOR_EDGE) / cx,
                    (at.y + METEOR_EDGE) / cy);
  // How far it carries on past the point: its own burn-out distance where there
  // is room, but never under 60% of the lead-in. That ratio is really a
  // statement about *time* — it puts the crossing of the point at 0.62 of the
  // flight at the latest, and therefore inside the light curve rather than
  // after it. Without it, a click near the bottom of the frame gets a long
  // lead-in and is met by a head that has already gone out.
  float run = lead + max(min(burn, leave), lead * 0.6);

  // The bow. dir is the tangent *at the clicked point*, and the track is the
  // circular arc through it — so the click is still crossed exactly, and the
  // lead-in and run-out above, which were measured along the tangent, are now
  // approximations good to the sagitta. Which way it bends is another roll.
  float bow = mix(METEOR_BOW_MIN, METEOR_BOW_MAX, hash1(vec2(uPokeSeed, 21.7)));
  float spin = hash1(vec2(uPokeSeed, 6.4)) < 0.5 ? -1.0 : 1.0;
  float radius = run / (8.0 * bow);
  vec2 centre = at + vec2(-dir.y, dir.x) * spin * radius;
  float aAt = atan(at.y - centre.y, at.x - centre.x);
  // Arc length runs against the side the centre is on.
  spin = -spin;

  // One pace for every meteor, so a long path takes longer than a short one —
  // but never quicker than METEOR_MIN_FLIGHT, because the shortest chords
  // (a click in the very corner of the frame) would otherwise be over in
  // seventy milliseconds, which is a blink and not a streak. A big one also
  // falls a touch more slowly, which is most of why fireballs read as stately.
  float pace = METEOR_SPEED * mix(1.12, 0.86, mag);
  float flight = clamp(run / pace, METEOR_MIN_FLIGHT, METEOR_MAX_FLIGHT);
  // And that pace is *constant*. A meteor does not slow down — it stops giving
  // off light, which is a different thing and looks like one: an eased path
  // reads either as a thrown object losing steam or, worse, as an animation
  // curve, and the eye knows that signature. Nor is the position clamped at the
  // end, so it never parks: the curve below has already taken it to nothing.
  float t = age / flight;
  vec2 head = meteorAt(centre, radius, aAt, spin, run * t - lead);

  // How bright it is, over its life. Where the peak falls is re-rolled per
  // click, so one meteor blazes early and the next is still climbing as it
  // crosses your point.
  float peak = mix(0.45, 0.72, hash1(vec2(uPokeSeed, 17.3)));
  // Ablation is not smooth, so the brightness wanders. From noise rather than a
  // sine, which at a fixed rate reads as a mechanism rather than as burning.
  float flicker = 0.88 + 0.24 * vnoise(vec2(age * 13.0, uPokeSeed * 7.0));
  // How much light it gives at all is the grade's largest effect.
  float bright = mix(0.6, 1.55, mag);
  float glow = meteorGlow(t, peak) * meteorBurst(t, fire, uPokeSeed) * flicker;

  // The head: a coma, and a brighter one is a bigger one, with a soft halo of
  // scattered light around it. The gain is set so only the peak of the curve
  // clips — for the rest of the flight the head has structure instead of being
  // a white sticker.
  //
  // It is kept *small*, and that is the whole of what separates a meteor from a
  // comet: what a meteor is long in is its streak, not its head. An earlier cut
  // measured a 20 px bright ball inside an 84 px glow on a 13" laptop — nine
  // percent of the screen's height — because the halo carried 0.42 of the core
  // over a 3.3x exponential, and an exponential that wide takes a very long
  // time to reach nothing. Halved the coma, and the halo is now weaker and
  // three times tighter. The pixel floor is for a small viewport, where a head
  // measured in screen heights would otherwise thin out of existence.
  float dh = length(p - head);
  float hr = max(0.0026 * mix(0.75, 1.45, mag) * (0.65 + 0.35 * glow),
                 1.1 / uResolution.y);
  float core = exp(-(dh * dh) / (hr * hr)) + exp(-dh / (hr * 1.8)) * 0.30;

  // The wake and the train are the same air at two ages — what the head lit on
  // its way past — so they come out of one walk down the path it has flown.
  // Emission stops when the head is spent, so that path stops at the end of the
  // flight however long the poke lives afterwards.
  float lastLit = min(t, 1.0);
  float span = lastLit * flight;              // how many seconds of it are lit
  float sLit = run * lastLit;                 // and how much arc length
  // Where this pixel sits along the arc, as arc length from the click: the
  // angle it subtends at the centre. Wrapped into (-pi, pi] because both
  // atan()s come back on their own branch.
  float ap = atan(p.y - centre.y, p.x - centre.x);
  float dA = mod((ap - aAt) * spin + 3.14159265, 6.28318531) - 3.14159265;
  // Clamped to the lit stretch, so past either end the distance is to that end
  // rather than to the circle the arc came from.
  float s = clamp(dA * radius, -lead, sLit - lead);
  float d = length(p - meteorAt(centre, radius, aAt, spin, s));
  float q = (s + lead) / max(sLit, 1e-4);
  // Constant speed is what makes this cheap: where a bit of the streak sits
  // says *when* it was made, and therefore both how old it is now and how
  // bright the head was that made it. Which is the whole difference between a
  // train and a drawn line — the old end goes first, so the thing retreats
  // toward where the meteor died instead of dimming all over at once, it
  // spreads as it goes because the air is diffusing, and it keeps a bright
  // middle because that is where the head was brightest.
  float old = max(age - q * span, 0.0);
  float made = q * lastLit;                   // the head's own t back then
  float lit = meteorGlow(made, peak) * meteorBurst(made, fire, uPokeSeed);
  float px = 0.9 / uResolution.y;
  // Capped, or the adaptation runs away: at a few frames a second the dash
  // would grow past a screen height and be the light beam again. Under about
  // 15 fps it goes back to strobing, and at that frame rate so does the page.
  float wakeTau = max(METEOR_WAKE_TAU, min(uFrameSec * 1.8, 0.12));
  wake = exp(-d / max(0.0021, px)) * exp(-old / wakeTau) * lit;
  // Spreading dims as well as widens: the same light over a wider thread, so
  // the surface brightness goes down with the width it went up with.
  float spread = 1.0 + old * 8.0;
  // A big one leaves a train that lasts; a faint one barely leaves one at all.
  float trainTau = METEOR_TRAIN_TAU * mix(0.7, 1.35, mag);
  train = exp(-d / max(0.0013 * spread, px)) / spread
        * exp(-pow(old / trainTau, METEOR_TRAIN_FALL))
        * lit * METEOR_TRAIN_GAIN * mix(0.45, 1.7, mag);

  // Faint on a washed-out night, for the same reason the stars are — and the
  // horizon haze thins it as it does them, though never to nothing: a meteor
  // you asked for and did not get reads as broken, not as rare. The close is
  // the renderer's deadline, not the physics: whatever is left when the poke is
  // retired has to be nothing.
  float visible = uStars * (0.55 + 0.45 * smoothstep(0.02, 0.4, p.y))
                * (1.0 - smoothstep(METEOR_LIFE * 0.85, METEOR_LIFE, age))
                * bright;
  wake *= visible;
  train *= visible;
  return core * glow * visible;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 sunP = vec2(uSun.x * aspect, uSun.y);
  vec2 moonP = vec2(uMoon.x * aspect, uMoon.y);
  vec2 sunDir = normalize(sunP - vec2(aspect * 0.5, 0.35) + vec2(0.0001));

  // The wipe is worked out first, because what it uncovers is composited here,
  // at the very back of the frame — long before the fog it is clearing.
  float cleared = fogWipe(p, aspect);

  // Inside the swath, the night sky the murk was hiding. A foggy night has no
  // stars and barely a moon by the time the scene reaches this shader (the deck
  // saturates the star term, the fog takes what is left), so clearing the fog
  // alone uncovers nothing, and the whole promise of the gesture — there really
  // is a sky up there — comes to nothing with it. These two are that sky.
  float starAmt = mix(uStars, max(uStars, uStarsBehind), cleared);
  float moonAmt = mix(uMoonVisible, max(uMoonVisible, uMoonBehind), cleared);

  vec3 col = skyBase(uv, p, sunP, aspect);
  col += vec3(0.9, 0.93, 1.0) * stars(p, uv, starAmt);
  col += moon(p, moonP, moonAmt);

  // The meteor, over the field it belongs to and under the decks that should
  // hide it: a warm-white head (it is a rock burning) over a cooler trail (it
  // is ionised air glowing). Both go in before the clouds, so a drifting deck
  // occludes a lingering trail exactly as it should.
  float mWake, mTrain;
  float mHead = meteor(p, aspect, mWake, mTrain);
  col += vec3(1.0, 0.96, 0.88) * (mHead + mWake)
       + vec3(0.72, 0.86, 1.0) * mTrain;

  // Far deck: large, slow, flattened by perspective. Near deck: smaller,
  // faster, a touch heavier.
  CloudSample far = cloudLayer(p, sunDir, 1.35, 0.014, 0.75, -0.05);
  CloudSample near = cloudLayer(p + vec2(3.1, 1.7), sunDir, 2.6, 0.03, 1.0, 0.0);

  // Clouds sit over the sky; the near deck also shades the far one a little.
  // What the sky looks like underneath them is kept, for the fog wipe below.
  vec3 belowDecks = col;
  col = mix(col, far.col, far.cov);
  col = mix(col, near.col * (1.0 - 0.08 * near.thick), near.cov);
  float cloudMask = max(far.cov, near.cov);

  // Lightning illuminates the cloud decks from within.
  vec2 flashPos;
  float fl = lightning(p, aspect, flashPos);
  col += vec3(0.86, 0.9, 1.0) * fl * (0.25 + 0.75 * cloudMask);

  // The clicked strike: the same light on the decks, plus the channel itself,
  // which is drawn over them — a bolt read through cloud is no bolt at all.
  float bolt;
  float sf = strike(p, aspect, bolt);
  col += vec3(0.86, 0.9, 1.0) * sf * (0.25 + 0.75 * cloudMask) * 0.65;
  col += vec3(0.95, 0.97, 1.0) * bolt * 1.25;

  // Fog / haze: drifting low-frequency veil, denser toward the bottom.
  //
  // The wipe thins it rather than cutting a hole in the frame: 'fa' is the only
  // thing it touches, so what shows through a cleared patch is whatever the sky
  // is already rendering behind the mist — the gradient, the cloud decks, a sun
  // glow. That is the payoff. A foggy day hides a real sky, and wiping reveals
  // it rather than revealing a flat colour.
  if (uFog > 0.002) {
    vec3 fogCol = mix(uHorizon, uCloudLit, 0.35);
    float fn = 0.7 + 0.3 * fbm3(p * 1.8 + vec2(uTime * 0.02, 0.0) + uSeed);
    float fa = uFog * (0.45 + 0.55 * (1.0 - uv.y)) * fn;
    fa *= 1.0 - cleared;
    col = mix(col, fogCol, clamp(fa, 0.0, 0.95));
    // And the deck goes with it, because on a fog day the deck IS the murk: the
    // profile carries three quarters cover with a white lit colour precisely
    // because fog reads as overcast. Leave it standing and clearing the mist
    // uncovers nothing — the mist and the cloud above it are the same white by
    // day, and by night the deck is what buries the stars. It can only ever
    // happen where there is fog to wipe, and it follows the same field the fog
    // does, so what opens up is a thinning in weather rather than a hole in a
    // mask. A gate, not a dial: on a fog day the deck goes, and on anything
    // else there is no wipe to be running in the first place.
    col = mix(col, belowDecks, cleared * smoothstep(0.2, 0.7, uFog));
    // Clear air scatters less than mist, so the swath sits a shade darker than
    // what is around it. On a white noon — where the mist, the deck above it
    // and the sky behind them are all within a few levels of each other — this
    // is most of what there is to see, and it is the reason the egg reads at
    // all on the brightest day it can happen on.
    col *= 1.0 - 0.05 * cleared * uFog;
  }

  // Precipitation over everything.
  // Nothing in the sky has turned: a wind is a second pull on the things that
  // fall, not a camera on the world. Only the rain's own frame is rotated, and
  // only because a streak has to lie along its travel. See Precipitation.
  //
  // Behind the same uniform branch the snow uses below, and for the same
  // reason — but note what is behind it here: rain() would return on its own
  // compare, yet its ARGUMENT is a frame change, and an argument is evaluated
  // whether or not the body wants it. A dry sky paid for a rotation.
  if (uRain >= 0.002) {
    float r = rain(fallSpace(p, uRainDown, aspect));
    vec3 dropCol = mix(uCloudLit, vec3(1.0), 0.45);
    col += dropCol * r * 0.75;
  }

  // Snow, and the colour to paint it. A flake is a scattering mote, not a lamp:
  // it can never be brighter than the sky behind it, so against a blown-out
  // overcast it reads as a grey speck — which is what snow looks like in a
  // photograph of a white sky — and against anything darker it reads white. At
  // night it keeps the cloud's own colour so it glows rather than glares.
  //
  // The background it measures is the frame so far, which is the sky, the cloud
  // and the fog in front of them — everything that is actually behind a flake.
  // Nothing additive can contaminate it here: a scene carries rain or snow but
  // never both, and lightning only ever fires over the one that carries rain.
  //
  // The branch is on a uniform, so it costs nothing and saves the whole block
  // on every frame of every sky that is not snowing.
  if (uSnow >= 0.002) {
    float s = snow(p, aspect);
    float bg = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float overcast = smoothstep(0.74, 0.96, bg) * uDaylight;
    vec3 snowCol = mix(uCloudLit, vec3(0.97, 0.98, 1.0), 0.55 + 0.25 * (1.0 - uDaylight));
    snowCol *= 1.0 - 0.22 * overcast;
    col = mix(col, snowCol, clamp(s, 0.0, 1.0) * 0.9);
  }

  // Theme veil + exposure.
  col *= uExposure;
  col = mix(col, uVeilColor, uVeilAmount);

  // Ordered-ish dither kills gradient banding on the 8-bit target.
  col += (hash1(gl_FragCoord.xy + fract(uTime)) - 0.5) * (1.5 / 255.0);

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
