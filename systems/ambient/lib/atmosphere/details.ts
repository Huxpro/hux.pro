import type { LightningFrame } from "./lightning";

const random = (seed: number) => { const x = Math.sin(seed * 127.1 + 31.7) * 43758.5453; return x - Math.floor(x); };
const wrap = (value: number) => value - Math.floor(value);

/** Particles as columns, not objects: x, y (0..1 of the padded box), depth, phase. */
function makeParticles(count: number, seed: number) {
  const x = new Float32Array(count), y = new Float32Array(count);
  const depth = new Float32Array(count), phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    x[i] = random(i * 4 + seed); y[i] = random(i * 4 + seed + 1);
    depth[i] = random(i * 4 + seed + 2); phase[i] = random(i * 4 + seed + 3) * Math.PI * 2;
  }
  return { count, x, y, depth, phase };
}
type Particles = ReturnType<typeof makeParticles>;

/**
 * Indices grouped into depth bands, each band in index order. Only the first
 * `n` particles are ever live (n follows the intensity), so a band is walked
 * until its indices pass `n` — and every live particle of a band shares one
 * stroke style, which is what lets a whole band go out as one path.
 */
function bands(p: Particles, edges: readonly number[]) {
  const out = edges.slice(1).map(() => [] as number[]);
  for (let i = 0; i < p.count; i++) {
    const z = p.depth[i];
    let b = 0;
    while (b < out.length - 1 && z >= edges[b + 1]) b++;
    out[b].push(i);
  }
  return out.map(list => Int32Array.from(list));
}

const RAIN_EDGES = [0, 0.25, 0.5, 0.78, 1.0001] as const;
const SNOW_EDGES = [0, 0.3, 0.55, 0.8, 1.0001] as const;
/** Snow nearer than this is a drawn flake; further out, a soft dot. */
const FLAKE_DEPTH = 0.8;

export interface DetailFrame {
  rain: number;
  snow: number;
  /** How much of a bolt to draw: 0 none. */
  lightning: LightningFrame;
  /** The bolt was called down by a click — it lands, so it gets a ground flash. */
  impact: boolean;
  time: number;
  dt: number;
  /** Where the rain goes, CSS px space with y down; its length is the lean. */
  rainDir: [number, number];
  /** Where the snow goes, likewise, and the unit vector across it for the sway. */
  snowDir: [number, number];
  across: [number, number];
}

/** Sharp precipitation lives at display resolution, independent of the cloud
 * raymarch budget. A bounded number of strokes and sprites is drawn, batched
 * into one path per depth band. */
