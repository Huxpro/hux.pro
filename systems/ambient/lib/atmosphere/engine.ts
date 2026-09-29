// =============================================================================
// The Atmosphere engine — one clock for a cloud volume and the weather in it.
//
// Two canvases, one simulation. The cloud volume is raymarched on WebGL1 at a
// pixel budget and a capped rate (renderer.ts); rain, snow and the bolt are
// drawn above it at display resolution every frame (details.ts). Both read the
// same eased scene, the same lightning event and the same wind, so a flash
// lights the billows it leaves and a gust leans the rain it falls through.
//
// It answers the site's weather eggs through the same calls the Sky's renderer
// takes, so <WallpaperBackground /> arms them for either engine alike:
//
//   poke(kind, x, y)  a strike or a meteor at a clicked point (lib/poke.ts)
//   stirWind(vx)      a hand across a rainy or snowy sky (wallpaper/stir.ts)
//   setGravity(g)     the phone's tilt (lib/gyroscope.ts)
//   wipe / wipeEnd    a hand across the fog (lib/wipe.ts)
//   getStats()        the devtool's readout
//
// What each answer looks like is this engine's own. The strike's flash is lit
// inside the cloud it leaves; the meteor passes behind real cloud, not over a
// picture of one; the fog wipe opens the volume as well as the mist; and a tilt
// slides the camera, so the nearest billows move most — parallax the Sky, whose
// decks are pictures, cannot have.
// =============================================================================

import { createSkyRenderer, type CloudFrame, type SkyRenderer } from "./renderer";
import { createWeatherDetails, type WeatherDetails } from "./details";
import { lightningAt, NO_LIGHTNING, strikeAt, type LightningFrame } from "./lightning";
import { SNAPPED_KEYS, type SkyScene } from "./scene";
import { POKE_MS, type PokeKind } from "../poke";
import type { GravityVector } from "../gyroscope";
import { GUST, gustStep } from "../wallpaper/stir";
import { freshHand, rub, WIPE_BLOW_STILL, WIPE_BLOW_WIND, WIPE_DECAY, WIPE_JUMP, WIPE_LIFE_MS, WIPE_RADIUS, WIPE_SETTLE, WIPE_TAIL } from "../wipe";

export interface AtmosphereStats {
  width: number;
  height: number;
  /** Cloud backing pixels per CSS pixel. */
  scale: number;
  frameMs: number;
}

export interface AtmosphereEngineOptions {
  /** Cloud pixels per frame at most; the volume is soft, CSS upscales it. */
  pixelBudget: number;
  /** The loop's cap. Only a divisor of the panel's rate is deliverable (see support.ts). */
  maxFps?: number;
  /** The cloud volume's own cap, below `maxFps` — it drifts, it does not dart. */
  cloudFps?: number;
  reducedMotion?: boolean;
  /** Whether the cloud canvas is live WebGL or showing the CSS gradient under it. */
  onRenderer?: (kind: "webgl" | "fallback") => void;
}

/** How long the scene takes to arrive at a new target, seconds (1/e). */
const SCENE_TAU = 1.1;
/** The volume's usual rate: it drifts, it does not dart. Events lift it to the full rate. */
const CLOUD_FPS = 24;
/** The smallest share of its base resolution the volume is allowed to fall to. */
const MIN_SCALE_SHARE = 0.45;
/** Easing of the fall directions toward gravity and wind: rain turns in a blink, snow over a breath. */
const RAIN_TAU = 0.08;
const SNOW_TAU = 0.8;
/** How far the camera slides at a full sideways tilt, deck units; and how fast. */
const CAMERA_REACH = 0.22;
const CAMERA_TAU = 0.6;
/** How much a unit of wind across leans each field: the rain a little, the snow a lot. */
const RAIN_LEAN = 0.33;
const SNOW_LEAN = 1.5;

