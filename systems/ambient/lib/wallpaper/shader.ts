// =============================================================================
// Wallpaper shader — a single full-screen fragment pass that composites, back
// to front:
//
//   sky gradient + sun glow / disc      (continuous with sun elevation)
//   stars (twinkling) + moon (sphere)   (night only, occluded by cloud)
//   two parallax cloud decks (fbm)      (cover / density / storminess / wind)
//   fog / haze                          (low-frequency drifting veil)
//   lightning                           (stochastic cloud-illuminating flashes)
//   the strike                          (one aimed bolt, on a click — see lib/strike.ts)
//   rain streaks                        (hash-cell particles, wind-sheared)
//   snow                                (depth-layered flakes, slow and fluttering)
//   theme veil + exposure + dither      (blend toward the page background)
//
// Everything is procedural, so the whole wallpaper is a string of GLSL and the
// renderer only streams a handful of uniforms per frame.
//
// Every horizontal quantity here is screen-space and POSITIVE GOES RIGHT: the
// scene's wind, the gust a hand stirs up, and the accumulated cloud and snow
// travels. The two travels are *subtracted* where they are used, because
// sampling a procedural field further right is what walks it left.
// =============================================================================

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
uniform float uSeed;
// Accumulated travel, in JS, from the smoothed wind. Positive travels right.
uniform float uCloudDrift;
uniform float uSnowDrift;

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
uniform vec2  uWind;          // screen-space; x > 0 blows RIGHT (see scene.ts)
// The wind a hand stirred up on its way across the page (see stir.ts). Same
// units and sign as uWind.x, and simply added to it. The snow and the clouds
// take theirs through the drifts above, which the renderer already integrates.
uniform float uStirWind;
uniform float uFog;
uniform float uLightning;
uniform float uStars;

uniform vec2  uStrike;      // screen 0..1, y up — where the clicked bolt lands
uniform float uStrikeAge;   // seconds since it fired; < 0 when none is running
uniform float uStrikeSeed;  // re-rolled per strike, so no two bolts are alike

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

