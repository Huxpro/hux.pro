import type { SkyScene } from "./scene";
import type { LightningFrame } from "./lightning";

const random = (seed: number) => { const x = Math.sin(seed * 127.1 + 31.7) * 43758.5453; return x - Math.floor(x); };
const wrap = (value: number) => (value % 1 + 1) % 1;
const makeParticles = (count: number, seed: number) => Array.from({ length: count }, (_, i) => ({
  x: random(i * 4 + seed), y: random(i * 4 + seed + 1),
  depth: random(i * 4 + seed + 2), phase: random(i * 4 + seed + 3) * Math.PI * 2,
}));

/** Sharp precipitation lives at display resolution, independent of the cloud
 * raymarch budget. Only a bounded number of vector strokes/sprites is drawn. */
export function createWeatherDetails(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const rain = makeParticles(1100, 12);
  const snow = makeParticles(500, 903);
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
  let width = 1, height = 1;
  let frames = 0;
  return {
    resize(w: number, h: number) {
      width = w; height = h;
      // Retain at least CSS-pixel resolution even on very large monitors.
      const dpr = Math.max(1, Math.min(devicePixelRatio || 1, 2, Math.sqrt(8_000_000 / (w * h))));
      canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
    },
    draw(scene: SkyScene, time: number, dt: number, lightning: LightningFrame) {
      ctx.clearRect(0, 0, width, height);
      const area = width * height / 1_000_000;
      const rainCount = Math.min(rain.length, Math.round(850 * area));
      ctx.lineCap = "round";
      for (let i = 0; i < rainCount && scene.rain > 0.001; i++) {
        const p = rain[i], z = p.depth;
        const alpha = Math.min(1, Math.max(0, scene.rain * rainCount - i));
        const vy = 560 + z * z * 1500;
        const vx = scene.wind[0] * (140 + z * 330);
        p.x = wrap(p.x + vx * dt / (width + 100)); p.y = wrap(p.y + vy * dt / (height + 100));
        if (!alpha) continue;
        const x = p.x * (width + 100) - 50, y = p.y * (height + 100) - 50;
        const length = 10 + z * 26;
        ctx.strokeStyle = `rgba(220,237,252,${alpha * (0.18 + z * 0.42)})`;
        ctx.lineWidth = 0.55 + z * 0.8;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - vx / vy * length, y - length); ctx.stroke();
        // A narrow bright leading edge gives nearby drops a specular glint.
        if (z > 0.78) {
          ctx.strokeStyle = `rgba(246,251,255,${alpha * 0.58})`;
          ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - vx / vy * 3, y - 3); ctx.stroke();
        }
      }
      const snowCount = Math.min(snow.length, Math.round(420 * area));
      for (let i = 0; i < snowCount && scene.snow > 0.001; i++) {
        const p = snow[i], z = p.depth;
        const alpha = Math.min(1, Math.max(0, scene.snow * snowCount - i));
        const sway = Math.sin(time * (0.45 + z * 0.3) + p.phase);
        p.x = wrap(p.x + (scene.wind[0] * (28 + z * 60) + sway * (10 + z * 22)) * dt / (width + 40));
        p.y = wrap(p.y + (18 + z * z * 85) * dt / (height + 40));
        if (!alpha) continue;
        const x = p.x * (width + 40) - 20, y = p.y * (height + 40) - 20;
        const radius = 0.65 + z * z * 2.5;
        ctx.globalAlpha = alpha * (0.4 + z * 0.55);
        if (z > 0.8) {
          const size = 6 + (z - 0.8) * 24;
          ctx.save(); ctx.translate(x, y); ctx.rotate(time * 0.25 + p.phase);
          ctx.drawImage(flake, -size / 2, -size / 2, size, size); ctx.restore();
        } else {
          ctx.fillStyle = "rgb(238,246,255)"; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      if (lightning.bolt > 0.001 && scene.storm > 0.01) {
        const alpha = lightning.bolt * scene.storm;
        type Point = [number, number];
        const subdivide = (a: Point, b: Point, depth: number, seed: number): Point[] => {
          if (!depth) return [a, b];
          const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const mid: Point = [(a[0] + b[0]) / 2 + (random(seed) - 0.5) * span * 0.65,
            (a[1] + b[1]) / 2 + (random(seed + 7) - 0.5) * span * 0.12];
          return [...subdivide(a, mid, depth - 1, seed * 2).slice(0, -1), ...subdivide(mid, b, depth - 1, seed * 2 + 1)];
        };
        const points = subdivide([width * lightning.x, height * 0.12],
          [width * (lightning.x + 0.035), height * 0.54], 5, lightning.seed);
        const path = new Path2D(); path.moveTo(...points[0]); points.slice(1).forEach(p => path.lineTo(...p));
        const branches = new Path2D();
        for (const fork of [11, 21]) {
          const [x, y] = points[fork];
          const branch = subdivide([x, y], [x - width * (fork === 11 ? 0.075 : 0.045), y + height * 0.12], 3, lightning.seed + fork);
          branches.moveTo(...branch[0]); branch.slice(1).forEach(p => branches.lineTo(...p));
        }
        ctx.shadowColor = `rgba(136,181,255,${alpha})`; ctx.shadowBlur = 20;
        ctx.strokeStyle = `rgba(154,193,255,${alpha * 0.6})`; ctx.lineWidth = 4; ctx.stroke(path);
        ctx.shadowBlur = 7; ctx.strokeStyle = `rgba(232,244,255,${alpha})`; ctx.lineWidth = 1.35; ctx.stroke(path);
        ctx.lineWidth = 0.65; ctx.stroke(branches);
        ctx.shadowBlur = 0;
      }
      canvas.dataset.frames = String(++frames);
      canvas.dataset.lightning = String(lightning.bolt);
    },
    clear() { ctx.clearRect(0, 0, width, height); },
  };
}