/** The meteor: the Sky's pace and bounds, in screen heights and seconds (shader.ts). */
const METEOR = { speed: 1.6, minFlight: 0.45, maxFlight: 1.25, train: 0.42, fade: 0.2 } as const;

/** The fog wipe's mask, rows; columns follow the aspect. */
const WIPE_ROWS = 128;
/** A new corner every this many screen heights of path — the mask has no corner limit. */
const WIPE_STEP = 0.012;
const WIPE_POINTS = 384;

interface WipePoint { x: number; y: number; at: number; charge: number; join: boolean }

const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

function cloneScene(scene: SkyScene): SkyScene {
  const out = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(scene)) out[key] = Array.isArray(value) ? value.slice() : value;
  return out as unknown as SkyScene;
}

export class AtmosphereEngine {
  private renderer: SkyRenderer | null = null;
  private details: WeatherDetails | null = null;
  private target: SkyScene | null = null;
  private current: SkyScene | null = null;
  private opts: Required<Omit<AtmosphereEngineOptions, "onRenderer">> & Pick<AtmosphereEngineOptions, "onRenderer">;

  private active = true;
  private paused = false;
  private hidden = false;
  private intersecting = true;
  private destroyed = false;
  private lost = false;
  private raf = 0;
  private last = 0;
  private lastCloud = 0;
  private lastFlash = 0;
  private elapsed = 137;
  private stormTime = 0;
  private stormOn = false;

  private drift: [number, number, number] = [0, 0, 0];
  private camera = 0;
  private cameraTarget = 0;
  /** Down, in CSS px space (y down), as it is and as each field has turned to it. */
  private down: [number, number] = [0, 1];
  private rainDown: [number, number] = [0, 1];
  private snowDown: [number, number] = [0, 1];
  private stir = 0;
  private stirAt = 0;
  private gust = 0;

  private pokeKind: PokeKind | null = null;
  private pokeAt = 0;
  private pokeX = 0.5;
  private pokeY = 0.5;
  private pokeSeed = 0;
  private meteorPath: { x: number; y: number; dx: number; dy: number; flight: number } | null = null;

  private wipePoints: WipePoint[] = [];
  private wipeStroke = false;
  private wipeLastInput = 0;
  private hand = freshHand();
  private wipeMask: HTMLCanvasElement | null = null;
  private wipeCtx: CanvasRenderingContext2D | null = null;

  private width = 0;
  private height = 0;
  private baseScale = 1;
  private scale = 1;
  private failedScale = Infinity;
  private particles = 1;
  private frameEma = 16;
  private slowFrames = 0;
  private fastFrames = 0;
  private rendererKind: "webgl" | "fallback" | null = null;
  private draws = 0;

  private frame: CloudFrame = {
    time: 0, drift: this.drift, camera: 0, lightning: NO_LIGHTNING, flash: 0,
    meteor: [0, 0, 0, 0], meteorGlow: 0, wipe: null, wipeDirty: false,
  };

  private canvas: HTMLCanvasElement;
  private observer: ResizeObserver;
  private intersection: IntersectionObserver;

  constructor(canvas: HTMLCanvasElement, detailCanvas: HTMLCanvasElement, options: AtmosphereEngineOptions) {
    this.canvas = canvas;
    this.opts = { maxFps: 60, cloudFps: CLOUD_FPS, reducedMotion: false, ...options };
    this.details = createWeatherDetails(detailCanvas);
    this.initRenderer();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.intersection = new IntersectionObserver(([entry]) => { this.intersecting = entry.isIntersecting; this.update(); });
    this.intersection.observe(canvas);
    canvas.addEventListener("webglcontextlost", this.onLost);
    canvas.addEventListener("webglcontextrestored", this.onRestored);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.hidden = document.hidden;
    this.resize();
  }

  // --- Public API ------------------------------------------------------------

