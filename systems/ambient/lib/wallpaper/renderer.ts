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
   * The gust's rise while a hand is stirring. Short: a squall front slams the
   * rain over, it does not lean it politely. The rain's lean shears the curtain
   * about mid-screen, so the edges sweep sideways at `0.5 × 0.75 × max ÷
   * attack` heights a second — a little over its own fall speed, which is the
   * most that still reads as air rather than as a whip.
   */
  attack: 0.13,
  /** … and its fall once the air is left alone: over almost as fast as it came. */
  release: 0.5,
} as const;

/**
 * How long the snow takes to come up to the wind.
 *
 * A raindrop is at the new angle the moment the wind changes — its lean IS the
 * steady state, and at 1.5–2.5 screen heights a second there is no visible
 * transient to model. A flake is the other thing entirely: it falls at a
 * thirtieth of that and takes ten to thirty seconds to cross the frame, so
 * being shoved instantly sideways reads as a card being slid rather than as
 * snow. It is brought round over seconds instead, and keeps going for seconds
 * after the air is still — which is the part that reads as weight.
 *
 * The cloud decks are heavier again, and get nothing from a hand at all: you
 * cannot stir a cloud by waving at it. They answer the forecast only.
 */
const SNOW_WIND_TAU = 3;

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
  private locStirWind: WebGLUniformLocation | null = null;
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
  private snowDrift = 0;
  /** The wind the snow has actually got up to — it lags the air (SNOW_WIND_TAU). */
  private snowWind = 0;

  /** The wind a hand asked for, when it asked, and what the air has got to. */
  private stir = 0;
  private stirAt = 0;
  private gust = 0;

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
      // Start the snow already at the scene's wind. Easing up from nothing
      // would mean the first ten seconds of a page had snow falling as if it
      // were calm while the rain beside it already leant into the forecast.
      this.snowWind = this.target[WIND_OFFSET];
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
   * A hand went past at `vxPx` CSS pixels per second, left to right.
   *
   * Only the horizontal component: wind in this sky is horizontal, and a hand
   * swiped straight down does not make a sideways breeze. What it asks for is a
   * wind; how much of one the air gets up to is `advanceGust`, and how much of
   * THAT the snow gets up to is `SNOW_WIND_TAU`.
   */
  stirWind(vxPx: number) {
    const heights = vxPx / Math.max(1, this.cssHeight);
    this.stir = GUST.max * Math.tanh(heights * GUST.gain);
    this.stirAt = performance.now();
  }

  setReducedMotion(reduced: boolean) {
    if (this.opts.reducedMotion === reduced) return;
    this.opts.reducedMotion = reduced;
    if (reduced) {
      this.stop();
      // Nothing will advance the gust again; don't freeze half of one into the
      // still frame.
      this.stir = 0;
      this.gust = 0;
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
    this.locSnowDrift = gl.getUniformLocation(program, "uSnowDrift");
    this.locStirWind = gl.getUniformLocation(program, "uStirWind");
    this.locStrike = gl.getUniformLocation(program, "uStrike");
    this.locStrikeAge = gl.getUniformLocation(program, "uStrikeAge");
    this.locStrikeSeed = gl.getUniformLocation(program, "uStrikeSeed");
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
    this.advanceStrike(now);
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
    this.advanceGust(dtSec);
    // Advect drift from the smoothed wind so direction changes glide. Both
    // drifts are travels, positive to the right, like the wind that feeds them.
    const windX = this.current[WIND_OFFSET];
    const cloudSpeed = this.current[CLOUD_SPEED_OFFSET];
    const dir = Math.tanh(windX * 6);
    this.cloudDrift += dtSec * cloudSpeed * (0.35 + 0.65 * Math.abs(windX)) * (dir === 0 ? 0.35 : dir);
    // The snow gets the hand's gust too, but only as fast as snow takes wind
    // (see SNOW_WIND_TAU). Nothing is added to it: a constant here would be a
    // wind that always blows one way, which adds to a wind going with it and
    // eats one going against — the flakes leant twice as far right as left at
    // the same wind, and at a light enough one they leant the opposite way to
    // the rain. The flakes have their own wander (the waft and the slow beat in
    // `snow()`), so they never fall dead straight without it.
    const air = windX + this.gust;
    this.snowWind += (air - this.snowWind) * (1 - Math.exp(-dtSec / SNOW_WIND_TAU));
    this.snowDrift += dtSec * this.snowWind * 0.6;
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
    const stirring = Math.abs(stir) > 0.02;
    const tau = stirring ? GUST.attack : GUST.release;
    this.gust += (stir - this.gust) * (1 - Math.exp(-dtSec / tau));
    if (!stirring && Math.abs(this.gust) < 1e-3) this.gust = 0;
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
    gl.uniform1f(this.locSnowDrift, this.snowDrift);
    gl.uniform1f(this.locStirWind, this.gust);
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