float stars(vec2 p, vec2 uv) {
  if (uStars < 0.002) return 0.0;
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
  return s * uStars * smoothstep(0.05, 0.45, uv.y);
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

vec3 moon(vec2 p, vec2 moonP) {
  if (uMoonVisible < 0.002) return vec3(0.0);
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
  return col * uMoonVisible;
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
// ---------------------------------------------------------------------------

float rain(vec2 p, vec2 uv, float aspect) {
  if (uRain < 0.002) return 0.0;
  float acc = 0.0;
  // The lean is the whole of the rain's answer to wind: a positive slant shears
  // the curtain so every drop travels down-AND-right, which is both what the
  // eye reads and where the drop actually goes. A hand's gust is the same kind
  // of thing as the forecast's wind, so they simply add — and rain, being light
  // and quick, is at the new angle at once. The snow is not; see snowWind in
  // renderer.ts.
  float slant = (uWind.x + uStirWind) * 0.75;
  float fade = smoothstep(0.0, 0.12, uRain);
  // Sheared about mid-screen rather than the bottom edge. At rest the two are
  // the same picture — the field is uniform, so where it is registered cannot
  // be seen — but when a gust slams the lean over, the pivot is what decides
  // how far the worst-off row is thrown. Halving the arm halves the whip.
  vec2 base = vec2(p.x + (uv.y - 0.5) * slant, p.y);

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
    vec2 q = vec2(base.x * sc + fi * 13.7, (base.y + uTime * speed + phase * 5.0) * rows);
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
  float sheet = fbm3(vec2(base.x * 18.0, base.y * 1.6 + uTime * 2.2) + uSeed) * smoothstep(0.55, 1.0, uRain) * 0.09;

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
    float fall = mix(0.030, 0.092, z) * (0.85 + 0.3 * uSnow);
    float radius = mix(0.0019, 0.0062, z);          // screen heights
    float soft = mix(0.45, 1.0, z * z);             // only the nearest defocus
    float density = mix(0.30, 0.09, z) * (0.35 + 0.65 * uSnow);

    vec2 q = p * sc;
    q.y += uTime * fall * sc;
    float row = floor(q.y);

    // The long waft. Taken from the row index rather than the continuous
    // coordinate, it is constant across a flake — so the flake travels sideways
    // instead of being sheared — while every row keeps its own tempo and phase.
    // Applied before the cell is picked, so the excursion can be far wider than
    // a cell without clipping anything.
    float rh = hash1(vec2(row, float(i) * 3.7 + uSeed));
    float waft = sin(uTime * (0.4 + fract(rh * 7.3) * 0.5) + rh * 6.2831);
    // The quantity that matters here is the lean: sideways over fall. Both
    // ramps span the same 3×, so it comes out the same at every depth — one
    // wind, one angle, which is not true if the two are tuned apart. At a
    // 10 km/h crosswind it works out around 33° off vertical.
    // Drift subtracts: uSnowDrift is a travel, positive to the right, and a
    // bigger q.x samples further right. The gust and waft under it are the
    // curtain's own wobble, and their signs carry no meaning.
    q.x -= uSnowDrift * mix(0.133, 0.4, z) * sc;
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
    // reads as fluttering.
    float th = uTime * (0.5 + tempo * 0.85) + phase * 6.2831;
    float sw = sin(th);
    vec2 c = vec2(0.34 + cx * 0.32, 0.3 + cy * 0.4);
    c.x += sw * (0.07 + 0.06 * tempo);
    c.y += cos(th) * 0.09;

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
// The strike — one aimed bolt (see lib/strike.ts)
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
  if (uStrikeAge < 0.0) return 0.0;
  float age = uStrikeAge;

  vec2 hit = vec2(uStrike.x * aspect, uStrike.y);
  // The cloud it leaves is near, but never directly above, the point hit.
  vec2 top = vec2(hit.x + (hash1(vec2(uStrikeSeed, 3.7)) - 0.5) * 0.42, 1.06);
  float reach = age / 0.07;
  float trunk = boltSeg(p, top, hit, uStrikeSeed, 0.0026, reach);

  // Two forks off the trunk, each a beat later and thinner than the one before.
  vec2 f1 = mix(top, hit, 0.40);
  vec2 f2 = mix(top, hit, 0.68);
  trunk += 0.55 * boltSeg(p, f1,
    f1 + vec2((hash1(vec2(uStrikeSeed, 9.1)) - 0.5) * 0.46, -0.28),
    uStrikeSeed + 2.0, 0.0017, (age - 0.02) / 0.07);
  trunk += 0.40 * boltSeg(p, f2,
    f2 + vec2((hash1(vec2(uStrikeSeed, 4.3)) - 0.5) * 0.38, -0.20),
    uStrikeSeed + 6.0, 0.0013, (age - 0.03) / 0.07);

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
// Main
// ---------------------------------------------------------------------------

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 sunP = vec2(uSun.x * aspect, uSun.y);
  vec2 moonP = vec2(uMoon.x * aspect, uMoon.y);
  vec2 sunDir = normalize(sunP - vec2(aspect * 0.5, 0.35) + vec2(0.0001));

  vec3 col = skyBase(uv, p, sunP, aspect);
  col += vec3(0.9, 0.93, 1.0) * stars(p, uv);
  col += moon(p, moonP);

  // Far deck: large, slow, flattened by perspective. Near deck: smaller,
  // faster, a touch heavier.
  CloudSample far = cloudLayer(p, sunDir, 1.35, 0.014, 0.75, -0.05);
  CloudSample near = cloudLayer(p + vec2(3.1, 1.7), sunDir, 2.6, 0.03, 1.0, 0.0);

  // Clouds sit over the sky; the near deck also shades the far one a little.
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
  if (uFog > 0.002) {
    vec3 fogCol = mix(uHorizon, uCloudLit, 0.35);
    float fn = 0.7 + 0.3 * fbm3(p * 1.8 + vec2(uTime * 0.02, 0.0) + uSeed);
    float fa = uFog * (0.45 + 0.55 * (1.0 - uv.y)) * fn;
    col = mix(col, fogCol, clamp(fa, 0.0, 0.95));
  }

  // Precipitation over everything.
  float r = rain(p, uv, aspect);
  vec3 dropCol = mix(uCloudLit, vec3(1.0), 0.45);
  col += dropCol * r * 0.75;

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
