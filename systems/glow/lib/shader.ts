import { glslRing } from "./palette";

// =============================================================================
// The glow shader — one field of light on the edge of a rounded box.
//
// Every glow on the site is this shader over some box: the whole screen (the
// About), a search field (voice), a badge. For each pixel it knows how far it
// sits from the box's rounded edge (`sdRoundBox`) and where around the edge it
// is (`s`, 0–1 around the aspect-normalised ring), and builds the light from
// those two numbers:
//
//   beams     four travelling waves around the ring, two each way, at
//             harmonics 2 · 3 · 5 · 7 so their crests never line up the same
//             way twice. A wave sets how far its light reaches from the edge.
//             A voice drives them: `uLevel` lengthens every reach, and the
//             low / mid / high bands (`uBands`) each drive their own waves, so
//             speech ripples rather than pumps.
//   colour    the palette (lib/palette.ts) laid around the ring, drifting.
//   core      a thin bright line on the edge itself.
//   ground    what the light is laid on (lib/ground.ts): a lightness per
//             edge, `uGround`, sets how it composites — added up on a dark
//             ground, tinting a light one, by degrees — and a busy picture
//             (`uBusy`) firms the core line and the light a little.
//   halo      outside the box (`uBleed` px of canvas around it), a softer
//             light spilling out — the bloom a small element needs, since a
//             glow drawn only inside a 20px badge is no glow at all.
//   focus     the ring can be narrowed to an arc: `uFocus` is the arc's
//             half-width (0 = the whole ring) and `uFocusAt` its centre (0.25
//             is the bottom). The "line" shape — the glow along the bottom of
//             a field — is the ring focused on its bottom edge; "processing"
//             is that arc gathered small and swept side to side.
//   reveal    the ring arrives from the focus centre and spreads both ways,
//             its front flaring, with a surge in reach as it lands.
//   motion    how the light lives while on: flow is this field; rotate and
//             pulse are built in layers instead (`layered`, below) — a crisp
//             stroke, an inner glow, a bloom and, for a rotation, a spark —
//             as Libraries.dev's border-beam builds them.
// =============================================================================

/**
 * How far past its `reach` the light visibly goes: the depth, in reaches, at
 * which the brightest crest at rest — a beam at its full height, 1.7 reaches
 * thick (`0.3 + 1.4`), energy 1 — falls to 2% opacity, below what an eye
 * picks out on a blurred ground:
 *
 *   1 − exp(−1.15 · g) = 0.02  →  g = 0.01757
 *   exp(−(d / 1.7)^1.45) = g   →  d = 1.7 · 4.041^(1/1.45) = 4.45
 *
 * It is what makes an extent (where the light ends, px) and a reach (the
 * beams' scale) the same number in two units: a glow told to end at E has
 * reach E / 4.45 and looks exactly like one given that reach — its own tail
 * ends there — and the window that makes the end exact only trims the last
 * few percent. Change the beams' thickness or falloff and this must follow.
 */
export const GLOW_EXTENT_PER_REACH = 4.45;

export const GLOW_VERTEX = /* glsl */ `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const GLOW_FRAGMENT = /* glsl */ `
precision highp float;

uniform vec2 uRes;       // viewport, canvas px
uniform float uScale;    // canvas px per CSS px
uniform float uTime;     // seconds
uniform float uReveal;   // 0 → 1, the sweep out from the focus centre
uniform float uSurge;    // 1 → 0, extra reach as the ring lands
uniform float uRadius;   // the box's corner radius, CSS px
uniform float uWidth;    // base reach of a beam, CSS px
uniform float uBleed;    // canvas margin around the box, CSS px
uniform vec4 uGround;    // lightness under each edge, 0–1: right, bottom, left, top
uniform float uBusy;     // how much of a busy picture reaches the light, 0–1
uniform float uStrength; // 0–1, the whole effect
uniform float uLevel;    // 0–1, energy: a voice, or the resting 0.45
uniform vec3 uBands;     // 0–1 per band (low, mid, high); 1,1,1 at rest
uniform float uFocus;    // arc half-width in ring units; 0 = whole ring
uniform float uFocusAt;  // arc centre in ring units; 0.25 = bottom
uniform float uLine;     // 1: focus measured along the bottom edge (a line)
uniform float uFlip;     // -1 mirrors the box top to bottom: a line on the top edge
uniform vec2 uExtent;    // px where the light must end: x off the left / right
                         // edges, y off the top / bottom; 0 = no limit
