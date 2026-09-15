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
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shader";

interface UniformSpec {
  name: string;
  size: 1 | 2 | 3;
  /** Smoothing time constant in seconds (0 = snap). */
  tau: number;
}

const UNIFORMS: UniformSpec[] = [
  { name: "uSun", size: 2, tau: 1.6 },
  { name: "uSunElevation", size: 1, tau: 1.6 },
  { name: "uDaylight", size: 1, tau: 1.6 },
  { name: "uZenith", size: 3, tau: 1.8 },
  { name: "uHorizon", size: 3, tau: 1.8 },
  { name: "uGlow", size: 3, tau: 1.8 },
  { name: "uGlowStrength", size: 1, tau: 1.8 },
  { name: "uMoon", size: 2, tau: 1.6 },
  { name: "uMoonPhase", size: 1, tau: 0 },
  { name: "uMoonVisible", size: 1, tau: 1.8 },
  { name: "uMoonSize", size: 1, tau: 1.6 },
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

function packScene(scene: WeatherScene, out: Float32Array) {
  const precip = scene.precipitation;
  const rain = precip.type === "rain" ? precip.intensity : 0;
  const snow = precip.type === "snow" ? precip.intensity : 0;

  let i = 0;
  const put = (...v: number[]) => {
    for (const x of v) out[i++] = x;
  };
  put(scene.sun.screen.x, scene.sun.screen.y);
  put(scene.sun.elevation);
  put(scene.sun.daylight);
  put(...scene.sky.zenith);
  put(...scene.sky.horizon);
  put(...scene.sky.glow);
  put(scene.sky.glowStrength);
  put(scene.moon.screen.x, scene.moon.screen.y);
  put(scene.moon.phase);
  put(scene.moon.visible);
  put(scene.moon.size);
  put(scene.hemisphere);
  put(scene.clouds.cover);
  put(scene.clouds.density);
  put(scene.clouds.darkness);
  put(scene.clouds.speed);
  put(...scene.clouds.lit);
  put(...scene.clouds.shade);
  put(rain);
  put(snow);
  put(scene.wind.x, scene.wind.y);
  put(scene.fog);
  put(scene.lightning);
  put(scene.stars);
  put(...scene.veil.color);
  put(scene.veil.amount);
  put(scene.exposure);
}

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
  private locations = new Map<string, WebGLUniformLocation | null>();
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

  private dpr = 1;
  private baseScale = 1;
  private scale = 1;
  private frameEma = 16;
  /** The shader clock of the last frame drawn, so a resize can repaint it. */
  private lastTimeSec = 37;
  private slowFrames = 0;
  private fastFrames = 0;
  private cssWidth = 0;
  private cssHeight = 0;

  private opts: Required<
    Omit<WallpaperRendererOptions, "onFallback" | "onFirstFrame">
  > & {
    onFallback?: (reason: string) => void;
    onFirstFrame?: () => void;
  };
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
    packScene(scene, this.target);
    this.seed = scene.seed;
    if (!this.hasScene) {
      this.current.set(this.target);
      this.hasScene = true;
    }
    // The phase is cyclic; never interpolate it.
    this.snap("uMoonPhase");
    // Easing is for the minute-by-minute drift of a live clock. A jump of the
    // clock (devtool time travel, a refetch after hours asleep) would otherwise
    // fly the sun or moon across the screen in a straight line, which reads as
    // a wrong trajectory — so a large displacement snaps instead.
    this.snapIfFar("uSun", 0.2);
    this.snapIfFar("uMoon", 0.2, ["uMoonVisible"]);
    if (this.opts.reducedMotion) {
      this.current.set(this.target);
      this.renderOnce();
    } else if (!this.running) {
      this.start();
    }
  }

  setReducedMotion(reduced: boolean) {
    if (this.opts.reducedMotion === reduced) return;
    this.opts.reducedMotion = reduced;
    if (reduced) {
      this.stop();
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
    this.locations.clear();
    for (const u of UNIFORMS) {
      this.locations.set(u.name, gl.getUniformLocation(program, u.name));
    }
    for (const name of ["uResolution", "uTime", "uSeed", "uCloudDrift", "uSnowDrift"]) {
      this.locations.set(name, gl.getUniformLocation(program, name));
    }
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
    if (repaint && this.gl && this.hasScene) {
      this.draw(this.opts.reducedMotion ? 37.0 : this.lastTimeSec);
    }
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
    // Wrap the shader clock hourly: float32 loses sub-pixel precision in the
    // particle math once uTime reaches the tens of thousands, and a once-an-hour
    // re-seed of drops and twinkles is imperceptible.
    this.draw(((now - this.startAt) / 1000) % 3600);
    this.raf = requestAnimationFrame(this.frame);
  };

  private renderOnce() {
    if (!this.gl || !this.hasScene) return;
    // A fixed, pleasant moment for the still frame.
    this.draw(37.0);
  }

  /** Snap a vec2 uniform (and companions) when its target moved far. */
  private snapIfFar(name: string, threshold: number, companions: string[] = []) {
    let offset = 0;
    for (const u of UNIFORMS) {
      if (u.name === name) {
        const dx = this.target[offset] - this.current[offset];
        const dy = this.target[offset + 1] - this.current[offset + 1];
        if (Math.hypot(dx, dy) > threshold) {
          this.snap(name);
          for (const c of companions) this.snap(c);
        }
        return;
      }
      offset += u.size;
    }
  }

  private snap(name: string) {
    let offset = 0;
    for (const u of UNIFORMS) {
      if (u.name === name) {
        for (let k = 0; k < u.size; k++) this.current[offset + k] = this.target[offset + k];
        return;
      }
      offset += u.size;
    }
  }

  private smooth(dtSec: number) {
    let offset = 0;
    for (const u of UNIFORMS) {
      const k = u.tau <= 0 ? 1 : 1 - Math.exp(-dtSec / u.tau);
      for (let j = 0; j < u.size; j++) {
        const idx = offset + j;
        this.current[idx] += (this.target[idx] - this.current[idx]) * k;
      }
      offset += u.size;
    }
    // Advect drift from the smoothed wind so direction changes glide.
    const windX = this.read("uWind", 0);
    const cloudSpeed = this.read("uCloudSpeed", 0);
    const dir = Math.tanh(windX * 6);
    this.cloudDrift += dtSec * cloudSpeed * (0.35 + 0.65 * Math.abs(windX)) * (dir === 0 ? 0.35 : dir);
    this.snowDrift += dtSec * (windX * 0.6 + 0.03);
  }

  private read(name: string, component: number): number {
    let offset = 0;
    for (const u of UNIFORMS) {
      if (u.name === name) return this.current[offset + component];
      offset += u.size;
    }
    return 0;
  }

  private draw(timeSec: number) {
    const gl = this.gl;
    if (!gl || !this.program) return;
    this.lastTimeSec = timeSec;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.uniform2f(this.locations.get("uResolution") ?? null, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.locations.get("uTime") ?? null, timeSec);
    gl.uniform1f(this.locations.get("uSeed") ?? null, this.seed);
    gl.uniform1f(this.locations.get("uCloudDrift") ?? null, this.cloudDrift);
    gl.uniform1f(this.locations.get("uSnowDrift") ?? null, this.snowDrift);

    let offset = 0;
    const c = this.current;
    for (const u of UNIFORMS) {
      const loc = this.locations.get(u.name) ?? null;
      if (u.size === 1) gl.uniform1f(loc, c[offset]);
      else if (u.size === 2) gl.uniform2f(loc, c[offset], c[offset + 1]);
      else gl.uniform3f(loc, c[offset], c[offset + 1], c[offset + 2]);
      offset += u.size;
    }

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!this.firstFrameDone) {
      this.firstFrameDone = true;
      this.opts.onFirstFrame?.();
    }
  }
}
