import type { AtmosphereParams, Vec3 } from "./wallpaper";
import type { AtmosphereRenderer } from "./atmosphere";

// =============================================================================
// Canvas 2D atmosphere
//
// Used when WebGL is missing (or the shader fails). Same AtmosphereParams as
// the GL path, so weather/phase morphing stays identical. Draws a photographic
// sky plate, sun/moon bloom, drifting cloud banks, and stars.
// =============================================================================

function rgba(c: Vec3, a = 1): string {
  return `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${a})`;
}

type CloudBank = {
  x: number;
  y: number;
  rx: number;
  ry: number;
  shade: number;
  speed: number;
};

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function createAtmosphere2DRenderer(
  canvas: HTMLCanvasElement
): AtmosphereRenderer | null {
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  if (!ctx) return null;

  let params: AtmosphereParams | null = null;
  let lightning = 0;
  let timeScale = 1;
  let startMs = 0;
  let cssW = 1;
  let cssH = 1;
  let banks: CloudBank[] = [];

  const seedBanks = (w: number, h: number) => {
    const next: CloudBank[] = [];
    for (let i = 0; i < 11; i++) {
      next.push({
        x: hash(i * 3.1) * 1.3 - 0.15,
        y: 0.08 + hash(i * 7.7) * 0.5,
        rx: 0.16 + hash(i * 11.3) * 0.2,
        ry: 0.045 + hash(i * 13.9) * 0.055,
        shade: hash(i * 17.2),
        speed: 0.008 + hash(i * 19.5) * 0.018,
      });
    }
    banks = next;
    void w;
    void h;
  };

  const fillSky = (p: AtmosphereParams) => {
    const g = ctx.createLinearGradient(0, 0, 0, cssH);
    g.addColorStop(0, rgba(p.zenith));
    g.addColorStop(0.42, rgba(p.horizon));
    g.addColorStop(0.72, rgba(p.haze));
    g.addColorStop(1, rgba(p.ground));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);

    const haze = ctx.createRadialGradient(
      cssW * 0.5,
      cssH * 0.82,
      cssH * 0.02,
      cssW * 0.5,
      cssH * 0.82,
      cssW * 0.75
    );
    haze.addColorStop(0, rgba(p.haze, 0.55));
    haze.addColorStop(1, rgba(p.haze, 0));
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, cssW, cssH);
  };

  const drawOrb = (
    x: number,
    y: number,
    color: Vec3,
    size: number,
    glow: number
  ) => {
    if (glow < 0.02 && size < 0.002) return;
    const px = x * cssW;
    const py = (1 - y) * cssH;
    const r = Math.max(cssW, cssH);
    const bloom = ctx.createRadialGradient(px, py, 0, px, py, r * (0.18 + glow * 0.28));
    bloom.addColorStop(0, rgba(color, Math.min(0.55, 0.18 + glow * 0.28)));
    bloom.addColorStop(0.35, rgba(color, 0.08 * glow));
    bloom.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, cssW, cssH);

    const coreR = r * (size * 6.5 + 0.012);
    const core = ctx.createRadialGradient(px, py, 0, px, py, coreR);
    core.addColorStop(0, rgba(color, 0.95));
    core.addColorStop(0.45, rgba(color, 0.55));
    core.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(px, py, coreR, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawStars = (p: AtmosphereParams, t: number) => {
    if (p.stars < 0.02) return;
    const count = Math.floor(70 * p.stars);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < count; i++) {
      const seed = hash(i * 8.8);
      // Skip the dimmest seeds so the field stays sparse like iOS Weather.
      if (seed < 0.22) continue;
      const x = hash(i * 2.3) * cssW;
      const y = hash(i * 4.1) * cssH * 0.56;
      const twinkle =
        timeScale <= 0 ? 1 : 0.72 + 0.28 * Math.sin(t * (0.4 + seed * 1.3) + seed * 18);
      const bright = (0.2 + seed * 0.8) * p.stars * twinkle;
      const glowR = 2.4 + seed * seed * 5.5;
      const g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
      g.addColorStop(0, `rgba(255, 255, 255, ${0.72 * bright})`);
      g.addColorStop(0.22, `rgba(214, 226, 255, ${0.28 * bright})`);
      g.addColorStop(1, "rgba(170, 196, 255, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const drawClouds = (p: AtmosphereParams, t: number) => {
    if (p.cloudCover < 0.04) return;
    for (const bank of banks) {
      const drift = ((bank.x + t * bank.speed * p.cloudSpeed * 18) % 1.4) - 0.2;
      const cx = drift * cssW;
      const cy = bank.y * cssH;
      const rx = bank.rx * cssW * (0.85 + p.cloudCover * 0.4);
      const ry = bank.ry * cssH * (0.9 + p.cloudCover * 0.3);
      const col = bank.shade > 0.5 ? p.cloudLight : p.cloudShade;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
      g.addColorStop(0, rgba(col, 0.32 + p.cloudCover * 0.48));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawRays = (p: AtmosphereParams) => {
    if (p.rays < 0.05 || p.sunGlow < 0.08) return;
    const px = p.sunPos[0] * cssW;
    const py = (1 - p.sunPos[1]) * cssH;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(px, py);
    const wedges = 7;
    for (let i = 0; i < wedges; i++) {
      const a = (i / wedges) * Math.PI * 2;
      ctx.rotate(a);
      const rg = ctx.createLinearGradient(0, 0, cssW * 0.55, 0);
      rg.addColorStop(0, rgba(p.sunColor, 0.1 * p.rays));
      rg.addColorStop(1, rgba(p.sunColor, 0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(cssW * 0.55, -cssH * 0.015);
      ctx.lineTo(cssW * 0.55, cssH * 0.015);
      ctx.closePath();
      ctx.fill();
      ctx.rotate(-a);
    }
    ctx.restore();
  };

  return {
    setParams(next) {
      params = next;
    },
    setLightning(value) {
      lightning = value;
    },
    setTimeScale(scale) {
      timeScale = scale;
    },
    resize(cssWidth, cssHeight, dpr) {
      const w = Math.max(1, Math.floor(cssWidth * dpr));
      const h = Math.max(1, Math.floor(cssHeight * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      cssW = cssWidth;
      cssH = cssHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedBanks(cssWidth, cssHeight);
    },
    frame(nowMs) {
      if (!params) return;
      if (!startMs) startMs = nowMs;
      const t = ((nowMs - startMs) / 1000) * timeScale;
      fillSky(params);
      drawStars(params, t);
      drawRays(params);
      drawOrb(params.sunPos[0], params.sunPos[1], params.sunColor, params.sunSize, params.sunGlow);
      drawOrb(params.moonPos[0], params.moonPos[1], params.moonColor, params.moonSize, params.moonGlow);
      drawClouds(params, t);
      if (params.fog > 0.04) {
        ctx.fillStyle = rgba(params.haze, params.fog * 0.38);
        ctx.fillRect(0, 0, cssW, cssH);
      }
      if (lightning > 0.02) {
        ctx.fillStyle = `rgba(236, 242, 255, ${lightning * 0.2})`;
        ctx.fillRect(0, 0, cssW, cssH);
      }
    },
    destroy() {
      banks = [];
    },
  };
}
