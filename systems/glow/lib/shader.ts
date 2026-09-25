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
// =============================================================================

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
uniform float uDark;     // 1 in the dark theme
uniform float uStrength; // 0–1, the whole effect
uniform float uLevel;    // 0–1, energy: a voice, or the resting 0.45
uniform vec3 uBands;     // 0–1 per band (low, mid, high); 1,1,1 at rest
uniform float uFocus;    // arc half-width in ring units; 0 = whole ring
uniform float uFocusAt;  // arc centre in ring units; 0.25 = bottom
uniform float uLine;     // 1: focus measured along the bottom edge (a line)
uniform float uFlip;     // -1 mirrors the box top to bottom: a line on the top edge
uniform vec2 uExtent;    // px where the light must end: x off the left / right
                         // edges, y off the top / bottom; 0 = no limit

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
  // Only a glow with room to bleed has an outside; without, the sliver
  // between a rounded box and a square host (a desktop screen's corners) is
  // the edge itself, lit as the edge.
  bool outside = sd > 0.0 && uBleed > 0.0;

  float energy = 0.6 + 0.9 * uLevel;          // 1.0 at the resting 0.45
  vec4 edges = vec4(p.x + box.x, box.x - p.x, p.y + box.y, box.y - p.y);

  // An extent: the light must end at a given distance from each edge (the
  // About's ring ends where the words begin — a different distance off the
  // sides than off the top and bottom). The pixel's own extent blends the
  // two by which edges are near, so a corner eases from one to the other,
  // and the beams are sized to fill it: their natural tail lands inside it,
  // and a window (below) takes the last of the light to zero at it exactly.
  float extent = 0.0;
  if (uExtent.x > 0.0) {
    float kE = max(8.0, min(uExtent.x, uExtent.y) * 0.5);
    float mE = min(min(edges.x, edges.y), min(edges.z, edges.w));
    float wx = exp(-(edges.x - mE) / kE) + exp(-(edges.y - mE) / kE);
    float wy = exp(-(edges.z - mE) / kE) + exp(-(edges.w - mE) / kE);
    extent = (wx * uExtent.x + wy * uExtent.y) / (wx + wy);
  }
  float reach = (uExtent.x > 0.0 ? extent / 3.0 : uWidth) * (1.0 + 1.4 * uSurge) * energy;

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

  float ring_s = atan(p.y / box.y, p.x / box.x) / TAU + 0.5;
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
  col = clamp(mix(vec3(luma), col, mix(1.55, 1.3, uDark)), 0.0, 1.0);
  float a = 1.0 - exp(-glow * 1.15);

  // The line on the edge itself — on the true outline, so it stays crisp.
  float core = exp(-mix(edge, d, uLine) / (2.2 + 3.0 * uSurge));
  col = mix(col, vec3(1.0), core * mix(0.18, 0.6, uDark));
  a = max(a, core * 0.95);

  // Outside the box: the halo, softer and dimmer, fading over the bleed.
  if (outside) {
    float halo = exp(-out_ / max(1.0, reach * 0.55)) * smoothstep(uBleed, uBleed * 0.4, out_);
    a = halo * mix(0.55, 0.75, uDark);
  }

  // The extent's window: fading from just past half of it to nothing at it.
  if (uExtent.x > 0.0) {
    a *= 1.0 - smoothstep(extent * 0.5, extent * (1.0 + 0.4 * uSurge), d);
  }

  a *= focus;

  // The sweep: out from the focus centre both ways.
  float from = dist * 2.0;                                        // 0 … 1
  float span = uFocus <= 0.0 ? 1.0 : min(1.0, uFocus * 5.0);
  float front = uReveal * 1.15 * span;
  float shown = smoothstep(front, front - 0.15 * span, from);
  float flare = exp(-abs(from - front + 0.06 * span) * 18.0 / span)
    * (1.0 - uReveal) * step(0.001, uReveal) * focus;
  a = a * shown + flare * exp(-d / reach) * 0.8 * (outside ? 0.0 : 1.0);
  col = mix(col, vec3(1.0), flare * 0.35);

  // Light adds up on a dark ground and tints a light one: a touch less of it
  // in the light theme, so a small element's corners do not read as a wash.
  a = clamp(a * uStrength * (0.8 + 0.45 * uLevel) * mix(0.8, 1.0, uDark), 0.0, 1.0);
  gl_FragColor = vec4(col * a, a);
}
`;