export function createWeatherDetails(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const rain = makeParticles(5000, 12);
  const snow = makeParticles(500, 903);
  const rainBands = bands(rain, RAIN_EDGES);
  const snowBands = bands(snow, SNOW_EDGES);
  const flake = document.createElement("canvas");
  flake.width = flake.height = 64;
  const sprite = flake.getContext("2d")!;
  sprite.translate(32, 32);
  sprite.strokeStyle = "rgba(245,250,255,0.95)";
  sprite.lineWidth = 3;
  sprite.lineCap = "round";
  for (let i = 0; i < 6; i++) {
    sprite.save(); sprite.rotate(i * Math.PI / 3);
    sprite.beginPath(); sprite.moveTo(0, 0); sprite.lineTo(0, -25);
    sprite.moveTo(0, -13); sprite.lineTo(-7, -20);
    sprite.moveTo(0, -13); sprite.lineTo(7, -20); sprite.stroke(); sprite.restore();
  }
  let width = 1, height = 1, ratio = 1;
  let frames = 0;
  /** Particle share kept under load, 0.4..1. */
  let quality = 1;
  let dirty = false;
  type Point = [number, number];
  let bolt: { key: string; points: Point[]; forks: { at: number; points: Point[] }[] } | null = null;
  /** The channel as far as it has grown: the first `grow` of its points. */
  const grownPath = (points: Point[], grow: number) => {
    const path = new Path2D();
    const end = Math.max(1, Math.round(grow * (points.length - 1)));
    path.moveTo(...points[0]);
    for (let i = 1; i <= end; i++) path.lineTo(...points[i]);
    return path;
  };

  const boltPaths = (l: LightningFrame) => {
    const key = `${l.seed}|${l.x}|${l.y}|${l.from}|${l.toX}|${l.toY}|${width}|${height}`;
    if (bolt?.key === key) return bolt;
    const subdivide = (a: Point, b: Point, depth: number, seed: number): Point[] => {
      if (!depth) return [a, b];
      const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const mid: Point = [(a[0] + b[0]) / 2 + (random(seed) - 0.5) * span * 0.65,
        (a[1] + b[1]) / 2 + (random(seed + 7) - 0.5) * span * 0.12];
      return [...subdivide(a, mid, depth - 1, seed * 2).slice(0, -1), ...subdivide(mid, b, depth - 1, seed * 2 + 1)];
    };
    const top = l.from ?? l.y;
    const points = subdivide([width * l.x, height * top], [width * l.toX, height * l.toY], 6, l.seed);
    const reach = Math.hypot(width * (l.toX - l.x), height * (l.toY - top)) / (height * 0.42);
    const forks = [17, 30, 41].map(fork => {
      const [x, y] = points[fork];
      const side = random(l.seed + fork) < 0.5 ? -1 : 1;
      return { at: fork / (points.length - 1), points: subdivide([x, y], [x + side * width * 0.06 * reach, y + height * 0.1 * reach], 3, l.seed + fork) };
    });
    bolt = { key, points, forks };
    return bolt;
  };

  return {
    resize(w: number, h: number) {
      width = w; height = h;
      // Retain at least CSS-pixel resolution even on very large monitors.
      ratio = Math.max(1, Math.min(devicePixelRatio || 1, 2, Math.sqrt(8_000_000 / Math.max(1, w * h))));
      canvas.width = Math.max(1, Math.round(w * ratio)); canvas.height = Math.max(1, Math.round(h * ratio));
      ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
      dirty = true;
    },
    setQuality(q: number) { quality = Math.max(0.4, Math.min(1, q)); },
    /** Whether there is anything to draw for this frame's weather. */
    wants(f: Pick<DetailFrame, "rain" | "snow" | "lightning">) {
      return f.rain > 0.001 || f.snow > 0.001 || f.lightning.bolt > 0.001;
    },
    draw(f: DetailFrame) {
      ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const area = width * height / 1_000_000;

      // --- Rain: one streak per drop, one path per depth band.
      // As dense as the Sky's rain reads at the same intensity: a sheet, not a scatter.
      const rainLive = Math.floor(Math.min(rain.count, Math.round(4200 * area * quality)) * Math.min(1, f.rain));
      if (rainLive > 0) {
        const [dx, dy] = f.rainDir;
        const lean = Math.hypot(dx, dy) || 1;
        const ux = dx / lean, uy = dy / lean;
        const padW = width + 100, padH = height + 100;
        ctx.lineCap = "round";
        const glints = new Path2D();
        for (let b = 0; b < rainBands.length; b++) {
          const band = rainBands[b];
          const zc = (RAIN_EDGES[b] + RAIN_EDGES[b + 1]) / 2;
          ctx.beginPath();
          for (let k = 0; k < band.length; k++) {
            const i = band[k];
            if (i >= rainLive) break;
            const z = rain.depth[i];
            const speed = (560 + z * z * 1500) * f.dt;
            rain.x[i] = wrap(rain.x[i] + dx * speed / padW);
            rain.y[i] = wrap(rain.y[i] + dy * speed / padH);
            const x = rain.x[i] * padW - 50, y = rain.y[i] * padH - 50;
            const length = (10 + z * 26) * lean;
            ctx.moveTo(x, y); ctx.lineTo(x - ux * length, y - uy * length);
            // A narrow bright leading edge gives nearby drops a specular glint.
            if (z > 0.78) { glints.moveTo(x, y); glints.lineTo(x - ux * 3, y - uy * 3); }
          }
          ctx.strokeStyle = `rgba(220,237,252,${0.18 + zc * 0.42})`;
          ctx.lineWidth = 0.55 + zc * 0.8;
          ctx.stroke();
        }
        ctx.strokeStyle = "rgba(246,251,255,0.58)";
        ctx.lineWidth = 0.6;
        ctx.stroke(glints);
      }

      // --- Snow: soft dots far off, drawn flakes up close.
      const snowLive = Math.floor(Math.min(snow.count, Math.round(420 * area * quality)) * Math.min(1, f.snow));
      if (snowLive > 0) {
        const [dx, dy] = f.snowDir;
        const [ax, ay] = f.across;
        const padW = width + 40, padH = height + 40;
        ctx.fillStyle = "rgb(238,246,255)";
        for (let b = 0; b < snowBands.length; b++) {
          const band = snowBands[b];
          const zc = (SNOW_EDGES[b] + SNOW_EDGES[b + 1]) / 2;
          const flakes = SNOW_EDGES[b] >= FLAKE_DEPTH;
          ctx.globalAlpha = 0.4 + zc * 0.55;
          if (!flakes) ctx.beginPath();
          for (let k = 0; k < band.length; k++) {
            const i = band[k];
            if (i >= snowLive) break;
            const z = snow.depth[i];
            const sway = Math.sin(f.time * (0.45 + z * 0.3) + snow.phase[i]) * (10 + z * 22);
            const fall = 18 + z * z * 85;
            snow.x[i] = wrap(snow.x[i] + (dx * fall + ax * sway) * f.dt / padW);
            snow.y[i] = wrap(snow.y[i] + (dy * fall + ay * sway) * f.dt / padH);
            const x = snow.x[i] * padW - 20, y = snow.y[i] * padH - 20;
            if (flakes) {
              const size = 6 + (z - FLAKE_DEPTH) * 24;
              const angle = f.time * 0.25 + snow.phase[i];
              const c = Math.cos(angle), s = Math.sin(angle);
              ctx.setTransform(c * ratio, s * ratio, -s * ratio, c * ratio, x * ratio, y * ratio);
              ctx.drawImage(flake, -size / 2, -size / 2, size, size);
            } else {
              const radius = 0.65 + z * z * 2.5;
              ctx.moveTo(x + radius, y); ctx.arc(x, y, radius, 0, Math.PI * 2);
            }
          }
          if (flakes) ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
          else ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // --- The bolt: the same event that lights the cloud volume.
      const l = f.lightning;
      if (l.bolt > 0.001) {
        const alpha = l.bolt;
        const { points, forks } = boltPaths(l);
        const path = grownPath(points, l.grow);
        const branches = new Path2D();
        for (const fork of forks) if (l.grow > fork.at) branches.addPath(grownPath(fork.points, Math.min(1, (l.grow - fork.at) / (1 - fork.at))));
        // A channel is as wide as the screen is tall allows: hairline on a
        // phone tile, a real bolt across a desktop.
        const w = Math.max(1, height / 520);
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.shadowColor = `rgba(136,181,255,${alpha})`; ctx.shadowBlur = 22 * w;
        ctx.strokeStyle = `rgba(154,193,255,${alpha * 0.6})`; ctx.lineWidth = 5 * w; ctx.stroke(path);
        ctx.shadowBlur = 8 * w; ctx.strokeStyle = `rgba(240,247,255,${alpha})`; ctx.lineWidth = 1.8 * w; ctx.stroke(path);
        ctx.lineWidth = 0.9 * w; ctx.stroke(branches);
        ctx.shadowBlur = 0;
        if (f.impact && l.grow >= 1) {
          const x = width * l.toX, y = height * l.toY, r = Math.min(width, height) * 0.09;
          const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
          glow.addColorStop(0, `rgba(226,238,255,${alpha * 0.55})`);
          glow.addColorStop(1, "rgba(160,196,255,0)");
          ctx.fillStyle = glow; ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
      }
      dirty = true;
      canvas.dataset.frames = String(++frames);
      canvas.dataset.lightning = String(l.bolt);
    },
    clear() {
      if (!dirty) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dirty = false;
    },
  };
}

export type WeatherDetails = NonNullable<ReturnType<typeof createWeatherDetails>>;
