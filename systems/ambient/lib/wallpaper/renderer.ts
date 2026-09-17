// =============================================================================
// WallpaperRenderer — owns one WebGL2 canvas and drives the wallpaper shader.
//
//   • Scenes are *targets*: every uniform eases toward its new value with its
//     own time constant, so a weather refetch (say, 30% → 95% cloud) rolls in
//     over a couple of seconds instead of snapping, and the sun creeps along
//     its arc as the minutes tick.
//   • Drift offsets (cloud / snow advection) accumulate in JS from the
//     smoothed wind, so a change of wind never teleports the sky.
//   • Adaptive quality: the internal resolution starts from a pixel budget
//     and backs off when frames run long, recovering when they are cheap.
//   • Pauses when the tab is hidden; renders one still frame under
//     prefers-reduced-motion; survives context loss.
//   • A poke (the click-answered easter eggs — see ../poke.ts) is the one thing
//     here that is *not* eased: `poke()` arms `uPoke*` and the shader runs its
//     own envelope off the age. A strike that eased in would not be a strike.
//
// Zero React inside — the component just hands it a canvas and scenes.
// =============================================================================

import { UPRIGHT_GRAVITY, type GravityVector } from "../gyroscope";
import type { WeatherScene } from "../scene";
import { POKE_KIND_CODE, POKE_MS, type PokeKind } from "../poke";
import {
  WIPE_JUMP,
  WIPE_LIFE_MS,
  WIPE_MAX_GAP,
  WIPE_BLOW_STILL,
  WIPE_BLOW_WIND,
  WIPE_MAX_POINTS,
  WIPE_SETTLE,
  WIPE_SLACK,
  freshHand,
  rub,
} from "../wipe";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shader";

interface UniformSpec {
  name: string;
  size: 1 | 2 | 3;
  /** Smoothing time constant in seconds (0 = snap). */
  tau: number;
}

// Where a body is drawn tracks the clock it was given (`TRACK`); what the sky
// is made of crossfades. A live clock moves the sun and moon by a thousandth
// of a screen a minute, so their easing is only ever felt when the clock is
// driven by hand — the devtool's date and time sliders — and there it should
// feel attached to the slider, not towed behind it.
const TRACK = 0.25;

// What the theme changes, and all it changes: the veil's colour and amount and
// the exposure (VEIL_DEFAULTS in ../scene.ts). Named so `setThemeEase` can
// stretch this one group — the sun's handover takes as long over the sky as it
// does over the page — without the weather slowing down with it.
const THEME = 0.5;

const UNIFORMS: UniformSpec[] = [
  { name: "uSun", size: 2, tau: TRACK },
  { name: "uSunElevation", size: 1, tau: TRACK },
  { name: "uDaylight", size: 1, tau: 1.6 },
  { name: "uZenith", size: 3, tau: 1.8 },
  { name: "uHorizon", size: 3, tau: 1.8 },
  { name: "uGlow", size: 3, tau: 1.8 },
  { name: "uGlowStrength", size: 1, tau: 1.8 },
  { name: "uMoon", size: 2, tau: TRACK },
  { name: "uMoonPhase", size: 1, tau: 0 },
  { name: "uMoonVisible", size: 1, tau: 1.8 },
  { name: "uMoonSize", size: 1, tau: TRACK },
  { name: "uHemisphere", size: 1, tau: 0 },
  { name: "uCloudCover", size: 1, tau: 2.6 },
  { name: "uCloudDensity", size: 1, tau: 2.6 },
  { name: "uCloudDarkness", size: 1, tau: 2.6 },
  { name: "uCloudSpeed", size: 1, tau: 2.0 },
  { name: "uCloudLit", size: 3, tau: 1.8 },
  { name: "uCloudShade", size: 3, tau: 1.8 },
  { name: "uRain", size: 1, tau: 2.4 },
  { name: "uSnow", size: 1, tau: 2.4 },
  { name: "uWind", size: 2, tau: 3.0 },
  { name: "uFog", size: 1, tau: 2.4 },
  { name: "uLightning", size: 1, tau: 1.5 },
  { name: "uStars", size: 1, tau: 2.0 },
  { name: "uStarsBehind", size: 1, tau: 2.0 },
  { name: "uMoonBehind", size: 1, tau: 1.8 },
  { name: "uVeilColor", size: 3, tau: THEME },
  { name: "uVeilAmount", size: 1, tau: THEME },
  { name: "uExposure", size: 1, tau: THEME },
];

const FLOAT_COUNT = UNIFORMS.reduce((n, u) => n + u.size, 0);

/**
 * Per-uniform float offset into the packed scene, and the distinct easing time
 * constants — both derived once from the table, so the per-frame loops index
 * arrays instead of scanning names.
 */
const OFFSET: Record<string, number> = {};
const TAUS: number[] = [];
const META = UNIFORMS.map((u, i) => {
  const offset = UNIFORMS.slice(0, i).reduce((n, v) => n + v.size, 0);
  OFFSET[u.name] = offset;
  let tauIndex = TAUS.indexOf(u.tau);
  if (tauIndex < 0) tauIndex = TAUS.push(u.tau) - 1;
  return { offset, size: u.size, tauIndex };
});
/** Which of `TAUS` is the theme's, for `setThemeEase` to override. */
const THEME_TAU_INDEX = TAUS.indexOf(THEME);
const WIND_OFFSET = OFFSET.uWind;
const CLOUD_SPEED_OFFSET = OFFSET.uCloudSpeed;
const SNOW_OFFSET = OFFSET.uSnow;

/** A fixed, pleasant moment on the shader clock for a still frame. */
const STILL_FRAME_SEC = 37;

// -----------------------------------------------------------------------------
// Stirring up a gust
//
// A hand dragged across the background makes wind, and nothing else: the rain
// keeps falling, the snow keeps drifting, and the only thing the visitor adds is
// a term on the wind. So the sky answers a hand exactly as it answers the
// forecast, and there is no second physics to keep honest.
//
// Air has mass, and that is the whole feel of it:
//
//   · The hand's own motion (`stir`) goes stale within a breath, so a finger
//     resting on the page makes no wind at all — only a moving one does.
//   · The gust chases that stir slowly. A flick barely raises it; a long sweep
//     builds it. Real gusts arrive over a moment, not a frame.
//   · And it falls away more slowly still, so the sky settles back on its own.
//
// Everything below is in the shader's units: wind is −1..1, positive blowing
// right, and one unit of hand travel is one viewport HEIGHT.
// -----------------------------------------------------------------------------