uniform float uMode;     // 0 flow · 1 rotate · 2 pulse
uniform float uHead;     // a rotation's head, ring units
uniform float uHue;      // ring units the colour field is turned by
uniform vec4 uBreath;    // a pulse's breath per quarter, 0.62–1.08: right, bottom, left, top
uniform float uInside;   // 0: only the halo past the edge

#define TAU 6.28318530718

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// Smooth minimum of four distances (log-sum-exp, stable), softness k.
// A hard min of the edge distances makes the light's contours corner along
// each diagonal — a crease from every corner, once the light reaches deeper
// than the corner's radius. The smooth min keeps them round at every depth,
// and where two edges meet their light adds up instead of folding.
float smin4(vec4 d, float k) {
  float m = min(min(d.x, d.y), min(d.z, d.w));
  vec4 e = exp(-(d - m) / k);
  return m - k * log(e.x + e.y + e.z + e.w);
}

${glslRing()}

// -----------------------------------------------------------------------------
// Rotate and pulse — a light built in layers, as border-beam builds it.
//
// Flow is a field: travelling beams whose one falloff does everything. A
// rotation and a pulse are not fields but compositions, each layer with one
// job, and that is what makes them read at any size:
//
//   colour   fixed on the box — the palette laid once round the ring and
//            only drifting (uHue). A rotation sweeps a light over it, so the
//            colour changes as the light travels; the colours do not ride
//            along with it.
//   stroke   a crisp 1px line on the outline — the definition, what a small
//            element is recognised by.
//   inner    a soft glow inward from it — the body.
//   bloom    past the edge, in the bleed — the atmosphere.
//   spark    a rotation's head: a narrow highlight a little ahead of the
//            middle of the lit arc, white on a dark ground and ink on a
//            light one, with a hot point of bloom just ahead of it.
//
// A pulse lights the whole ring and breathes it: each quarter deepens and
// brightens on its own clock (uBreath) while the colour turns slowly round.
// -----------------------------------------------------------------------------
vec4 layered(float sd, float s, vec4 wq, float dark, float reach, float extent, vec2 box) {
  bool rotate = uMode < 1.5;
  float edge = max(-sd, 0.0);
  float out_ = max(sd, 0.0);
  bool outside = sd > 0.0 && uBleed > 0.0;

  // The colour field, pushed back out from its luminance: harder on a light
  // ground, where colour tints rather than adds.
  vec3 c = ring(s - uHue);
  float luma = dot(c, vec3(0.299, 0.587, 0.114));
  c = clamp(mix(vec3(luma), c, mix(1.75, 1.3, dark)), 0.0, 1.0);
  vec3 sparkCol = mix(vec3(0.08), vec3(1.0), dark);

  // Where round the ring the light is.
  float lit;
  float spark = 0.0;
  float hot = 0.0;
  float depth = reach;
  if (rotate) {
    // u: ring units from the head, positive ahead of it. A long tail behind,
    // a shorter fade ahead; the spark and its hot point near the front.
    float u = fract(s - uHead + 0.5) - 0.5;
    lit = smoothstep(-0.36, -0.06, u) * (1.0 - smoothstep(0.04, 0.17, u));
    spark = exp(-pow((u - 0.015) / 0.04, 2.0));
    hot = exp(-pow((u - 0.03) / 0.016, 2.0));
  } else {
    // A pulse is patches of colour, not a frame: three soft lobes round the
    // ring, drifting apart and together, each quarter's breath lifting what
    // is there.
    float b = dot(wq * wq, uBreath);
    float lobes = 0.5 + 0.5 * sin(TAU * (3.0 * s + 0.35 * sin(TAU * uHue * 2.0)));
    lit = mix(0.12, 1.0, lobes * lobes) * mix(0.35, 1.0, clamp((b - 0.62) / 0.46, 0.0, 1.0));
    depth *= b * 2.2;
  }

  // Where the light must end (an extent — the About's depth), the inner
  // glow must have faded out on its own by then, as the flow's beams do
  // (GLOW_EXTENT_PER_REACH): the window below only makes the end exact, and
  // a glow still bright when it gets there is cut, not ended — a line across
  // the light. At the strongest inner glow (alpha ~1 on a screen) that is
  // 2% by the window's start, 0.8 of the extent:
  //   exp(-(0.8 E / depth)^1.1) = 0.02  ->  depth = 0.232 E
  // at the deepest breath, and a breath scales within it.
  if (uExtent.x > 0.0) {
    float cap = extent * 0.232;
    depth = rotate ? min(depth, cap) : min(depth, cap * clamp(dot(wq * wq, uBreath) / 1.08, 0.0, 1.0));
  }

  // The layers, in CSS px. The stroke is a pixel's width, antialiased at the
  // canvas's own resolution.
  float stroke = clamp((1.15 - edge) * uScale, 0.0, 1.0);
  float inner = exp(-pow(edge / max(depth, 0.75), 1.1));
  float bloom = exp(-out_ / max(uBleed * 0.6, 1.0)) * smoothstep(uBleed, uBleed * 0.3, out_);

  vec3 col;
  float a;
  if (outside) {
    a = (lit + hot * 1.6) * bloom * mix(0.5, 0.42, dark);
    col = mix(c, sparkCol, clamp(hot * 0.7, 0.0, 1.0));
  } else {
    // The stroke defines, the inner glow is a breath of colour: both kept
    // low, as border-beam keeps them — a light on the edge, not a frame.
    float strokeA = rotate ? mix(0.4, 0.6, dark) : mix(0.35, 0.55, dark);
    float innerA = rotate ? mix(0.22, 0.34, dark) : mix(0.3, 0.42, dark);
    // A screen is not a card: across a whole screen a glow that faint is
    // lost, so the body of the light grows with the box (border-beam has no
    // screen size to borrow from).
    float big = smoothstep(120.0, 360.0, min(box.x, box.y));
    innerA *= 1.0 + 1.4 * big;
    strokeA *= 1.0 + 0.4 * big;
    float body = lit * (strokeA * stroke + innerA * inner);
    // Ink on a light ground is a shadow, not a light: half as strong.
    float head = spark * (0.95 * stroke + 0.4 * inner) * mix(0.45, 1.0, dark);
    a = max(body, head);
    col = mix(c, sparkCol, clamp(head / max(a, 1e-4), 0.0, 1.0) * 0.85);
    a *= uInside;
  }

  if (uExtent.x > 0.0) {
    a *= 1.0 - smoothstep(extent * 0.8, extent * (1.0 + 0.4 * uSurge), edge);
  }

  // Arrives by fading up, the surge already in the reach; a voice's level
  // and a busy picture firm it, as they do the flow.
  float shown = smoothstep(0.0, 1.0, uReveal);
  a = clamp(a * shown * uStrength * (0.8 + 0.45 * uLevel) * mix(0.85, 1.0, dark) * (1.0 + 0.3 * uBusy), 0.0, 1.0);
  return vec4(col * a, a);
}

