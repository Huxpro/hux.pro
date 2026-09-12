import type { AtmosphereParams } from "./wallpaper";

// =============================================================================
// Canvas 2D weather particles
//
// Near-field layer that sits on top of the WebGL sky:
//   rain streaks, tumbling snow, fog wisps, drifting cloud puffs,
//   and occasional lightning bolts (plus a flash value for the shader).
// =============================================================================

type RainDrop = {
  x: number;
  y: number;
  len: number;
  speed: number;
  width: number;
  alpha: number;
};

type Snowflake = {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number;
  phase: number;
  alpha: number;
};

type Wisp = {
  x: number;
  y: number;
  rx: number;
  ry: number;
  vx: number;
  alpha: number;
};

type Puff = {
  x: number;
  y: number;
  rx: number;
  ry: number;
  vx: number;
  alpha: number;
  shade: number;
};

type Bolt = {
  points: Array<[number, number]>;
  life: number;
  maxLife: number;
  width: number;
};

export interface ParticleRenderer {
  setParams: (params: AtmosphereParams) => void;
  resize: (cssWidth: number, cssHeight: number, dpr: number) => void;
  frame: (nowMs: number, reducedMotion: boolean) => number;
  destroy: () => void;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function rgb(c: readonly [number, number, number], a: number): string {
  return `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${a})`;
}

export function createParticleRenderer(
  canvas: HTMLCanvasElement,
  options?: { mobile?: boolean }
): ParticleRenderer | null {
  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) return null;

  const mobile = options?.mobile ?? false;
  const rainCount = mobile ? 140 : 280;
  const snowCount = mobile ? 70 : 130;
  const wispCount = mobile ? 6 : 10;
  const puffCount = mobile ? 4 : 7;

  const rain: RainDrop[] = [];
  const snow: Snowflake[] = [];
  const wisps: Wisp[] = [];
  const puffs: Puff[] = [];
  const bolts: Bolt[] = [];

  let params: AtmosphereParams | null = null;
  let cssW = 1;
  let cssH = 1;
  let lastMs = 0;
  let flash = 0;
  let nextStrike = 1800 + Math.random() * 3200;

  const seedRain = (w: number, h: number, drop?: RainDrop): RainDrop => {
    const d = drop ?? {
      x: 0,
      y: 0,
      len: 0,
      speed: 0,
      width: 0,
      alpha: 0,
    };
    d.x = Math.random() * (w + 80) - 40;
    d.y = Math.random() * (h + 80) - 40;
    d.len = rand(10, 22);
    d.speed = rand(980, 1480);
    d.width = rand(0.7, 1.4);
    d.alpha = rand(0.18, 0.42);
    return d;
  };

  const seedSnow = (w: number, h: number, flake?: Snowflake): Snowflake => {
    const f = flake ?? {
      x: 0,
      y: 0,
      r: 0,
      speed: 0,
      drift: 0,
      phase: 0,
      alpha: 0,
    };
    f.x = Math.random() * w;
    f.y = Math.random() * h;
    f.r = rand(0.8, 3.2);
    f.speed = rand(28, 78);
    f.drift = rand(-18, 18);
    f.phase = Math.random() * Math.PI * 2;
    f.alpha = rand(0.35, 0.85);
    return f;
  };

  const seedWisp = (w: number, h: number, wisp?: Wisp): Wisp => {
    const s = wisp ?? { x: 0, y: 0, rx: 0, ry: 0, vx: 0, alpha: 0 };
    s.x = Math.random() * w;
    s.y = rand(h * 0.25, h * 0.92);
    s.rx = rand(w * 0.18, w * 0.38);
    s.ry = rand(h * 0.06, h * 0.16);
    s.vx = rand(-8, 8);
    s.alpha = rand(0.08, 0.2);
    return s;
  };

  const seedPuff = (w: number, h: number, puff?: Puff): Puff => {
    const p = puff ?? {
      x: 0,
      y: 0,
      rx: 0,
      ry: 0,
      vx: 0,
      alpha: 0,
      shade: 0,
    };
    p.x = Math.random() * (w + 200) - 100;
    p.y = rand(h * 0.04, h * 0.55);
    p.rx = rand(w * 0.16, w * 0.34);
    p.ry = rand(h * 0.05, h * 0.12);
    p.vx = rand(4, 16);
    p.alpha = rand(0.1, 0.26);
    p.shade = Math.random();
    return p;
  };

  const spawnBolt = (w: number, h: number) => {
    const startX = rand(w * 0.15, w * 0.85);
    const points: Array<[number, number]> = [[startX, 0]];
    let x = startX;
    let y = 0;
    const segments = 8 + Math.floor(Math.random() * 6);
    for (let i = 0; i < segments; i++) {
      x += rand(-w * 0.06, w * 0.06);
      y += h * rand(0.06, 0.12);
      points.push([x, Math.min(y, h * 0.85)]);
      if (Math.random() < 0.35 && i > 2) {
        points.push([x + rand(-w * 0.08, w * 0.08), y + rand(20, 70)]);
        points.push([x, y]);
      }
    }
    bolts.push({
      points,
      life: 1,
      maxLife: rand(0.08, 0.16),
      width: rand(1.2, 2.4),
    });
  };