const GUST = {
  /** Hand speed (heights/s) → gust, through `tanh`, so a frantic hand saturates. */
  gain: 0.55,
  /**
   * The strongest gust a hand can raise — above 1.0 on purpose, which is the
   * top of the forecast's own range (50 km/h). A gust is not a wind; it is
   * allowed to be briefly harder than any weather the sky is showing.
   */
  max: 1.1,
  /** How quickly the hand's motion stops counting once it stops moving. */
  stirTau: 0.1,
  /**
   * The gust's rise. Short: a squall front slams the rain over, it does not
   * lean it politely. The rain's lean shears the curtain about mid-screen, so
   * the edges sweep sideways at `0.5 × 0.75 × max ÷ attack` heights a second —
   * a little over its own fall speed, which is the most that still reads as
   * air rather than as a whip.
   */
  attack: 0.13,
  /**
   * And its fall — more than ten times as long, which is the shape of the
   * thing. A gust arrives all at once and then *passes*: it is still half
   * itself a second later, still visible at three, and gone by six. Getting up
   * and dying away at the same rate is what makes a gust read as a twitch.
   */
  release: 1.6,
} as const;

// -----------------------------------------------------------------------------
// Where the weather falls
//
// Wind reaches the rain and the snow as one thing only: the direction they
// fall in. Gravity pulls down, the air pushes sideways, and a particle at
// terminal velocity travels along the sum — so a gust does not distort the
// curtain, it re-aims it, and the whole of the feel is in how fast each field
// can be re-aimed.
//
// THE GYROSCOPE ARRIVES BY THE SAME DOOR, and that is the point of writing it
// this way. A tilt moves gravity; a wind adds a term across it; the weather
// only ever sees the sum:
//
//     fall = g + perp(g) · lean
//
// with `g` the unit gravity in page space — (0,-1) for a screen lying flat or
// held upright, the sensor's reading otherwise — and `perp(g)` gravity turned
// a quarter turn, which is screen-right when `g` is screen-down.
//
// ACROSS GRAVITY, not across the page, and it is worth saying why. A storm's
// wind is horizontal in the world, and horizontal means perpendicular to the
// way things fall. Turn the phone on its side and a real snowfall does not
// stop being laid over — the whole storm turns with you, the flakes keeping
// their angle to gravity. Holding the wind along the page instead would mean
// that at ninety degrees the wind blew straight down the fall, speeding the
// rain up rather than leaning it, which is nothing that happens outdoors.
//
// (An earlier draft did hold it across the page, of necessity rather than
// choice: while the wind was a positional offset added to a flake's cell, a
// term that turned with gravity would have slid the whole field across the
// page as the snow came round. Once the wind became part of the travel that
// reason dissolved, and only the choice was left.)
//
//   · The RAIN eases. A drop is small, fast and already all the way down, so
//     it is at the new angle within a blink; the ease is barely more than the
//     smoothing that keeps a slammed gust from cracking like a whip.
//   · The SNOW is a critically damped SPRING, and that is the difference
//     between drag and mass. An ease leaves at full speed and decelerates,
//     which reads as being dragged; a spring leaves at REST and has to be
//     accelerated, which reads as having a body. Turn the wind and the flakes
//     keep going the way they were going, then come round — and then keep
//     going that way after the air is still.
//   · The CLOUD decks are heavier again and get nothing from a hand at all:
//     you cannot stir a cloud by waving at it. They answer the forecast only.
//
// Both leans below are sideways-over-fall — a tangent, not a speed — and each
// field has its own because a flake falls at about a thirtieth of a drop's
// speed and the same air therefore lays it over much further.
// -----------------------------------------------------------------------------

/** The rain's lean per unit of wind, and how long it takes to get there. */
const RAIN_LEAN = 0.75;
/**
 * Short on purpose. A drop is small, fast and already all the way down, so it
 * really is at the new angle within a blink — and the air it is answering has
 * its own rise and fall (`GUST`) which is where a gust's shape belongs. What
 * is left for this to do is keep a slammed gust from cracking like a whip: at
 * a tenth of a second the curtain's far corner sweeps under a screen height a
 * second, against the 1.5–2.5 the rain is falling at.
 */
const RAIN_FALL_TAU = 0.08;

/**
 * The snow's, which is three and a half times flatter at the same wind…
 *
 * It looks like a magic number and it is a derived one: the shader lays the
 * snow along `uSnowFall × fall`, where `fall` is the layer's own speed, so a
 * lean of L here is the same picture the two hand-tuned depth ramps used to
 * draw at a drift of `L × 0.2278`. That 0.2278 is the ratio the old ramps
 * shared — which is why they had to span the same 3x, and why they no longer
 * have to.
 */
const SNOW_LEAN = 2.634;

/**
 * …and the natural frequency of its spring, in rad/s. At critical damping
 * there is no overshoot, so the snow never swings past the new direction and
 * back: heavy, not springy. Against a step it is a fifth of the way round at
 * one second, half at two, three quarters at three and all but there at five,
 * while its first frame moves at a tenth of its own top speed and the rain's
 * at all of it. That gap is the mass.
 *
 * ONE number, for the wind and for the tilt alike — a flake's body cannot know
 * which of the two moved, and a sky where the same flakes came round at two
 * different rates depending on the cause would be a sky with two physics in
 * it. This is the value the snow's shipped answer to a change of wind was
 * already worth; a tilt now costs the same seconds, which is slower than a
 * tilt-only draft of this wanted, and right for the same reason.
 */
const SNOW_FALL_OMEGA = 0.9;

/**
 * How much faster heavier snow falls. It used to live in the shader, on each
 * layer's speed, with a copy here to divide the lean by — a number kept in
 * step by hand across a JS/GLSL boundary, which is the kind of arrangement
 * that is right until the day it is not.
 *
 * It only ever belonged on one side. The shader's job is a DEPTH ramp; how
 * fast snow falls is a property of the snow, and the travel is accumulated
 * here. Moving it also stops a change of intensity from re-scaling every
 * second of fall already banked — the same reason `uRainFall` is accumulated
 * rather than multiplied out of the clock.
 */
const snowFallRate = (snow: number) => 0.85 + 0.3 * snow;

/**
 * Where the snow's accumulated travel wraps — the shader clock's own hourly
 * wrap, for the same reason. Its magnitude is roughly elapsed fall time, and
 * once that reaches the tens of thousands of cell widths float32 has no
 * fraction left to place a flake inside its cell with.
 */
const FALL_WRAP_SEC = 3600;

/** How long each poke lives, in seconds — the shader's envelope is spent by then. */
const POKE_SEC: Record<PokeKind, number> = {
  strike: POKE_MS.strike / 1000,
  meteor: POKE_MS.meteor / 1000,
};

/** How long one wiped point lives — cleared, held, and closed over again. */
const WIPE_LIFE_SEC = WIPE_LIFE_MS / 1000;