  setScene(scene: SkyScene) {
    this.target = scene;
    if (!this.current) this.current = cloneScene(scene);
    for (const key of SNAPPED_KEYS) (this.current as unknown as Record<string, number>)[key] = scene[key];
    // A thunder scene that just arrived shows its first stroke soon, not in 13 s.
    const storm = scene.storm > 0.1;
    if (storm && !this.stormOn) this.stormTime = 0;
    this.stormOn = storm;
    this.invalidate();
  }

  setActive(on: boolean) { this.active = on; this.update(); }
  setPaused(on: boolean) { this.paused = on; this.update(); }

  setReducedMotion(on: boolean) {
    if (this.opts.reducedMotion === on) return;
    this.opts.reducedMotion = on;
    // Nothing will advance these again; don't freeze half of one into the still.
    if (on) this.retireEvents();
    this.update();
  }

  /** Change the cloud budget (the picker tile runs on a fraction of the page's). */
  setPixelBudget(budget: number) {
    if (this.opts.pixelBudget === budget) return;
    this.opts.pixelBudget = budget;
    this.failedScale = Infinity;
    this.resize();
  }

  /** Start the storm's clock over, so its first stroke comes now (the studio's replay). */
  replayLightning() { this.stormTime = 0; this.invalidate(); }

  /** A strike or a meteor at (x, y): 0..1 across, 0..1 bottom → top, as the Sky takes it. */
  poke(kind: PokeKind, x: number, y: number) {
    if (!this.moving || !this.running || this.destroyed) return;
    this.pokeKind = kind;
    this.pokeAt = performance.now();
    this.pokeX = clamp(x); this.pokeY = clamp(1 - y);
    this.pokeSeed = Math.floor(Math.random() * 9973);
    this.meteorPath = kind === "meteor" ? this.aimMeteor() : null;
    this.invalidate();
  }

  /** A hand went past at `vxPx` CSS pixels per second, left to right. */
  stirWind(vxPx: number) {
    const heights = vxPx / Math.max(1, this.height);
    this.stir = GUST.max * Math.tanh(heights * GUST.gain);
    this.stirAt = performance.now();
  }

  /** Which way gravity points on the screen (x right, y up), or null for upright. */
  setGravity(gravity: GravityVector | null) {
    const g = gravity ?? { x: 0, y: -1 };
    const length = Math.hypot(g.x, g.y);
    this.down = length < 1e-4 ? [0, 1] : [g.x / length, -g.y / length];
    // Parallax only while the tilt is actually followed: an upright default
    // must not slide the camera back and forth as the gyro comes and goes.
    this.cameraTarget = gravity ? clamp(this.down[0], -1, 1) * CAMERA_REACH : 0;
    if (!this.moving) { this.rainDown = [...this.down]; this.snowDown = [...this.down]; this.camera = this.cameraTarget; this.invalidate(); }
  }

  /** Clear the mist at (x, y) — same space as `poke`. Called along a drag. */
  wipe(x: number, y: number) {
    if (!this.moving || !this.running || this.destroyed) return;
    const now = performance.now();
    const aspect = this.width / Math.max(1, this.height);
    const point: WipePoint = { x: clamp(x), y: clamp(1 - y), at: now, charge: 1, join: false };
    const head = this.wipeStroke ? this.wipePoints[this.wipePoints.length - 1] : undefined;
    this.wipeLastInput = now;
    if (!head) {
      point.charge = rub(this.hand, 0, now);
      this.pushWipe(point);
      this.wipeStroke = true;
    } else {
      const step = Math.hypot((point.x - head.x) * aspect, point.y - head.y);
      if (step > WIPE_JUMP) {
        point.charge = rub(this.hand, 0, now);
        this.pushWipe(point);
      } else if (step >= WIPE_STEP) {
        point.charge = rub(this.hand, step, now);
        point.join = true;
        this.pushWipe(point);
      }
    }
    this.invalidate();
  }

  /** End the stroke. What it cleared keeps healing on its own. */
  wipeEnd() { this.wipeStroke = false; }

