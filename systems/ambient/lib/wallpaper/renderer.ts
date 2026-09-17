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
//
// Zero React inside — the component just hands it a canvas and scenes.
// =============================================================================

import type { WeatherScene } from "../scene";
import { STRIKE_MS } from "../strike";
import {
  FIELD_FRAGMENT,
  FIELD_ROWS,
  FIELD_VERTEX,
  HAND_MAX,
  HAND_RADIUS,
  VELOCITY_MAX,
} from "./field";
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
  { name: "uVeilColor", size: 3, tau: 0.5 },
  { name: "uVeilAmount", size: 1, tau: 0.5 },
  { name: "uExposure", size: 1, tau: 0.5 },
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
const WIND_OFFSET = OFFSET.uWind;
const CLOUD_SPEED_OFFSET = OFFSET.uCloudSpeed;

/** A fixed, pleasant moment on the shader clock for a still frame. */
const STILL_FRAME_SEC = 37;

const SNOW_TAU = [1.4, 2.1, 3.0, 4.2, 5.6];

/**
 * How the air itself behaves, in `field.ts`. Everything a hand does happens in
 * here now: the scalar gust is gone, and so is the falloff that stood in for a
 * shape it never had.
 */
const AIR = {
  /** How long a stirred sky takes to come back to the forecast's own wind. */
  settle: 2.6,
  /** A raindrop's and a flake's drag, per cell rather than per layer. */
  rainTau: 0.22,
  snowTau: 4.5,
  /**
   * How quickly the air at the middle of a stroke is brought up to the hand's
   * speed. A tenth of a second to most of the way, which is about how long a
   * finger is over any one patch of sky.
   *
   * What bounds the strength is not this but HAND_MAX, and what bounds THAT is
   * the drawing rather than the air. The rain's lean is a shear of where the
   * field is sampled, so a steep gradient across a gust stretches the streaks
   * as well as turning them — past a point they stop reading as drops and
   * start reading as brushwork.
   */
  grip: 14,
  /** How long a stroke keeps pushing once the hand has stopped sending moves. */
  strokeTau: 0.09,
} as const;

/**
 * How far back a flake's sideways place is carried from the wind it is in.
 *
 * Rain shows its velocity directly — the lean IS the velocity over the fall —
 * but a flake is *placed*, and a place is an integral. The steady part of that
 * integral is accumulated in JS per layer (`snowDrift`), because the forecast's
 * wind is the same everywhere; the field's local departure from it is turned
 * into a place by multiplying by this, which is the offset a flake would have
 * built up had it been in that local wind for this long.
 */
const SNOW_MEMORY = 0.5;