function packScene(scene: WeatherScene, out: Float32Array) {
  const precip = scene.precipitation;
  const { sun, sky, moon, clouds, veil } = scene;
  // In UNIFORMS order.
  out[0] = sun.screen.x; out[1] = sun.screen.y;
  out[2] = sun.elevation;
  out[3] = sun.daylight;
  out[4] = sky.zenith[0]; out[5] = sky.zenith[1]; out[6] = sky.zenith[2];
  out[7] = sky.horizon[0]; out[8] = sky.horizon[1]; out[9] = sky.horizon[2];
  out[10] = sky.glow[0]; out[11] = sky.glow[1]; out[12] = sky.glow[2];
  out[13] = sky.glowStrength;
  out[14] = moon.screen.x; out[15] = moon.screen.y;
  out[16] = moon.phase;
  out[17] = moon.visible;
  out[18] = moon.size;
  out[19] = scene.hemisphere;
  out[20] = clouds.cover;
  out[21] = clouds.density;
  out[22] = clouds.darkness;
  out[23] = clouds.speed;
  out[24] = clouds.lit[0]; out[25] = clouds.lit[1]; out[26] = clouds.lit[2];
  out[27] = clouds.shade[0]; out[28] = clouds.shade[1]; out[29] = clouds.shade[2];
  out[30] = precip.type === "rain" ? precip.intensity : 0;
  out[31] = precip.type === "snow" ? precip.intensity : 0;
  out[32] = scene.wind.x; out[33] = scene.wind.y;
  out[34] = scene.fog;
  out[35] = scene.lightning;
  out[36] = scene.stars;
  out[37] = scene.behind.stars;
  out[38] = scene.behind.moon;
  out[39] = veil.color[0]; out[40] = veil.color[1]; out[41] = veil.color[2];
  out[42] = veil.amount;
  out[43] = scene.exposure;
}
if (FLOAT_COUNT !== 44) throw new Error("packScene is out of step with UNIFORMS");

export interface WallpaperRendererOptions {
  /** Render a single still frame and re-render only on scene/size changes. */
  reducedMotion?: boolean;
  /** Target internal pixel count. */
  pixelBudget?: number;
  maxFps?: number;
  /** Called when WebGL is unavailable or irrecoverably lost. */
  onFallback?: (reason: string) => void;
  /** Called once, after the first frame has been painted. */
  onFirstFrame?: () => void;
}

interface ResolvedOptions {
  reducedMotion: boolean;
  pixelBudget: number;
  maxFps: number;
  onFallback?: (reason: string) => void;
  onFirstFrame?: () => void;
}

export interface WallpaperStats {
  width: number;
  height: number;
  scale: number;
  frameMs: number;
}

const MIN_SCALE = 0.35;