  getStats(): AtmosphereStats {
    // Nothing to report while the CSS gradient is what shows.
    if (!this.renderer) return { width: 0, height: 0, scale: 0, frameMs: this.frameEma };
    return { width: this.canvas.width, height: this.canvas.height, scale: this.scale, frameMs: this.frameEma };
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.observer.disconnect(); this.intersection.disconnect();
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestored);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.renderer?.dispose(); this.renderer = null;
    this.details?.clear(); this.details = null;
  }

  // --- Lifecycle -------------------------------------------------------------

  private get moving() { return !this.paused && !this.opts.reducedMotion; }
  private get running() { return this.active && !this.hidden && this.intersecting && !this.destroyed; }

  private initRenderer() {
    this.renderer = createSkyRenderer(this.canvas);
    if (!this.renderer) this.report("fallback");
    else if (this.width) this.renderer.resize(this.width, this.height, this.scale);
  }

  private report(kind: "webgl" | "fallback") {
    if (this.rendererKind === kind) return;
    this.rendererKind = kind;
    this.opts.onRenderer?.(kind);
  }

  private onLost = (event: Event) => {
    event.preventDefault();
    this.lost = true;
    this.renderer = null;
    this.report("fallback");
  };

  private onRestored = () => {
    this.lost = false;
    this.initRenderer();
    this.invalidate();
  };

  private onVisibility = () => { this.hidden = document.hidden; this.update(); };

  private resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    if (!width || !height) return;
    const changed = width !== this.width || height !== this.height;
    this.width = width; this.height = height;
    const dpr = window.devicePixelRatio || 1;
    this.baseScale = Math.min(dpr, 1.25, Math.sqrt(this.opts.pixelBudget / (width * height)));
    if (changed) this.failedScale = Infinity;
    this.scale = Math.min(this.baseScale, this.failedScale * 0.8);
    this.renderer?.resize(width, height, this.scale);
    this.details?.resize(width, height);
    if (this.wipeMask) this.sizeWipeMask();
    this.lastCloud = 0;
    this.invalidate();
  }

  /** Something changed: draw it — a still frame, or the loop picks it up. */
  private invalidate() {
    this.lastCloud = 0;
    this.update();
  }

  private update() {
    if (!this.running || !this.target) {
      cancelAnimationFrame(this.raf); this.raf = 0; this.last = 0;
      // Every event is measured in wall-clock time; a paused engine would
      // resume one hours later, mid-flash, or with a hole in the fog.
      if (!this.running) this.retireEvents();
      return;
    }
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  private retireEvents() {
    this.pokeKind = null; this.meteorPath = null;
    this.wipePoints = []; this.wipeStroke = false;
    this.stir = 0; this.gust = 0;
  }

  // --- The frame -------------------------------------------------------------

  private tick = (now: number) => {
    this.raf = 0;
    if (!this.running || !this.target || !this.current) return;
    const moving = this.moving;
    const delta = this.last ? now - this.last : 1000 / this.opts.maxFps;
    if (moving && delta < 1000 / this.opts.maxFps - 1.5) { this.raf = requestAnimationFrame(this.tick); return; }
    this.last = now;
    if (moving) this.adaptQuality(delta);
    const dt = moving ? Math.min(delta, 250) / 1000 : 0;
    this.elapsed += Math.min(dt, 0.08);
    this.advance(dt, now, moving);

    const scene = this.current;
    const lightning = this.lightning(now, dt, moving);
    const flash = this.pokeKind === "strike" ? lightning.strength : lightning.strength * scene.storm;
    const meteor = this.meteor(now);
    const wipeLive = this.ageWipe(now);
    // The volume drifts at a low rate; anything quick in it — a flash, a
    // meteor, a hand in the mist — gets every frame while it lasts.
    const quick = flash > 0.001 || meteor || wipeLive && now - this.wipeLastInput < 400 || Math.abs(this.camera - this.cameraTarget) > 0.002;
    const cloudDue = !moving || !this.lastCloud || quick || now - this.lastCloud >= 1000 / this.opts.cloudFps - 1.5 || Math.abs(flash - this.lastFlash) > 0.06;
    if (this.renderer && !this.lost && cloudDue) {
      const f = this.frame;
      f.time = this.elapsed; f.camera = this.camera; f.lightning = lightning; f.flash = flash;
      f.wipe = wipeLive ? this.wipeMask : null;
      f.wipeDirty = wipeLive;
      this.renderer.draw(scene, f);
      this.lastCloud = now; this.lastFlash = flash;
      this.canvas.dataset.frames = String(++this.draws);
      // Reported once the frame is on the canvas: a fresh WebGL canvas is black until then.
      this.report("webgl");
    }
    const details = this.details;
    if (details) {
      const frame = { rain: scene.rain, snow: scene.snow, lightning, impact: this.pokeKind === "strike" };
      if (details.wants(frame)) {
        const across: [number, number] = [this.snowDown[1], -this.snowDown[0]];
        const lean = scene.wind[0] + this.gust;
        details.draw({
          ...frame, time: this.elapsed, dt,
          rainDir: [this.rainDown[0] + this.rainDown[1] * RAIN_LEAN * (scene.wind[0] + this.gust * 1.2),
            this.rainDown[1] - this.rainDown[0] * RAIN_LEAN * (scene.wind[0] + this.gust * 1.2)],
          snowDir: [this.snowDown[0] + across[0] * SNOW_LEAN * lean, this.snowDown[1] + across[1] * SNOW_LEAN * lean],
          across,
        });
      } else details.clear();
    }
    if (moving) this.raf = requestAnimationFrame(this.tick);
  };

  /** Ease the scene, the air and the camera by `dt` seconds (0: arrive at once). */
  private advance(dt: number, now: number, moving: boolean) {
    const target = this.target!, current = this.current!;
    const k = moving ? 1 - Math.exp(-dt / SCENE_TAU) : 1;
    const c = current as unknown as Record<string, number | number[]>;
    for (const key in target) {
      if ((SNAPPED_KEYS as readonly string[]).includes(key)) continue;
      const to = target[key as keyof SkyScene];
      const from = c[key];
      if (typeof to === "number") c[key] = (from as number) + (to - (from as number)) * k;
      else for (let i = 0; i < to.length; i++) (from as number[])[i] += (to[i] - (from as number[])[i]) * k;
    }
    const ease = (tau: number) => (moving ? 1 - Math.exp(-dt / tau) : 1);
    this.gust = moving ? gustStep(this.gust, this.stir, this.stirAt, now, dt) : 0;
    const kr = ease(RAIN_TAU), ks = ease(SNOW_TAU);
    for (let i = 0; i < 2; i++) {
      this.rainDown[i] += (this.down[i] - this.rainDown[i]) * kr;
      this.snowDown[i] += (this.down[i] - this.snowDown[i]) * ks;
    }
    normalize(this.rainDown); normalize(this.snowDown);
    this.camera += (this.cameraTarget - this.camera) * ease(CAMERA_TAU);
    // The deck drifts with the wind across the view and into it, and a calm
    // day still carries it slowly away, so the sky is never frozen.
    this.drift[0] += current.wind[0] * dt * 0.012;
    this.drift[2] += (current.wind[1] * 0.012 + 0.0025) * dt;
  }

  private lightning(now: number, dt: number, moving: boolean): LightningFrame {
    if (this.pokeKind === "strike") {
      const age = (now - this.pokeAt) / 1000;
      if (age * 1000 < POKE_MS.strike) return strikeAt(age, this.pokeX, this.pokeY, this.pokeSeed);
      this.pokeKind = null;
    }
    const storm = this.target!.storm > 0.1;
    if (storm && moving) this.stormTime += Math.min(dt, 0.08);
    return lightningAt(this.stormTime, storm && moving);
  }

  /** A path through the clicked point, re-rolled per click (see the Sky's "The meteor"). */
  private aimMeteor() {
    const side = Math.random() < 0.5 ? -1 : 1;
    const pitch = (0.18 + Math.random() * 0.5) * Math.PI / 2;
    // Heights, x stretched by the aspect so a streak is even on screen.
    const dx = side * Math.cos(pitch), dy = Math.sin(pitch);
    const before = 0.3 + Math.random() * 0.35, after = 0.15 + Math.random() * 0.25;
    const flight = clamp(before + after, METEOR.minFlight, METEOR.maxFlight);
    const aspect = this.width / Math.max(1, this.height);
    return { x: this.pokeX * aspect - dx * before, y: this.pokeY - dy * before, dx, dy, flight };
  }

  /** Place the meteor for this frame; false once it has burnt out. */
  private meteor(now: number): boolean {
    const f = this.frame;
    const path = this.pokeKind === "meteor" ? this.meteorPath : null;
    const age = (now - this.pokeAt) / 1000;
    if (!path || age * 1000 >= POKE_MS.meteor) {
      if (this.pokeKind === "meteor") { this.pokeKind = null; this.meteorPath = null; }
      f.meteorGlow = 0;
      return false;
    }
    const aspect = this.width / Math.max(1, this.height);
    const duration = path.flight / METEOR.speed;
    const travelled = Math.min(age * METEOR.speed, path.flight);
    // The train trails the head, and after the head burns out it catches up.
    const trainEnd = Math.max(0, age - duration) * METEOR.speed * 1.8;
    const tail = Math.max(0, Math.min(travelled, travelled - METEOR.train + trainEnd));
    const head = [path.x + path.dx * travelled, path.y + path.dy * travelled];
    const back = [path.x + path.dx * Math.min(tail, travelled - 1e-3), path.y + path.dy * Math.min(tail, travelled - 1e-3)];
    f.meteor[0] = head[0] / aspect; f.meteor[1] = head[1];
    f.meteor[2] = back[0] / aspect; f.meteor[3] = back[1];
    const burning = age < duration ? smooth(0, 0.08, age) * (1 - 0.35 * age / duration) : 0.65 * Math.exp(-(age - duration) / METEOR.fade);
    // As the Sky's does, it scales with how dark the night is: faint on a washed-out one.
    f.meteorGlow = burning * (0.4 + 0.6 * (this.current?.stars ?? 1));
    return burning > 0.002;
  }

  // --- The fog wipe ----------------------------------------------------------

  private pushWipe(point: WipePoint) {
    this.wipePoints.push(point);
    if (this.wipePoints.length > WIPE_POINTS) this.wipePoints.shift();
    if (!this.wipeMask) {
      this.wipeMask = document.createElement("canvas");
      this.wipeCtx = this.wipeMask.getContext("2d");
      this.sizeWipeMask();
    }
  }

  private sizeWipeMask() {
    if (!this.wipeMask) return;
    const aspect = this.width / Math.max(1, this.height);
    this.wipeMask.height = WIPE_ROWS;
    this.wipeMask.width = Math.max(8, Math.min(512, Math.round(WIPE_ROWS * aspect)));
  }

  /** Age the swath and paint what is left of it; false once it has healed. */
  private ageWipe(now: number): boolean {
    const points = this.wipePoints;
    const life = WIPE_LIFE_MS * WIPE_TAIL;
    while (points.length && now - points[0].at > life) points.shift();
    // A stroke whose head healed has nothing left to join the next corner to.
    if (!points.length) { this.wipeStroke = false; return false; }
    const ctx = this.wipeCtx, mask = this.wipeMask;
    if (!ctx || !mask) return false;
    const w = mask.width, h = mask.height;
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    // Downwind and settling as it ages — the old end of a stroke has travelled
    // further than the new, so it shears like weather rather than sitting still.
    const across: [number, number] = [this.down[1], -this.down[0]];
    const blow = (this.current?.wind[0] ?? 0) * WIPE_BLOW_WIND + WIPE_BLOW_STILL;
    const place = (p: WipePoint) => {
      const a = (now - p.at) / WIPE_LIFE_MS;
      const strength = p.charge * Math.exp(-WIPE_DECAY * a) * (1 - smooth(WIPE_TAIL * 0.7, WIPE_TAIL, a));
      const aspect = w / h;
      return {
        x: (p.x + (across[0] * blow + this.down[0] * WIPE_SETTLE) * a / aspect) * w,
        y: (p.y + (across[1] * blow + this.down[1] * WIPE_SETTLE) * a) * h,
        strength,
      };
    };
    const radius = WIPE_RADIUS * h;
    let previous = place(points[0]);
    const dab = (p: { x: number; y: number; strength: number }) => {
      ctx.fillStyle = `rgba(0,0,0,${p.strength * 0.85})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, radius * 1.2, 0, Math.PI * 2); ctx.fill();
    };
    dab(previous);
    for (let i = 1; i < points.length; i++) {
      const next = place(points[i]);
      if (points[i].join) {
        const strength = (previous.strength + next.strength) / 2;
        ctx.strokeStyle = `rgba(0,0,0,${strength * 0.35})`; ctx.lineWidth = radius * 3.4;
        ctx.beginPath(); ctx.moveTo(previous.x, previous.y); ctx.lineTo(next.x, next.y); ctx.stroke();
        ctx.strokeStyle = `rgba(0,0,0,${strength * 0.85})`; ctx.lineWidth = radius * 2;
        ctx.beginPath(); ctx.moveTo(previous.x, previous.y); ctx.lineTo(next.x, next.y); ctx.stroke();
      } else dab(next);
      previous = next;
    }
    return true;
  }

  // --- Quality ---------------------------------------------------------------

  /**
   * Hold the frame rate by spending fewer cloud pixels, then fewer particles —
   * and win both back once the frames are keeping up, but never to a scale
   * already measured as too slow (so the two rules cannot take turns forever).
   */
  private adaptQuality(delta: number) {
    if (delta > 250) return;
    this.frameEma += (delta - this.frameEma) * 0.08;
    const budget = 1000 / this.opts.maxFps;
    const minScale = this.baseScale * MIN_SCALE_SHARE;
    if (this.frameEma > budget * 1.55) {
      this.fastFrames = 0;
      if (++this.slowFrames > 45) {
        this.slowFrames = 0;
        if (this.scale > minScale + 1e-3) {
          this.failedScale = Math.min(this.failedScale, this.scale);
          this.scale = Math.max(minScale, this.scale * 0.8);
          this.renderer?.resize(this.width, this.height, this.scale);
          this.lastCloud = 0;
        } else if (this.particles > 0.4) {
          this.particles = Math.max(0.4, this.particles * 0.8);
          this.details?.setQuality(this.particles);
        }
      }
    } else if (this.frameEma < budget * 1.05) {
      this.slowFrames = 0;
      if (++this.fastFrames > 300) {
        this.fastFrames = 0;
        const next = Math.min(this.baseScale, this.scale / 0.8);
        if (this.particles < 1) {
          this.particles = Math.min(1, this.particles / 0.8);
          this.details?.setQuality(this.particles);
        } else if (next > this.scale + 1e-3 && next < this.failedScale) {
          this.scale = next;
          this.renderer?.resize(this.width, this.height, this.scale);
          this.lastCloud = 0;
        }
      }
    } else {
      this.slowFrames = Math.max(0, this.slowFrames - 1);
      this.fastFrames = 0;
    }
  }
}

function normalize(v: [number, number]) {
  const length = Math.hypot(v[0], v[1]);
  if (length < 1e-4) { v[0] = 0; v[1] = 1; } else { v[0] /= length; v[1] /= length; }
}