/** How long a clicked strike lives — the shader's envelope is spent by then. */
const STRIKE_SEC = STRIKE_MS / 1000;

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
  out[37] = veil.color[0]; out[38] = veil.color[1]; out[39] = veil.color[2];
  out[40] = veil.amount;
  out[41] = scene.exposure;
}
if (FLOAT_COUNT !== 42) throw new Error("packScene is out of step with UNIFORMS");

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
  private locSnowDrift: WebGLUniformLocation | null = null;
  private locSnowMemory: WebGLUniformLocation | null = null;
  private locAirField: WebGLUniformLocation | null = null;
  private locSnowField: WebGLUniformLocation | null = null;
  private locFieldAspect: WebGLUniformLocation | null = null;
  private locFieldRange: WebGLUniformLocation | null = null;
  private locStrike: WebGLUniformLocation | null = null;
  private locStrikeAge: WebGLUniformLocation | null = null;
  private locStrikeSeed: WebGLUniformLocation | null = null;
  /** Per-frame easing factors, one per distinct tau. */
  private ks = new Float64Array(TAUS.length);
  private vao: WebGLVertexArrayObject | null = null;

  private target = new Float32Array(FLOAT_COUNT);
  private current = new Float32Array(FLOAT_COUNT);
  private hasScene = false;
  private seed = 0;

  private running = false;
  private raf = 0;
  private lastFrameAt = 0;
  private startAt = 0;
  private cloudDrift = 0;

  /**
   * The flakes' sideways travel from the forecast's own wind, per layer. The
   * field carries everything local; this carries only the part that is the same
   * everywhere, because a place is an integral and a byte cannot hold one.
   */
  private snowWind = new Float32Array(SNOW_TAU.length);
  private snowDrift = new Float32Array(SNOW_TAU.length);

  /** The hand's stroke: where it is (field uv), and the push it is pouring in. */
  private hand = new Float32Array(4);
  private handAt = 0;

  // The field itself: two targets ping-ponged, each carrying the air and one
  // lagged copy of it. `air` holds rg = air, ba = what a raindrop has; `snow`
  // holds rg = what a flake has.
  private fieldProgram: WebGLProgram | null = null;
  private fieldAir: (WebGLTexture | null)[] = [null, null];
  private fieldSnow: (WebGLTexture | null)[] = [null, null];
  private fieldFbo: (WebGLFramebuffer | null)[] = [null, null];
  private fieldLocs: Record<string, WebGLUniformLocation | null> = {};
  private fieldW = 0;
  private fieldH = 0;
  /** Which of the pair was written last, and so is the one to read. */
  private fieldRead = 0;

  /** The clicked strike. `strikeAt` of 0 means none is running. */
  private strikeAt = 0;
  private strikeX = 0.5;
  private strikeY = 0.5;
  private strikeSeed = 0;
  private strikeAge = -1;

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
      // Start every layer already at the scene's wind. Easing up from nothing
      // would mean the first seconds of a page had the sky falling as if it
      // were calm while the forecast said otherwise — and for the slowest snow
      // layer that is most of a minute.
      this.settleToWind(this.target[WIND_OFFSET]);
      this.seedField(this.target[WIND_OFFSET]);
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
      this.current.set(this.target);
      this.renderOnce();
    } else if (!this.running) {
      this.start();
    }
  }

  /**
   * Fire one bolt at (x, y) in screen space — 0..1 across, 0..1 bottom → top,
   * the same convention as the sun. The thunder-day easter egg; see
   * ../strike.ts.
   *
   * Only while the frame loop is already running: a strike is an animation, and
   * a stopped renderer is either inactive or under `prefers-reduced-motion`,
   * where a flash is the one thing not to make.
   */
  strike(x: number, y: number) {
    if (!this.running || this.destroyed || !this.gl) return;
    this.strikeX = x;
    this.strikeY = y;
    this.strikeSeed = Math.random() * 97;
    this.strikeAt = performance.now();
    this.strikeAge = 0;
  }

  /**
   * A hand went past `(xPx, yPx)` at `vxPx` CSS pixels per second, left to right.
   *
   * Both axes of it. There is a field to put them in now, and a stroke that
   * turns is what leaves a curl behind — which is the whole of why a circle
   * drawn on the sky keeps turning after the hand is gone.
   *
   * Nothing downstream of here is a decision any more. The push is poured into
   * the field at that point, and what the sky does with it — where it travels,
   * how it curls, how long it lasts, which particles have taken it up — is the
   * field's to work out (`field.ts`).
   */
  stirWind(vxPx: number, vyPx: number, xPx: number, yPx: number) {
    const h = Math.max(1, this.cssHeight);
    const w = Math.max(1, this.cssWidth);
    // Field uv, which is the screen's uv: the grid covers exactly the canvas.
    this.hand[0] = xPx / w;
    this.hand[1] = 1 - yPx / h;
    // Momentum per second, not a velocity to be taken on. A hand pushes air for
    // as long as it is moving, so a long slow stroke does as much as a short
    // hard one — which is the difference between stirring and setting a dial.
    // Screen y is up, and a client's is down, so the second one turns over.
    this.hand[2] = HAND_MAX * Math.tanh(vxPx / h / HAND_MAX);
    this.hand[3] = HAND_MAX * Math.tanh(-vyPx / h / HAND_MAX);
    this.handAt = performance.now();
  }

  setReducedMotion(reduced: boolean) {
    if (this.opts.reducedMotion === reduced) return;
    this.opts.reducedMotion = reduced;
    if (reduced) {
      this.stop();
      // Nothing will step the field again; wipe the hand and put the snow
      // straight onto the steady wind rather than freezing a half-gust in.
      this.hand.fill(0);
      this.settleToWind(this.target[WIND_OFFSET]);
      this.seedField(this.target[WIND_OFFSET]);
      this.current.set(this.target);
      this.renderOnce();
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
    // A strike is measured in wall-clock time; a paused renderer would resume
    // it hours later, mid-flash.
    this.strikeAt = 0;
    this.strikeAge = -1;
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
      if (this.fieldProgram) gl.deleteProgram(this.fieldProgram);
      this.releaseField(gl);
      if (this.vao) gl.deleteVertexArray(this.vao);
      // Deliberately *not* WEBGL_lose_context.loseContext(): a canvas hands
      // back the same context object on every getContext(), so losing it here
      // would poison the next renderer mounted on this canvas (React strict
      // mode remounts, fast refresh). The context goes away with the element.
    }
    this.gl = null;
    this.program = null;
    this.fieldProgram = null;
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
    this.locSnowDrift = gl.getUniformLocation(program, "uSnowDrift[0]");
    this.locSnowMemory = gl.getUniformLocation(program, "uSnowMemory");
    this.locAirField = gl.getUniformLocation(program, "uAirField");
    this.locSnowField = gl.getUniformLocation(program, "uSnowField");
    this.locFieldAspect = gl.getUniformLocation(program, "uFieldAspect");
    this.locFieldRange = gl.getUniformLocation(program, "uFieldRange");
    this.locStrike = gl.getUniformLocation(program, "uStrike");
    this.locStrikeAge = gl.getUniformLocation(program, "uStrikeAge");
    this.locStrikeSeed = gl.getUniformLocation(program, "uStrikeSeed");
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    if (!this.initField(gl)) return false;
    gl.useProgram(program);
    return true;
  }

  // ---------------------------------------------------------------------------
  // The wind field
  // ---------------------------------------------------------------------------

  /**
   * Build the grid: two targets, ping-ponged, each with two colour attachments
   * so one pass writes the air and both lagged copies of it together.
   *
   * RGBA8 and LINEAR, both of which every WebGL2 context can render to and
   * filter — the float formats and their filtering are extensions that phones
   * do not all have, and advection is nothing without bilinear sampling.
   */
  private initField(gl: WebGL2RenderingContext): boolean {
    const program = this.compile(gl, FIELD_VERTEX, FIELD_FRAGMENT);
    if (!program) return false;
    this.fieldProgram = program;
    for (const name of [
      "uAir", "uSnow", "uTexel", "uAspect", "uDt", "uVMax", "uAmbient",
      "uSettle", "uRainTau", "uSnowTau", "uHandAt", "uHandVel",
      "uHandRadius", "uHandGrip", "uDither", "uStep", "uRoll",
    ]) {
      this.fieldLocs[name] = gl.getUniformLocation(program, name);
    }
    return this.sizeField(gl);
  }

  /** (Re)allocate the grid for the current aspect, keeping its cells square. */
  private sizeField(gl: WebGL2RenderingContext): boolean {
    const aspect = Math.max(0.2, this.cssWidth / Math.max(1, this.cssHeight));
    const w = Math.min(256, Math.max(24, Math.round(FIELD_ROWS * aspect)));
    if (w === this.fieldW && this.fieldH === FIELD_ROWS && this.fieldFbo[0]) return true;
    this.fieldW = w;
    this.fieldH = FIELD_ROWS;

    const make = () => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, FIELD_ROWS, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      // Clamped, so air traced back from outside takes the edge's own value —
      // a gust leaves the frame and is gone rather than bouncing off glass.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tex;
    };
    this.releaseField(gl);
    for (let i = 0; i < 2; i++) {
      this.fieldAir[i] = make();
      this.fieldSnow[i] = make();
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fieldAir[i], 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.fieldSnow[i], 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return false;
      }
      this.fieldFbo[i] = fbo;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.seedField(this.hasScene ? this.current[WIND_OFFSET] : 0);
    return true;
  }

  private releaseField(gl: WebGL2RenderingContext) {
    for (let i = 0; i < 2; i++) {
      if (this.fieldAir[i]) gl.deleteTexture(this.fieldAir[i]);
      if (this.fieldSnow[i]) gl.deleteTexture(this.fieldSnow[i]);
      if (this.fieldFbo[i]) gl.deleteFramebuffer(this.fieldFbo[i]);
      this.fieldAir[i] = null;
      this.fieldSnow[i] = null;
      this.fieldFbo[i] = null;
    }
  }

  /** Fill the whole grid with one wind, so a fresh field is already the forecast. */
  private seedField(windX: number) {
    const gl = this.gl;
    if (!gl || !this.fieldFbo[0]) return;
    const c = Math.round((windX / (2 * VELOCITY_MAX) + 0.5) * 255) / 255;
    for (let i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fieldFbo[i]);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      gl.clearColor(c, 0.5, c, 0.5);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * One step of the air. Runs before the sky is drawn, at the grid's size, and
   * writes the pair that the sky then reads.
   */
  private stepField(dtSec: number) {
    const gl = this.gl;
    const program = this.fieldProgram;
    if (!gl || !program || !this.fieldFbo[0]) return;
    const write = 1 - this.fieldRead;
    const u = this.fieldLocs;

    // A stroke keeps pushing for a breath after the last move arrives, so a
    // hand between two events does not flicker the air on and off.
    const stale = (performance.now() - this.handAt) / 1000;
    const alive = Math.exp(-stale / AIR.strokeTau);
    const strength = Math.hypot(this.hand[2], this.hand[3]) * alive;
    const push = strength > 0.02 ? alive : 0;

    gl.useProgram(program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fieldFbo[write]);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, this.fieldW, this.fieldH);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fieldAir[this.fieldRead]);
    gl.uniform1i(u.uAir, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.fieldSnow[this.fieldRead]);
    gl.uniform1i(u.uSnow, 1);

    gl.uniform2f(u.uTexel, 1 / this.fieldW, 1 / this.fieldH);
    gl.uniform1f(u.uAspect, this.fieldW / this.fieldH);
    gl.uniform1f(u.uDt, Math.min(dtSec, 0.05));
    gl.uniform1f(u.uVMax, VELOCITY_MAX);
    // The dither, and the number that makes it noise in TIME as well as space.
    // One byte expressed as a velocity goes with it, for the snap to rest.
    gl.uniform1f(u.uDither, 1 / 255);
    gl.uniform1f(u.uRoll, Math.random() * 64);
    gl.uniform1f(u.uStep, (2 * VELOCITY_MAX) / 255);
    gl.uniform2f(u.uAmbient, this.current[WIND_OFFSET], 0);
    gl.uniform1f(u.uSettle, AIR.settle);
    gl.uniform1f(u.uRainTau, AIR.rainTau);
    gl.uniform1f(u.uSnowTau, AIR.snowTau);
    gl.uniform2f(u.uHandAt, this.hand[0], this.hand[1]);
    gl.uniform2f(u.uHandVel, this.hand[2], this.hand[3]);
    gl.uniform1f(u.uHandGrip, AIR.grip * push);
    gl.uniform1f(u.uHandRadius, push > 0 ? HAND_RADIUS : 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.fieldRead = write;
  }

  private compile(
    gl: WebGL2RenderingContext,
    vertexSrc = VERTEX_SHADER,
    fragmentSrc = FRAGMENT_SHADER
  ): WebGLProgram | null {
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
    const vs = make(gl.VERTEX_SHADER, vertexSrc);
    const fs = make(gl.FRAGMENT_SHADER, fragmentSrc);
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
    if (this.gl && this.fieldProgram) this.sizeField(this.gl);
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
    const step = Math.min(dt, 250) / 1000;
    this.smooth(step);
    this.stepField(step);
    this.advanceStrike(now);
    // Wrap the shader clock hourly: float32 loses sub-pixel precision in the
    // particle math once uTime reaches the tens of thousands, and a once-an-hour
    // re-seed of drops and twinkles is imperceptible.
    this.draw(((now - this.startAt) / 1000) % 3600);
    this.raf = requestAnimationFrame(this.frame);
  };

  private renderOnce() {
    if (!this.gl || !this.hasScene) return;
    this.seedField(this.current[WIND_OFFSET]);
    this.draw(STILL_FRAME_SEC);
  }

  /** Age the running strike, and retire it once the shader has nothing left to draw. */
  private advanceStrike(now: number) {
    if (!this.strikeAt) return;
    const age = (now - this.strikeAt) / 1000;
    if (age > STRIKE_SEC) {
      this.strikeAt = 0;
      this.strikeAge = -1;
    } else {
      this.strikeAge = age;
    }
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
      this.ks[t] = TAUS[t] <= 0 ? 1 : 1 - Math.exp(-dtSec / TAUS[t]);
    }
    for (const m of META) {
      const k = this.ks[m.tauIndex];
      for (let j = 0; j < m.size; j++) {
        const idx = m.offset + j;
        this.current[idx] += (this.target[idx] - this.current[idx]) * k;
      }
    }
    // Advect drift from the smoothed wind so direction changes glide. Both
    // drifts are travels, positive to the right, like the wind that feeds them.
    const windX = this.current[WIND_OFFSET];
    const cloudSpeed = this.current[CLOUD_SPEED_OFFSET];
    const dir = Math.tanh(windX * 6);
    this.cloudDrift += dtSec * cloudSpeed * (0.35 + 0.65 * Math.abs(windX)) * (dir === 0 ? 0.35 : dir);

    // The flakes' travel from the forecast's wind, per layer and at each
    // layer's own drag. Everything the hand does is in the field instead — and
    // nothing is added here: a constant would be a wind that always blows one
    // way, which adds to a wind going with it and eats one going against.
    for (let i = 0; i < SNOW_TAU.length; i++) {
      this.snowWind[i] += (windX - this.snowWind[i]) * (1 - Math.exp(-dtSec / SNOW_TAU[i]));
      this.snowDrift[i] += dtSec * this.snowWind[i] * 0.6;
    }
  }

  /** Put every snow layer straight onto one wind, with no transient at all. */
  private settleToWind(windX: number) {
    for (let i = 0; i < SNOW_TAU.length; i++) this.snowWind[i] = windX;
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
    gl.uniform1fv(this.locSnowDrift, this.snowDrift);
    gl.uniform1f(this.locSnowMemory, SNOW_MEMORY);
    gl.uniform1f(this.locFieldAspect, this.cssWidth / Math.max(1, this.cssHeight));
    gl.uniform1f(this.locFieldRange, VELOCITY_MAX);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fieldAir[this.fieldRead]);
    gl.uniform1i(this.locAirField, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.fieldSnow[this.fieldRead]);
    gl.uniform1i(this.locSnowField, 1);
    gl.uniform2f(this.locStrike, this.strikeX, this.strikeY);
    gl.uniform1f(this.locStrikeAge, this.strikeAge);
    gl.uniform1f(this.locStrikeSeed, this.strikeSeed);

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