void main() {
  vec2 size = uRes / uScale;
  vec2 p = gl_FragCoord.xy / uScale - size * 0.5;
  p.y *= uFlip;
  vec2 box = max(size * 0.5 - uBleed, vec2(1.0));

  float sd = sdRoundBox(p, box, min(uRadius, min(box.x, box.y)));
  // Inward from the edge, CSS px — for a line, up from the bottom edge only,
  // so the light rises from one edge instead of lining all four.
  float edge = max(-sd, 0.0);     // the true rounded outline: the core line
  float out_ = max(sd, 0.0);      // outward, into the bleed
  // Only a glow with room to bleed has an outside; without one, nothing past
  // the outline is drawn (cover, below).
  bool outside = sd > 0.0 && uBleed > 0.0;

  float energy = 0.6 + 0.9 * uLevel;          // 1.0 at the resting 0.45
  vec4 edges = vec4(p.x + box.x, box.x - p.x, p.y + box.y, box.y - p.y);

  // An extent: the light must end at a given distance from each edge (the
  // About's ring ends where the words begin — a different distance off the
  // sides than off the top and bottom). The pixel's own extent blends the
  // two by which edges are near, so a corner eases from one to the other.
  // The beams are sized so their own visible tail ends there
  // (GLOW_EXTENT_PER_REACH), and a window (below) makes the end exact.
  float extent = 0.0;
  if (uExtent.x > 0.0) {
    float kE = max(8.0, min(uExtent.x, uExtent.y) * 0.5);
    float mE = min(min(edges.x, edges.y), min(edges.z, edges.w));
    float wx = exp(-(edges.x - mE) / kE) + exp(-(edges.y - mE) / kE);
    float wy = exp(-(edges.z - mE) / kE) + exp(-(edges.w - mE) / kE);
    extent = (wx * uExtent.x + wy * uExtent.y) / (wx + wy);
  }
  // Where round the ring the pixel is, 0–1 (0.25 the bottom), and its weight
  // toward each quarter (right, bottom, left, top): cos² of the angle to it,
  // which sums to one all the way round, so per-quarter values blend
  // seamlessly — a pulse's breath, the ground.
  float ring_s = atan(p.y / box.y, p.x / box.x) / TAU + 0.5;
  vec4 wq = max(cos(TAU * (ring_s - vec4(0.5, 0.25, 0.0, 0.75))), 0.0);
  // The ground under this part of the ring (lib/ground.ts), blended round it
  // the same way, and how dark it is: the light adds up on a dark ground and
  // tints a light one, by degrees — the theme's page is the two ends, a veil
  // over a picture anywhere between.
  float dark = 1.0 - smoothstep(0.3, 0.75, dot(wq * wq, uGround));

  float reach = (uExtent.x > 0.0 ? extent / ${GLOW_EXTENT_PER_REACH.toFixed(2)} : uWidth) * (1.0 + 1.4 * uSurge) * energy;

  // The light stays on the box: without a bleed, nothing outside its rounded
  // outline (antialiased at the canvas's resolution). A rounded host's
  // corners are not lit past its curve; a square host round a rounded glow
  // — a bezel's screen — is clipped by the host itself.
  float cover = uBleed > 0.0 ? 1.0 : clamp(0.5 - sd * uScale, 0.0, 1.0);
  if (cover <= 0.0) { gl_FragColor = vec4(0.0); return; }

  // Rotate and pulse are built in layers (above); flow is the field below.
  if (uMode > 0.5) {
    gl_FragColor = layered(sd, ring_s, wq, dark, reach, extent, box) * cover;
    return;
  }

  // The beams' depth: the smooth min of the four straight edges, so their
  // light rounds each corner instead of creasing on its diagonal. Softness
  // follows the reach — a screen's ring blends its corners broadly, a
  // badge's barely. A line keeps its one edge.
  // Blended once more with the true outline (and its ln 2 offset added back),
  // so a round host — an avatar, a phone's 44px corners — keeps its light on
  // the curve, where the straight edges alone would sit a few px inside it.
  float kS = max(0.5, reach * 0.55);
  float straight = smin4(max(edges, 0.0), kS);
  float m2 = min(edge, straight);
  float ringD = max(
    m2 - kS * log(exp(-(edge - m2) / kS) + exp(-(straight - m2) / kS)) + kS * 0.6931,
    0.0);
  float d = mix(ringD, max(p.y + box.y, 0.0), uLine);
  if (d > reach * 9.0) { gl_FragColor = vec4(0.0); return; }

  float t = uTime;

  // A line is laid along the bottom edge, not around the centre: an angle
  // swings fast near a wide box's middle, and would fan the beams into rays
  // and pinch the focus into a spike. sx runs the bottom edge from corner
  // to corner (the quarter of the ring it is); the beams and colours spread
  // over half the ring's worth across it, so a line holds a few lobes of
  // light rising from the edge rather than a sliver of the ring.
  float sx = 0.25 - 0.125 * clamp(p.x / box.x, -1.0, 1.0);
  float s = mix(ring_s, 0.25 + (sx - 0.25) * 2.0, uLine);
  float dist = abs(fract(mix(ring_s, sx, uLine) - uFocusAt + 0.5) - 0.5); // 0 … 0.5
  float focus = uFocus <= 0.0 ? 1.0 : exp(-pow(dist / uFocus, 2.2));
  // The reach swells toward the focus centre: the light rises as a dome
  // over the voice (voice-glow's bend).
  d /= mix(1.0, 0.45 + 0.55 * focus, uLine);
  // Past the edge the beams are measured outward, so the halo carries
  // their colours and their depth — a breath blooms, a beam spills — rather
  // than one grey average of the ring.
  if (outside) d = out_;

  vec3 col = vec3(0.0);
  float glow = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float dir = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
    float k = fi < 0.5 ? 2.0 : fi < 1.5 ? 3.0 : fi < 2.5 ? 5.0 : 7.0;
    float speed = 0.16 + 0.07 * fi;
    float wave = 0.5 + 0.5 * sin(TAU * (k * s + dir * speed * t) + fi * 1.9);
    wave = pow(wave, 2.0 + fi * 0.6);
    float swell = 0.65 + 0.35 * sin(TAU * ((k - 1.0) * s - dir * 0.05 * t) + fi);
    // Lows drive the long wave, mids the middle two, highs the fine one.
    float band = fi < 0.5 ? uBands.x : fi < 2.5 ? uBands.y : uBands.z;
    float thick = reach * (0.3 + 1.4 * wave * swell) * (0.45 + 0.55 * band);
    // Steeper than exponential: a plain exp's long tail sums, across a
    // small element, into a wash over its whole face. This keeps the light
    // on the edge at every scale.
    float g = exp(-pow(d / thick, 1.45));
    col += ring(s + dir * 0.025 * t + fi * 0.19) * g;
    glow += g;
  }
  col /= max(glow, 1e-4);
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = clamp(mix(vec3(luma), col, mix(1.55, 1.3, dark)), 0.0, 1.0);
  float a = 1.0 - exp(-glow * 1.15);

  // Outside the box: the halo, the beams' own light fading over the bleed,
  // softer and dimmer. Inside: the line on the edge itself — on the true
  // outline, so it stays crisp.
  if (outside) {
    a *= smoothstep(uBleed, uBleed * 0.4, out_) * mix(0.55, 0.75, dark);
  } else {
    float core = exp(-mix(edge, d, uLine) / (2.2 + 3.0 * uSurge));
    // On a busy picture the core line is the light's relief — whiter and
    // firmer, as text there earns a shadow.
    col = mix(col, vec3(1.0), core * min(1.0, mix(0.18, 0.6, dark) + 0.25 * uBusy));
    a = max(a, core * 0.95) * uInside;
  }

  // The extent's window: the last fifth of it, where the brightest crest is
  // already under 6%, taken to nothing at it — the light's own tail, made
  // exact. The arrival's surge carries past it for a moment.
  if (uExtent.x > 0.0) {
    a *= 1.0 - smoothstep(extent * 0.8, extent * (1.0 + 0.4 * uSurge), d);
  }

  a *= focus;

  // The sweep: out from the focus centre both ways.
  float from = dist * 2.0;                                        // 0 … 1
  float span = uFocus <= 0.0 ? 1.0 : min(1.0, uFocus * 5.0);
  float front = uReveal * 1.15 * span;
  float shown = smoothstep(front, front - 0.15 * span, from);
  float flare = exp(-abs(from - front + 0.06 * span) * 18.0 / span)
    * (1.0 - uReveal) * step(0.001, uReveal) * focus;
  a = a * shown + flare * exp(-d / reach) * 0.8 * (outside ? 0.0 : uInside);
  col = mix(col, vec3(1.0), flare * 0.35);

  // Light adds up on a dark ground and tints a light one: a touch less of it
  // on a light ground, so a small element's corners do not read as a wash,
  // and a touch more on a busy picture, whose texture eats a soft light.
  a = clamp(a * uStrength * (0.8 + 0.45 * uLevel) * mix(0.8, 1.0, dark) * (1.0 + 0.3 * uBusy), 0.0, 1.0) * cover;
  gl_FragColor = vec4(col * a, a);
}
`;