export class WallpaperRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  /** Uniform locations, resolved once: one per UNIFORMS entry, plus the per-frame five. */
  private locs: (WebGLUniformLocation | null)[] = [];
  private locResolution: WebGLUniformLocation | null = null;
  private locTime: WebGLUniformLocation | null = null;
  private locSeed: WebGLUniformLocation | null = null;
  private locCloudDrift: WebGLUniformLocation | null = null;
  private locRainDown: WebGLUniformLocation | null = null;
  private locRainFall: WebGLUniformLocation | null = null;
  private locSnowDown: WebGLUniformLocation | null = null;
  private locSnowFall: WebGLUniformLocation | null = null;
  private locPoke: WebGLUniformLocation | null = null;
  private locPokeAge: WebGLUniformLocation | null = null;
  private locPokeSeed: WebGLUniformLocation | null = null;
  private locPokeKind: WebGLUniformLocation | null = null;
  private locWipe: WebGLUniformLocation | null = null;
  private locWipeCount: WebGLUniformLocation | null = null;
  private locWipeBox: WebGLUniformLocation | null = null;
  private locWipeBlow: WebGLUniformLocation | null = null;
  private locFrameSec: WebGLUniformLocation | null = null;
  /** Per-frame easing factors, one per distinct tau. */
  private ks = new Float64Array(TAUS.length);
  private vao: WebGLVertexArrayObject | null = null;

  private target = new Float32Array(FLOAT_COUNT);
  /** Seconds, or null for each uniform's own tau. See setThemeEase. */
  private themeTau: number | null = null;
  private current = new Float32Array(FLOAT_COUNT);
  private hasScene = false;
  private seed = 0;

  private running = false;
  private raf = 0;
  private lastFrameAt = 0;
  private startAt = 0;
  private cloudDrift = 0;
  /**
   * Where the page's own down is: the sensor's last reading, or upright, which
   * is also what a device with no gyroscope and a visitor with the tilt off
   * both come to. Kept as a unit vector; see `setGravity`.
   */
  private gravity = new Float32Array([UPRIGHT_GRAVITY.x, UPRIGHT_GRAVITY.y]);
  /**
   * Where each field is actually going — gravity plus the wind across it —
   * chasing that sum at its own weight, with the velocity of the snow's
   * spring beside it. Not unit vectors: a leaning fall is a longer one, and
   * the travels below are their integrals, so the length is the speed.
   */
  private rainDir = new Float32Array([0, -1]);
  private snowDir = new Float32Array([0, -1]);
  private snowDirVel = new Float32Array([0, 0]);
  /** Scratch for the target of each, rebuilt every frame. */
  private fallAt = new Float32Array([0, -1]);
  /** Where the mist carries a cleared patch over one point's life — see aimWipe. */
  private wipeBlow = new Float32Array([0, -WIPE_SETTLE]);
  /**
   * How far each field has travelled. The rain's is a scalar because its
   * streaks are drawn in a frame aligned to its own fall, where the only thing
   * left to know is how far; the snow's is a vector because a direction still
   * coming round must not drag what has already fallen sideways along with it.
   * Both start where the still frame's clock used to put them.
   */
  private rainFall = STILL_FRAME_SEC;
  private snowFall = new Float32Array([0, -STILL_FRAME_SEC]);

  /** The wind a hand asked for, when it asked, and what the air has got to. */
  private stir = 0;
  private stirAt = 0;
  private gust = 0;

  /**
   * The poke in flight — a strike, a meteor — of which there is never more
   * than one: the conditions that arm them are disjoint (see ../poke.ts).
   * `pokeAt` of 0 means none is running.
   */
  private pokeAt = 0;
  private pokeX = 0.5;
  private pokeY = 0.5;
  private pokeSeed = 0;
  private pokeAge = -1;
  private pokeKind = 0;
  private pokeLife = 0;

  // The fog wipe. A ring of the path's recent corners, oldest first:
  // `wipeCount` of them starting at `wipeStart`, each one (x, y, made-at) plus
  // whether it continues the corner before it or begins a new stroke. They
  // expire in the order they were made, so ageing them is a walk from the
  // front — and because deaths are always a prefix, a surviving corner is never
  // joined across to some older stroke's.
  private wipeXY = new Float32Array(WIPE_MAX_POINTS * 2);
  private wipeAt = new Float64Array(WIPE_MAX_POINTS);
  private wipeJoin = new Uint8Array(WIPE_MAX_POINTS);
  /** What the hand had left when each corner was made — see `rub` in ../wipe. */
  private wipeCharge = new Float32Array(WIPE_MAX_POINTS);
  private wipeStart = 0;
  private wipeCount = 0;
  /** What the shader is handed: (x, y, life 0..1, ±charge) per live corner. */
  private wipeData = new Float32Array(WIPE_MAX_POINTS * 4);
  private wipeLive = 0;
  /** The live corners' bounding box in screen units, so the shader can skip the loop. */
  private wipeBox = new Float32Array(4);
  /** Whether a stroke is in progress — its last corner is the one under the hand. */
  private wipeStroke = false;
  /** Path length travelled since the last committed corner, for the curvature test. */
  private wipeRun = 0;
  /** The hand. It tires across strokes, not within one — lifting gives nothing back. */
  private hand = freshHand();

  private dpr = 1;
  private baseScale = 1;
  private scale = 1;
  private frameEma = 16;
  /** The shader clock of the last frame drawn, so a resize can repaint it. */
  private lastTimeSec = STILL_FRAME_SEC;
  private slowFrames = 0;
  private fastFrames = 0;
  private cssWidth = 0;
  private cssHeight = 0;

  private opts: ResolvedOptions;
  private firstFrameDone = false;
  private resizeObserver: ResizeObserver | null = null;
  private destroyed = false;

  constructor(canvas: HTMLCanvasElement, options: WallpaperRendererOptions = {}) {
    this.canvas = canvas;
    this.opts = {
      reducedMotion: options.reducedMotion ?? false,
      pixelBudget: options.pixelBudget ?? 1_000_000,
      maxFps: options.maxFps ?? 60,
      onFallback: options.onFallback,
      onFirstFrame: options.onFirstFrame,
    };
    this.startAt = performance.now();
    this.lastFrameAt = this.startAt;

    canvas.addEventListener("webglcontextlost", this.onContextLost);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored);

    if (!this.initGL()) {
      this.opts.onFallback?.("webgl2-unavailable");
      return;
    }
    this.measure();
    this.observeSize();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  setScene(scene: WeatherScene) {
    // Where every uniform was aimed before this scene arrived.
    const prevTarget = this.target.slice();
    packScene(scene, this.target);
    this.seed = scene.seed;
    if (!this.hasScene) {
      this.current.set(this.target);
      // Start both fields already leaning into the scene's wind. Coming up
      // from nothing would mean the first seconds of a page had the weather
      // falling straight down through a gale.
      this.snapFall();
      this.hasScene = true;
    }
    // The phase is cyclic; never interpolate it.
    this.snap("uMoonPhase");
    // Easing is for the minute-by-minute drift of a live clock, and for a hand
    // on a devtool slider. A jump of the clock (a phase preset, a refetch after
    // hours asleep) would otherwise fly the sun or moon across the screen in a
    // straight line, which reads as a wrong trajectory — so it snaps instead.
    // The jump that matters is between one target and the next: measuring
    // against the eased position instead would read a run of small steps — a
    // scrub — as one big jump, and teleport the disc mid-drag.
    this.snapIfJumped("uSun", prevTarget, 0.2);
    this.snapIfJumped("uMoon", prevTarget, 0.2, ["uMoonVisible"]);
    if (this.opts.reducedMotion) {
      this.settle();
    } else if (!this.running) {
      this.start();
    }
  }

  /**
   * Answer a click at (x, y) in screen space — 0..1 across, 0..1 bottom → top,
   * the same convention as the sun — with whatever the weather answers with.
   * The easter eggs; see ../poke.ts.
   *
   * Only while the frame loop is already running: a poke is an animation, and a
   * stopped renderer is either inactive or under `prefers-reduced-motion`,
   * where a flash is the one thing not to make.
   */
  poke(kind: PokeKind, x: number, y: number) {
    if (!this.running || this.destroyed || !this.gl) return;
    this.pokeX = x;
    this.pokeY = y;
    this.pokeSeed = Math.random() * 97;
    this.pokeKind = POKE_KIND_CODE[kind];
    this.pokeLife = POKE_SEC[kind];
    this.pokeAt = performance.now();
    this.pokeAge = 0;
  }

  /**
   * A hand went past at `vxPx` CSS pixels per second, left to right.
   *
   * Only the horizontal component: wind in this sky is horizontal, and a hand
   * swiped straight down does not make a sideways breeze. What it asks for is a
   * wind; how much of one the air gets up to is `advanceGust`, and how much of
   * THAT each field's fall gets re-aimed by is "Where the weather falls".
   */
  stirWind(vxPx: number) {
    const heights = vxPx / Math.max(1, this.cssHeight);
    this.stir = GUST.max * Math.tanh(heights * GUST.gain);
    this.stirAt = performance.now();
  }

  /**
   * Which way gravity points in screen space — the gyroscope's reading. `null`
   * is an upright screen, which is also where this starts, so a device with no
   * sensor (or a visitor with the tilt off) is simply the case where nobody
   * ever calls it.
   *
   * Nothing in the sky is turned by it. It joins the wind in the one vector
   * the weather answers to (see "Where the weather falls"), so the rain is
   * re-aimed within a blink and the snow over seconds — the same ease and the
   * same spring a gust gets, because a flake cannot tell which of the two
   * moved. Under reduced motion there is nothing to lag: both snap to it.
   */
  setGravity(gravity: GravityVector | null) {
    const g = gravity ?? UPRIGHT_GRAVITY;
    const len = Math.hypot(g.x, g.y);
    // A direction, kept one: the wind's lean is measured against a unit fall,
    // so a reading that arrived a little short would quietly flatten it.
    if (len < 1e-4) {
      this.gravity[0] = UPRIGHT_GRAVITY.x;
      this.gravity[1] = UPRIGHT_GRAVITY.y;
    } else {
      this.gravity[0] = g.x / len;
      this.gravity[1] = g.y / len;
    }
    if (this.opts.reducedMotion) {
      this.settle();
    }
  }

  /**
   * How long the theme's own uniforms take to arrive, in ms to settled, or
   * null for the table's own pace. An exponential ease is asymptotic, so
   * "settled" is 3 time constants — close enough to read as arrived.
   */
  setThemeEase(settleMs: number | null) {
    this.themeTau =
      settleMs !== null && settleMs > 0 ? settleMs / 3000 : null;
  }

  /**
   * Clear the mist at (x, y) — same screen space as `poke`. Called once per
   * frame along a drag.
   *
   * The path is kept as the corners of a polyline, not as a row of discs, and
   * the shader sweeps the swath along it. That is what makes the trail long
   * enough to write with: a corner buys a whole segment rather than one dot, so
   * the ring covers a path many times its own length, and there are no gaps
   * between samples to fill in.
   *
   * The last corner is the one under the hand and simply slides with it, so the
   * swath always reaches the fingertip. A new one is committed by *shape* —
   * when the path has bowed away from the straight line the shader would draw
   * (`WIPE_SLACK`), or at `WIPE_MAX_GAP` on a run straight enough never to trip
   * that. Never by frame: a slow, careful hand would spend the whole ring on a
   * single letter, and a fast one would get its curves cut into chords.
   *
   * Only while the frame loop is already running, for the same reason a poke
   * is: a stopped renderer is either inactive or under `prefers-reduced-motion`.
   */
  wipe(x: number, y: number) {
    if (!this.running || this.destroyed || !this.gl) return;
    const now = performance.now();

    if (!this.wipeStroke || this.wipeCount < 2) {
      this.beginWipeStroke(x, y, now);
      return;
    }

    // Measured in the shader's own space, where x is stretched by the aspect —
    // a stroke is an even width on screen, so its geometry has to be too.
    const aspect = this.cssHeight > 0 ? this.cssWidth / this.cssHeight : 1;
    const head = (this.wipeStart + this.wipeCount - 1) % WIPE_MAX_POINTS;
    const step = Math.hypot(
      (x - this.wipeXY[head * 2]) * aspect,
      y - this.wipeXY[head * 2 + 1]
    );
    if (step > WIPE_JUMP) {
      this.beginWipeStroke(x, y, now);
      return;
    }

    // What the hand manages here. Spent by the distance rubbed and recovered
    // only off the glass, so the far end of a long stroke comes up less clear
    // than the near end did — and the corner keeps whatever it was given, which
    // is what puts the gradient along the path rather than over the whole of it.
    const charge = rub(this.hand, step, now);

    // How far the hand has travelled since the last corner, against how far it
    // has actually got: on a straight run the two are equal, and the more the
    // path bows the further they drift apart. That difference is the curvature
    // test — commit as soon as the straight line the shader would draw stops
    // being the path, which is what keeps a letter off the polygon it was
    // coming out as. A straight run never trips it, so it still spends one
    // corner per WIPE_MAX_GAP and the trail stays long.
    const anchor = (this.wipeStart + this.wipeCount - 2) % WIPE_MAX_POINTS;
    this.wipeRun += step;
    const chord = Math.hypot(
      (x - this.wipeXY[anchor * 2]) * aspect,
      y - this.wipeXY[anchor * 2 + 1]
    );
    if (this.wipeRun - chord > WIPE_SLACK || chord >= WIPE_MAX_GAP) {
      // The corner lands where the hand is now; the old head — a point the hand
      // really passed through — becomes the anchor of the live segment, and the
      // run restarts from it.
      this.pushWipe(x, y, now, 1, charge);
      this.wipeRun = step;
    }

    // Slide the head onto the pointer, so the swath reaches the fingertip. It is
    // "now", so it carries what the hand has now.
    const live = (this.wipeStart + this.wipeCount - 1) % WIPE_MAX_POINTS;
    this.wipeXY[live * 2] = x;
    this.wipeXY[live * 2 + 1] = y;
    this.wipeCharge[live] = charge;
  }

  /**
   * End the stroke. The corners keep healing on their own; this only stops the
   * next stroke being joined to this one across the screen.
   */
  wipeEnd() {
    this.wipeStroke = false;
  }

  setReducedMotion(reduced: boolean) {
    if (this.opts.reducedMotion === reduced) return;
    this.opts.reducedMotion = reduced;
    if (reduced) {
      this.stop();
      // Nothing will advance the gust again; don't freeze half of one into the
      // still frame — nor half a turn of the fall it was in the middle of.
      this.stir = 0;
      this.gust = 0;
      this.settle();
    } else if (this.hasScene) {
      this.start();
    }
  }

  start() {
    if (this.running || this.destroyed || !this.gl) return;
    if (this.opts.reducedMotion) {
      this.renderOnce();
      return;
    }
    this.running = true;
    this.lastFrameAt = performance.now();
    document.addEventListener("visibilitychange", this.onVisibility);
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    // Every egg is measured in wall-clock time; a paused renderer would resume
    // one hours later, mid-flash — or with a hole in the fog that never healed.
    this.pokeAt = 0;
    this.pokeAge = -1;
    this.wipeCount = 0;
    this.wipeLive = 0;
    this.wipeStroke = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  destroy() {
    this.destroyed = true;
    this.stop();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener("resize", this.onResize);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    const gl = this.gl;
    if (gl) {
      if (this.program) gl.deleteProgram(this.program);
      if (this.vao) gl.deleteVertexArray(this.vao);
      // Deliberately *not* WEBGL_lose_context.loseContext(): a canvas hands
      // back the same context object on every getContext(), so losing it here
      // would poison the next renderer mounted on this canvas (React strict
      // mode remounts, fast refresh). The context goes away with the element.
    }
    this.gl = null;
    this.program = null;
    this.vao = null;
  }

  getStats(): WallpaperStats {
    return {
      width: this.canvas.width,
      height: this.canvas.height,
      scale: this.scale,
      frameMs: this.frameEma,
    };
  }

  // ---------------------------------------------------------------------------
  // GL setup
  // ---------------------------------------------------------------------------

  private initGL(): boolean {
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = this.canvas.getContext("webgl2", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: "low-power",
      });
    } catch {
      gl = null;
    }
    if (!gl) return false;

    const program = this.compile(gl);
    if (!program) return false;

    this.gl = gl;
    this.program = program;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.useProgram(program);
    this.locs = UNIFORMS.map((u) => gl.getUniformLocation(program, u.name));
    this.locResolution = gl.getUniformLocation(program, "uResolution");
    this.locTime = gl.getUniformLocation(program, "uTime");
    this.locSeed = gl.getUniformLocation(program, "uSeed");
    this.locCloudDrift = gl.getUniformLocation(program, "uCloudDrift");
    this.locRainDown = gl.getUniformLocation(program, "uRainDown");
    this.locRainFall = gl.getUniformLocation(program, "uRainFall");
    this.locSnowDown = gl.getUniformLocation(program, "uSnowDown");
    this.locSnowFall = gl.getUniformLocation(program, "uSnowFall");
    this.locPoke = gl.getUniformLocation(program, "uPoke");
    this.locPokeAge = gl.getUniformLocation(program, "uPokeAge");
    this.locPokeSeed = gl.getUniformLocation(program, "uPokeSeed");
    this.locPokeKind = gl.getUniformLocation(program, "uPokeKind");
    this.locWipe = gl.getUniformLocation(program, "uWipe");
    this.locWipeCount = gl.getUniformLocation(program, "uWipeCount");
    this.locWipeBox = gl.getUniformLocation(program, "uWipeBox");
    this.locWipeBlow = gl.getUniformLocation(program, "uWipeBlow");
    this.locFrameSec = gl.getUniformLocation(program, "uFrameSec");
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    return true;
  }

  private compile(gl: WebGL2RenderingContext): WebGLProgram | null {
    const make = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[wallpaper] shader compile failed:", gl.getShaderInfoLog(sh));
        }
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };
    const vs = make(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = make(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return null;
    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[wallpaper] program link failed:", gl.getProgramInfoLog(program));
      }
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.stop();
  };

  private onContextRestored = () => {
    if (this.destroyed) return;
    if (this.initGL()) {
      this.measure();
      if (this.hasScene) this.start();
    } else {
      this.opts.onFallback?.("webgl2-lost");
    }
  };

  // ---------------------------------------------------------------------------
  // Sizing / quality
  // ---------------------------------------------------------------------------

  private observeSize() {
    if (this.resizeObserver || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", this.onResize);
      return;
    }
    this.resizeObserver = new ResizeObserver(() => this.measure());
    this.resizeObserver.observe(this.canvas);
  }

  private onResize = () => this.measure();

  private onVisibility = () => {
    if (document.hidden) {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else if (this.running && !this.raf) {
      this.lastFrameAt = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    }
  };

  private measure() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const changed = w !== this.cssWidth || h !== this.cssHeight;
    this.cssWidth = w;
    this.cssHeight = h;
    const devicePixels = w * h * this.dpr * this.dpr;
    this.baseScale = Math.min(1, Math.sqrt(this.opts.pixelBudget / Math.max(1, devicePixels)));
    if (changed) {
      this.scale = this.baseScale;
      this.slowFrames = 0;
      this.fastFrames = 0;
    }
    this.applySize();
  }

  /**
   * Size the drawing buffer — and repaint it in the same task.
   *
   * Setting a canvas's width or height clears its buffer, and with
   * `alpha: false` that is opaque black. The ResizeObserver that calls this
   * runs after layout and before paint, while the frame loop's next draw is a
   * whole animation frame away (further under the FPS throttle), so without an
   * immediate repaint the browser composites a black canvas for every step of a
   * window resize: a flicker to black while dragging. Repainting here, with
   * the last frame's clock, means the cleared buffer is never shown. The
   * adaptive-quality path skips the repaint because a draw follows it anyway.
   */
  private applySize(repaint = true) {
    const px = Math.max(1, Math.round(this.cssWidth * this.dpr * this.scale));
    const py = Math.max(1, Math.round(this.cssHeight * this.dpr * this.scale));
    if (this.canvas.width === px && this.canvas.height === py) return;
    this.canvas.width = px;
    this.canvas.height = py;
    if (repaint && this.gl && this.hasScene) this.draw(this.lastTimeSec);
  }

  private adaptQuality(dt: number) {
    if (dt > 250) return; // tab was asleep; not a real frame
    this.frameEma += (dt - this.frameEma) * 0.08;
    const budget = 1000 / this.opts.maxFps;
    if (this.frameEma > budget * 1.55) {
      this.slowFrames++;
      this.fastFrames = 0;
      if (this.slowFrames > 45 && this.scale > MIN_SCALE) {
        this.scale = Math.max(MIN_SCALE, this.scale * 0.8);
        this.slowFrames = 0;
        this.applySize(false);
      }
    } else if (this.frameEma < budget * 0.9) {
      this.fastFrames++;
      this.slowFrames = 0;
      if (this.fastFrames > 300 && this.scale < this.baseScale) {
        this.scale = Math.min(this.baseScale, this.scale / 0.8);
        this.fastFrames = 0;
        this.applySize(false);
      }
    } else {
      this.slowFrames = Math.max(0, this.slowFrames - 1);
    }
  }

  // ---------------------------------------------------------------------------
  // Frame loop
  // ---------------------------------------------------------------------------

  private frame = (now: number) => {
    this.raf = 0;
    if (!this.running || !this.gl) return;
    const dt = now - this.lastFrameAt;
    const minInterval = 1000 / this.opts.maxFps - 1.5;
    if (dt < minInterval) {
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    this.lastFrameAt = now;
    this.adaptQuality(dt);
    // Clamp the easing step so a stalled frame never jumps a transition, but
    // keep it generous enough that slow (software / low-end) GPUs still ease
    // in wall-clock time rather than in slow motion.
    this.smooth(Math.min(dt, 250) / 1000);
    this.advancePoke(now);
    this.ageWipe(now);
    // Wrap the shader clock hourly: float32 loses sub-pixel precision in the
    // particle math once uTime reaches the tens of thousands, and a once-an-hour
    // re-seed of drops and twinkles is imperceptible.
    this.draw(((now - this.startAt) / 1000) % 3600);
    this.raf = requestAnimationFrame(this.frame);
  };

  private renderOnce() {
    if (!this.gl || !this.hasScene) return;
    this.draw(STILL_FRAME_SEC);
  }

  /** Age the running poke, and retire it once the shader has nothing left to draw. */
  private advancePoke(now: number) {
    if (!this.pokeAt) return;
    const age = (now - this.pokeAt) / 1000;
    if (age > this.pokeLife) {
      this.pokeAt = 0;
      this.pokeAge = -1;
    } else {
      this.pokeAge = age;
    }
  }

  /**
   * Walk the ring oldest → newest, packing the live corners for the shader as
   * (x, y, life 0..1, joined) and dropping the ones the mist has closed over.
   * They expire in the order they were made, so the dead ones are always a
   * prefix and the ring only ever has to move its start.
   */
  private ageWipe(now: number) {
    let live = 0;
    let dropped = 0;
    for (let i = 0; i < this.wipeCount; i++) {
      const slot = (this.wipeStart + i) % WIPE_MAX_POINTS;
      const life = (now - this.wipeAt[slot]) / 1000 / WIPE_LIFE_SEC;
      if (life >= 1) {
        dropped++;
        continue;
      }
      this.wipeData[live * 4] = this.wipeXY[slot * 2];
      this.wipeData[live * 4 + 1] = this.wipeXY[slot * 2 + 1];
      this.wipeData[live * 4 + 2] = life;
      // One float carries both: the magnitude is what the hand had, and the
      // sign says whether this corner continues the one before it or opens a
      // stroke of its own. A charge is never zero (WIPE_SPENT is its floor), so
      // the sign is always readable.
      this.wipeData[live * 4 + 3] = this.wipeJoin[slot]
        ? this.wipeCharge[slot]
        : -this.wipeCharge[slot];
      const x = this.wipeXY[slot * 2];
      const y = this.wipeXY[slot * 2 + 1];
      if (live === 0) {
        this.wipeBox[0] = this.wipeBox[2] = x;
        this.wipeBox[1] = this.wipeBox[3] = y;
      } else {
        if (x < this.wipeBox[0]) this.wipeBox[0] = x;
        if (y < this.wipeBox[1]) this.wipeBox[1] = y;
        if (x > this.wipeBox[2]) this.wipeBox[2] = x;
        if (y > this.wipeBox[3]) this.wipeBox[3] = y;
      }
      live++;
    }
    this.wipeStart = (this.wipeStart + dropped) % WIPE_MAX_POINTS;
    this.wipeCount -= dropped;
    this.wipeLive = live;
  }

  /**
   * Open a stroke at (x, y): an anchor that joins nothing, and a head on top of
   * it. Two coincident corners are a degenerate segment, which is how a tap
   * comes out as a single round patch.
   */
  private beginWipeStroke(x: number, y: number, at: number) {
    const charge = rub(this.hand, 0, at);
    this.pushWipe(x, y, at, 0, charge);
    this.pushWipe(x, y, at, 1, charge);
    this.wipeStroke = true;
    this.wipeRun = 0;
  }

  /** Add one corner, overwriting the oldest once the ring is full. */
  private pushWipe(x: number, y: number, at: number, join: 0 | 1, charge: number) {
    const slot = (this.wipeStart + this.wipeCount) % WIPE_MAX_POINTS;
    this.wipeXY[slot * 2] = x;
    this.wipeXY[slot * 2 + 1] = y;
    this.wipeAt[slot] = at;
    this.wipeJoin[slot] = join;
    this.wipeCharge[slot] = charge;
    if (this.wipeCount < WIPE_MAX_POINTS) this.wipeCount++;
    else this.wipeStart = (this.wipeStart + 1) % WIPE_MAX_POINTS;
  }

  /** Snap a vec2 uniform (and companions) when a new scene jumped its target. */
  private snapIfJumped(
    name: string,
    from: Float32Array,
    threshold: number,
    companions: string[] = []
  ) {
    const offset = OFFSET[name];
    const dx = this.target[offset] - from[offset];
    const dy = this.target[offset + 1] - from[offset + 1];
    if (Math.hypot(dx, dy) > threshold) {
      this.snap(name);
      for (const c of companions) this.snap(c);
    }
  }

  private snap(name: string) {
    const i = UNIFORMS.findIndex((u) => u.name === name);
    const { offset, size } = META[i];
    for (let k = 0; k < size; k++) this.current[offset + k] = this.target[offset + k];
  }

  private smooth(dtSec: number) {
    for (let t = 0; t < TAUS.length; t++) {
      const tau =
        t === THEME_TAU_INDEX && this.themeTau !== null ? this.themeTau : TAUS[t];
      this.ks[t] = tau <= 0 ? 1 : 1 - Math.exp(-dtSec / tau);
    }
    for (const m of META) {
      const k = this.ks[m.tauIndex];
      for (let j = 0; j < m.size; j++) {
        const idx = m.offset + j;
        this.current[idx] += (this.target[idx] - this.current[idx]) * k;
      }
    }
    this.advanceGust(dtSec);
    // Advect drift from the smoothed wind so direction changes glide. Both
    // drifts are travels, positive to the right, like the wind that feeds them.
    const windX = this.current[WIND_OFFSET];
    const cloudSpeed = this.current[CLOUD_SPEED_OFFSET];
    const dir = Math.tanh(windX * 6);
    this.cloudDrift += dtSec * cloudSpeed * (0.35 + 0.65 * Math.abs(windX)) * (dir === 0 ? 0.35 : dir);
    // --- Where the weather falls (see the section of that name) -----------
    //
    // One air, two fields, and the only difference between them is how quickly
    // each can be re-aimed. Nothing is added to the air: a constant here would
    // be a wind that always blows one way, which adds to a wind going with it
    // and eats one going against — the flakes leant twice as far right as left
    // at the same wind, and at a light enough one they leant the opposite way
    // to the rain. The flakes have their own wander (the waft and the slow
    // beat in `snow()`), so they never fall dead straight without it.
    // The rain eases toward where it is going.
    const kr = 1 - Math.exp(-dtSec / RAIN_FALL_TAU);
    this.aimRain(this.current, this.gust);
    this.rainDir[0] += (this.fallAt[0] - this.rainDir[0]) * kr;
    this.rainDir[1] += (this.fallAt[1] - this.rainDir[1]) * kr;
    // The snow's spring, integrated implicitly: the denominator is (1 + ω·dt)²,
    // so no length of stalled frame can make it ring or blow up.
    const w = SNOW_FALL_OMEGA;
    const denom = 1 + 2 * w * dtSec + w * w * dtSec * dtSec;
    this.aimSnow(this.current, this.gust);
    for (let i = 0; i < 2; i++) {
      const pull = w * w * (this.fallAt[i] - this.snowDir[i]);
      this.snowDirVel[i] = (this.snowDirVel[i] + dtSec * pull) / denom;
      this.snowDir[i] += dtSec * this.snowDirVel[i];
    }
    // And this frame's worth of travel along each. A leaning fall is a longer
    // one — that is the hypotenuse, and it is why a gust quickens the rain as
    // well as leaning it.
    const rainSpeed = Math.hypot(this.rainDir[0], this.rainDir[1]);
    this.rainFall = (this.rainFall + dtSec * rainSpeed) % FALL_WRAP_SEC;
    this.snowFall[0] += dtSec * this.snowDir[0];
    this.snowFall[1] += dtSec * this.snowDir[1];
    const travelled = Math.hypot(this.snowFall[0], this.snowFall[1]);
    if (travelled > FALL_WRAP_SEC) {
      this.snowFall[0] -= (this.snowFall[0] / travelled) * FALL_WRAP_SEC;
      this.snowFall[1] -= (this.snowFall[1] / travelled) * FALL_WRAP_SEC;
    }
  }

  /**
   * Where the rain is aimed, and where the snow is, into `fallAt`. Written
   * once each and called from both the eased path and the snap: a lean that
   * lived in two places would let the first frame of a scene, and every
   * reduced-motion still, drift from every frame after it.
   *
   * `src` is a packed-uniform array — `current` while easing, `target` when
   * snapping — and `gust` is what a hand has raised, which a snap has none of.
   */
  private aimRain(src: Float32Array, gust: number) {
    // 1, because the rain's own fall speed is the shader's business: it varies
    // per depth layer and never leaves the loop that uses it.
    this.fallFor(1, (src[WIND_OFFSET] + gust) * RAIN_LEAN);
  }

  private aimSnow(src: Float32Array, gust: number) {
    // The snow's does leave: heavier snow falls faster, so the fall gets
    // longer while the sideways travel does not — sideways is the air's speed
    // times the time, whatever the flake is doing vertically. Which is why the
    // snow's lean goes shallower as the snow gets heavier, and why it takes no
    // division to arrange.
    this.fallFor(snowFallRate(src[SNOW_OFFSET]), (src[WIND_OFFSET] + gust) * SNOW_LEAN);
  }

  /**
   * Where the mist carries a cleared patch over the whole of one point's life,
   * into `wipeBlow`.
   *
   * By the same door as the rain and the snow, and for the same reason: the
   * wind laid ACROSS gravity and the settle ALONG it, so a tilted phone leans
   * the drift exactly as it leans the weather, and an upright calm sky is the
   * plain (0, −settle) it was before there was a gyroscope to ask.
   *
   * The gust is in the sum because it is wind, and the wipe has no business
   * knowing which wind is which — though on a fog day there is never one to
   * add: the stir listener is armed on precipitation, and a fog scene has none.
   */
  private aimWipe() {
    const across =
      (this.current[WIND_OFFSET] + this.gust) * WIPE_BLOW_WIND + WIPE_BLOW_STILL;
    // Through `fallFor`, so there is still only one place that knows how a lean
    // is laid on gravity. `fallAt` is per-frame scratch, and `smooth()` has
    // already taken its copies into `rainDir` / `snowDir` before `draw()` runs.
    this.fallFor(WIPE_SETTLE, across);
    this.wipeBlow.set(this.fallAt);
  }

  /**
   * Where a fall is going, into `fallAt`:
   *
   *     fall = g · along  +  perp(g) · across
   *
   * — the wind laid ACROSS gravity rather than across the page (see "Where the
   * weather falls"). Upright and calm this is exactly (0, −along), which is
   * what it was before there was a gyroscope to ask.
   */
  private fallFor(along: number, across: number) {
    const gx = this.gravity[0];
    const gy = this.gravity[1];
    this.fallAt[0] = gx * along - gy * across;
    this.fallAt[1] = gy * along + gx * across;
  }

  /**
   * The still frame, whole: every uniform where it is aimed, both falls at
   * rest, painted once. Reduced motion has no next frame to arrive in, so
   * anything that would have eased has to be there already.
   *
   * It is one method because it was three, written out at each call site — and
   * one of the three had already lost the fall: a scene arriving under reduced
   * motion repainted with the PREVIOUS wind's lean, which on the ordinary path
   * (a placeholder forecast, then the real one) meant the still sky kept the
   * placeholder's lean for the life of the page.
   */
  private settle() {
    this.current.set(this.target);
    this.snapFall();
    this.renderOnce();
  }

  /**
   * Put both fields at the lean the forecast is asking for, at rest, with the
   * travel the still frame's clock used to read. Also the first scene's
   * "arrive settled", which is a different thing from a still frame.
   */
  private snapFall() {
    this.aimRain(this.target, 0);
    this.rainDir.set(this.fallAt);
    this.aimSnow(this.target, 0);
    this.snowDir.set(this.fallAt);
    this.snowDirVel[0] = 0;
    this.snowDirVel[1] = 0;
    // That clock's worth of travelling, along where it is going: a still frame
    // of a tilted sky is a still frame of tilted weather.
    this.rainFall = STILL_FRAME_SEC * Math.hypot(this.rainDir[0], this.rainDir[1]);
    this.snowFall[0] = STILL_FRAME_SEC * this.snowDir[0];
    this.snowFall[1] = STILL_FRAME_SEC * this.snowDir[1];
  }

  /**
   * One step of the gust (see "Stirring up a gust").
   *
   * The hand's stir decays on its own, so a finger that stops moving stops
   * making wind without anyone having to say so — which is also why letting go
   * needs no announcement. The gust then chases whatever is left, quickly while
   * a hand is still stirring and slowly once the air is its own again.
   */
  private advanceGust(dtSec: number) {
    // A stir is worth only what it is fresh — and freshness is measured from
    // when the hand actually went past, never from the last frame. Decaying it
    // by a frame's worth would quietly dock every gesture by however long the
    // GPU took, which on a slow one is most of it.
    const stale = (performance.now() - this.stirAt) / 1000;
    const stir = this.stir * Math.exp(-stale / GUST.stirTau);
    // Rising or falling, not stirring-or-not: the gust takes the fast constant
    // whenever it is being asked for MORE wind than it has — including a hand
    // that reverses and whips it the other way — and the slow one whenever it
    // is being asked for less, whether that is because the hand eased off or
    // because it let go. So it always arrives at once and always passes slowly.
    const rising = Math.abs(stir) > Math.abs(this.gust);
    const tau = rising ? GUST.attack : GUST.release;
    this.gust += (stir - this.gust) * (1 - Math.exp(-dtSec / tau));
    if (Math.abs(this.gust) < 1e-3 && Math.abs(stir) < 1e-3) this.gust = 0;
  }

  /**
   * A fall direction, as a unit vector — which is the shader's whole contract
   * for it, so the one degenerate case is answered here rather than per pixel.
   * It is reachable: a direction eased from one aim to its opposite passes
   * through zero on the way, which a 180-degree flip of gravity is.
   */
  private sendAim(
    gl: WebGL2RenderingContext,
    loc: WebGLUniformLocation | null,
    dir: Float32Array
  ) {
    const len = Math.hypot(dir[0], dir[1]);
    if (len < 1e-4) gl.uniform2f(loc, 0, -1);
    else gl.uniform2f(loc, dir[0] / len, dir[1] / len);
  }

  private draw(timeSec: number) {
    const gl = this.gl;
    if (!gl || !this.program) return;
    this.lastTimeSec = timeSec;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.uniform2f(this.locResolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.locTime, timeSec);
    gl.uniform1f(this.locSeed, this.seed);
    gl.uniform1f(this.locCloudDrift, this.cloudDrift);
    // Where each field is going, as a direction: the travels above carry the
    // speed, so the shader only ever needs the aim.
    this.sendAim(gl, this.locRainDown, this.rainDir);
    gl.uniform1f(this.locRainFall, this.rainFall);
    this.sendAim(gl, this.locSnowDown, this.snowDir);
    gl.uniform2f(this.locSnowFall, this.snowFall[0], this.snowFall[1]);
    gl.uniform2f(this.locPoke, this.pokeX, this.pokeY);
    gl.uniform1f(this.locPokeAge, this.pokeAge);
    gl.uniform1f(this.locPokeSeed, this.pokeSeed);
    gl.uniform1f(this.locPokeKind, this.pokeKind);
    gl.uniform1i(this.locWipeCount, this.wipeLive);
    // Only when there is a swath to draw: the shader ignores the array
    // otherwise, and uploading it every frame of every sky would be for nothing.
    if (this.wipeLive > 0) {
      // Only the live corners: the shader never reads past `uWipeCount`, and
      // the ring is sized for the longest stroke rather than the usual one.
      gl.uniform4fv(this.locWipe, this.wipeData, 0, this.wipeLive * 4);
      gl.uniform4f(
        this.locWipeBox,
        this.wipeBox[0],
        this.wipeBox[1],
        this.wipeBox[2],
        this.wipeBox[3]
      );
      // Resolved here because the shader has no wind of its own to read: each
      // falling thing carries its own aim, and so does this.
      this.aimWipe();
      gl.uniform2f(this.locWipeBlow, this.wipeBlow[0], this.wipeBlow[1]);
    }
    // How long a frame is taking, smoothed — the same number adaptQuality()
    // steers the resolution by. Anything that moves fast enough to leave gaps
    // between frames needs to know it (see the meteor's wake in shader.ts).
    gl.uniform1f(this.locFrameSec, this.frameEma / 1000);

    const c = this.current;
    for (let i = 0; i < META.length; i++) {
      const { offset, size } = META[i];
      const loc = this.locs[i];
      if (size === 1) gl.uniform1f(loc, c[offset]);
      else if (size === 2) gl.uniform2f(loc, c[offset], c[offset + 1]);
      else gl.uniform3f(loc, c[offset], c[offset + 1], c[offset + 2]);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!this.firstFrameDone) {
      this.firstFrameDone = true;
      this.opts.onFirstFrame?.();
    }
  }
}