  const ensurePools = () => {
    while (rain.length < rainCount) rain.push(seedRain(cssW, cssH));
    while (snow.length < snowCount) snow.push(seedSnow(cssW, cssH));
    while (wisps.length < wispCount) wisps.push(seedWisp(cssW, cssH));
    while (puffs.length < puffCount) puffs.push(seedPuff(cssW, cssH));
  };

  return {
    setParams(next) {
      params = next;
    },
    resize(cssWidth, cssHeight, dpr) {
      const w = Math.max(1, Math.floor(cssWidth * dpr));
      const h = Math.max(1, Math.floor(cssHeight * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      cssW = cssWidth;
      cssH = cssHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ensurePools();
    },
    frame(nowMs, reducedMotion) {
      if (!params) return 0;
      const dt = lastMs ? clamp((nowMs - lastMs) / 1000, 0, 0.05) : 0.016;
      lastMs = nowMs;
      ctx.clearRect(0, 0, cssW, cssH);

      if (reducedMotion) {
        flash *= 0.85;
        return flash;
      }

      const wind = params.wind;
      const rainAmt = params.rain;
      const snowAmt = params.snow;
      const fogAmt = params.fog;
      const cover = params.cloudCover;

      if (cover > 0.2) {
        for (const puff of puffs) {
          puff.x += puff.vx * (0.35 + wind) * dt * 8;
          if (puff.x - puff.rx > cssW + 40) {
            seedPuff(cssW, cssH, puff);
            puff.x = -puff.rx;
          }
          const col = puff.shade > 0.45 ? params.cloudLight : params.cloudShade;
          const g = ctx.createRadialGradient(
            puff.x,
            puff.y,
            0,
            puff.x,
            puff.y,
            puff.rx
          );
          g.addColorStop(0, rgb(col, puff.alpha * cover));
          g.addColorStop(1, rgb(col, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(puff.x, puff.y, puff.rx, puff.ry, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (fogAmt > 0.04) {
        for (const wisp of wisps) {
          wisp.x += wisp.vx * dt * 6;
          if (wisp.x - wisp.rx > cssW) seedWisp(cssW, cssH, wisp);
          const g = ctx.createRadialGradient(
            wisp.x,
            wisp.y,
            0,
            wisp.x,
            wisp.y,
            wisp.rx
          );
          g.addColorStop(0, rgb(params.haze, wisp.alpha * fogAmt * 1.4));
          g.addColorStop(1, rgb(params.haze, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(wisp.x, wisp.y, wisp.rx, wisp.ry, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (rainAmt > 0.02) {
        const active = Math.floor(rain.length * clamp(rainAmt, 0, 1));
        ctx.lineCap = "round";
        for (let i = 0; i < active; i++) {
          const d = rain[i];
          const wx = wind * 140;
          d.x += wx * dt;
          d.y += d.speed * dt;
          if (d.y > cssH + 20 || d.x > cssW + 40) {
            seedRain(cssW, cssH, d);
            d.y = -d.len;
          }
          ctx.strokeStyle = `rgba(210, 224, 240, ${d.alpha * rainAmt})`;
          ctx.lineWidth = d.width;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + wx * 0.05, d.y + d.len);
          ctx.stroke();
        }
      }

      if (snowAmt > 0.02) {
        const active = Math.floor(snow.length * clamp(snowAmt, 0, 1));
        for (let i = 0; i < active; i++) {
          const f = snow[i];
          f.phase += dt * 1.4;
          f.x += (f.drift + Math.sin(f.phase) * 16 + wind * 22) * dt;
          f.y += f.speed * dt;
          if (f.y > cssH + 8) {
            seedSnow(cssW, cssH, f);
            f.y = -6;
          }
          if (f.x < -8) f.x = cssW + 6;
          if (f.x > cssW + 8) f.x = -6;
          ctx.fillStyle = `rgba(246, 250, 255, ${f.alpha * snowAmt})`;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      flash *= Math.exp(-dt * 14);
      if (params.thunder > 0.2) {
        nextStrike -= dt * 1000;
        if (nextStrike <= 0) {
          flash = rand(0.45, 1);
          if (Math.random() < 0.7) spawnBolt(cssW, cssH);
          nextStrike = rand(1600, 6200);
        }
      }

      for (let i = bolts.length - 1; i >= 0; i--) {
        const bolt = bolts[i];
        bolt.life -= dt;
        const a = clamp(bolt.life / bolt.maxLife, 0, 1);
        ctx.save();
        ctx.strokeStyle = `rgba(236, 244, 255, ${0.85 * a})`;
        ctx.lineWidth = bolt.width;
        ctx.shadowColor = "rgba(200, 220, 255, 0.9)";
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.moveTo(bolt.points[0][0], bolt.points[0][1]);
        for (let p = 1; p < bolt.points.length; p++) {
          ctx.lineTo(bolt.points[p][0], bolt.points[p][1]);
        }
        ctx.stroke();
        ctx.restore();
        if (bolt.life <= 0) bolts.splice(i, 1);
      }

      if (flash > 0.02) {
        ctx.fillStyle = `rgba(236, 242, 255, ${flash * 0.18})`;
        ctx.fillRect(0, 0, cssW, cssH);
      }

      return flash;
    },
    destroy() {
      rain.length = 0;
      snow.length = 0;
      wisps.length = 0;
      puffs.length = 0;
      bolts.length = 0;
    },
  };
}
