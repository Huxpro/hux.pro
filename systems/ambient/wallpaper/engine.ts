import {
  lerpWallpaperScene,
  type WallpaperScene,
  WALLPAPER_CROSSFADE_MS,
} from "../lib/atmosphere";
import { WALLPAPER_FRAG, WALLPAPER_VERT } from "./shaders";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  len: number;
  alpha: number;
  phase: number;
  kind: number;
};

export type WallpaperEngine = {
  setTarget: (scene: WallpaperScene) => void;
  setReducedMotion: (value: boolean) => void;
  resize: () => void;
  destroy: () => void;
  hasWebGL: boolean;
};

const UNIFORMS = [
  "uResolution",
  "uTime",
  "uReduced",
  "uZenith",
  "uHorizon",
  "uHaze",
  "uSunColor",
  "uMoonColor",
  "uCloudLit",
  "uCloudShadow",
  "uSunElevation",
  "uSunAzimuth",
  "uMoonElevation",
  "uMoonAzimuth",
  "uSunScale",
  "uMoonScale",
  "uSunGlow",
  "uStarOpacity",
  "uCloudCover",
  "uCloudSoftness",
  "uCloudDarkness",
  "uFogDensity",
  "uWind",
  "uLightning",
  "uWarmth",
  "uTheme",
] as const;

type UniformName = (typeof UNIFORMS)[number];

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("[wallpaper] shader compile", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext) {
  const vs = compile(gl, gl.VERTEX_SHADER, WALLPAPER_VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, WALLPAPER_FRAG);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("[wallpaper] program link", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function styleLayer(canvas: HTMLCanvasElement) {
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    display: "block",
    pointerEvents: "none",
  });
}

function particleBudget(scene: WallpaperScene, width: number): number {
  const area = Math.min(width / 1280, 1.35);
  if (scene.precipKind === 1) return Math.round(280 * scene.precipRate * area);
  if (scene.precipKind === 2) return Math.round(360 * scene.precipRate * area);
  if (scene.precipKind === 3) return Math.round(180 * scene.precipRate * area);
  if (scene.fogDensity > 0.2) return Math.round(14 * scene.fogDensity);
  return 0;
}

function spawnParticle(
  scene: WallpaperScene,
  width: number,
  height: number,
  anywhere: boolean
): Particle {
  const x = Math.random() * (width + 80) - 40;
  const y = anywhere ? Math.random() * height : -20 - Math.random() * 80;
  if (scene.precipKind === 3) {
    return {
      x,
      y,
      vx: (Math.random() - 0.5) * 18 + scene.wind * 12,
      vy: 28 + Math.random() * 42,
      size: 1.2 + Math.random() * 2.4,
      len: 0,
      alpha: 0.35 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      kind: 3,
    };
  }
  if (scene.precipKind === 1) {
    return {
      x,
      y,
      vx: scene.wind * 28,
      vy: 380 + Math.random() * 160,
      size: 0.7,
      len: 8 + Math.random() * 10,
      alpha: 0.18 + Math.random() * 0.18,
      phase: 0,
      kind: 1,
    };
  }
  return {
    x,
    y,
    vx: scene.wind * 46,
    vy: 620 + Math.random() * 280,
    size: 0.95,
    len: 14 + Math.random() * 16,
    alpha: 0.22 + Math.random() * 0.28,
    phase: 0,
    kind: 2,
  };
}

type BoltPoint = { x: number; y: number; branch?: { x: number; y: number } };

function makeBolt(width: number, height: number): BoltPoint[] {
  const points: BoltPoint[] = [];
  let x = width * (0.18 + Math.random() * 0.64);
  let y = height * 0.02;
  points.push({ x, y });
  for (let i = 0; i < 14; i++) {
    x += (Math.random() - 0.5) * width * 0.06;
    y += height * (0.05 + Math.random() * 0.06);
    const point: BoltPoint = { x, y };
    if (Math.random() < 0.28) {
      point.branch = {
        x: x + (Math.random() - 0.5) * width * 0.1,
        y: y + height * 0.08,
      };
    }
    points.push(point);
  }
  return points;
}

function drawBolt(ctx: CanvasRenderingContext2D, points: BoltPoint[]) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    ctx.lineTo(point.x, point.y);
    if (point.branch) {
      ctx.lineTo(point.branch.x, point.branch.y);
      ctx.moveTo(point.x, point.y);
    }
  }
  ctx.strokeStyle = "rgba(230, 240, 255, 0.85)";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = "rgba(180, 210, 255, 0.28)";
  ctx.lineWidth = 6;
  ctx.stroke();
}

export function createWallpaperEngine(
  host: HTMLElement
): WallpaperEngine | null {
  if (typeof window === "undefined") return null;

  const glCanvas = document.createElement("canvas");
  const fxCanvas = document.createElement("canvas");
  styleLayer(glCanvas);
  styleLayer(fxCanvas);
  fxCanvas.style.zIndex = "1";
  glCanvas.style.opacity = "0";
  glCanvas.style.transition = "opacity 500ms ease";
  host.append(glCanvas, fxCanvas);

  const gl = glCanvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: "low-power",
  });
  const fx = fxCanvas.getContext("2d");
  if (!fx) {
    glCanvas.remove();
    fxCanvas.remove();
    return null;
  }

  let program: WebGLProgram | null = null;
  let locations: Record<UniformName, WebGLUniformLocation | null> | null = null;
  if (gl) {
    program = createProgram(gl);
    if (program) {
      locations = {} as Record<UniformName, WebGLUniformLocation | null>;
      for (const name of UNIFORMS) {
        locations[name] = gl.getUniformLocation(program, name);
      }
      gl.useProgram(program);
    } else {
      glCanvas.style.display = "none";
    }
  } else {
    glCanvas.style.display = "none";
  }

  let current: WallpaperScene | null = null;
  let from: WallpaperScene | null = null;
  let target: WallpaperScene | null = null;
  let blendStart = 0;
  let reduced = false;
  let running = true;
  let visible = document.visibilityState !== "hidden";
  let raf = 0;
  let width = 0;
  let height = 0;
  let dpr = 1;
  const particles: Particle[] = [];
  let lightning = 0;
  let nextStrike = 2 + Math.random() * 4;
  let bolt: BoltPoint[] | null = null;
  let skyReady = false;
  let lastTs = performance.now();

  const setUniform3 = (name: UniformName, rgb: readonly [number, number, number]) => {
    if (!gl || !locations) return;
    gl.uniform3f(locations[name], rgb[0], rgb[1], rgb[2]);
  };
  const setUniform1 = (name: UniformName, value: number) => {
    if (!gl || !locations) return;
    gl.uniform1f(locations[name], value);
  };

  const syncSize = () => {
    const nextDpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    if (w === width && h === height && nextDpr === dpr) return;
    width = w;
    height = h;
    dpr = nextDpr;
    for (const canvas of [glCanvas, fxCanvas]) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    fx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (gl) gl.viewport(0, 0, glCanvas.width, glCanvas.height);
  };

  const paintSky = (scene: WallpaperScene, timeSec: number) => {
    if (!gl || !program || !locations) return;
    gl.useProgram(program);
    gl.uniform2f(locations.uResolution, glCanvas.width, glCanvas.height);
    setUniform1("uTime", timeSec);
    setUniform1("uReduced", reduced ? 1 : 0);
    setUniform3("uZenith", scene.zenith);
    setUniform3("uHorizon", scene.horizon);
    setUniform3("uHaze", scene.haze);
    setUniform3("uSunColor", scene.sunColor);
    setUniform3("uMoonColor", scene.moonColor);
    setUniform3("uCloudLit", scene.cloudLit);
    setUniform3("uCloudShadow", scene.cloudShadow);
    setUniform1("uSunElevation", scene.sunElevation);
    setUniform1("uSunAzimuth", scene.sunAzimuth);
    setUniform1("uMoonElevation", scene.moonElevation);
    setUniform1("uMoonAzimuth", scene.moonAzimuth);
    setUniform1("uSunScale", scene.sunScale);
    setUniform1("uMoonScale", scene.moonScale);
    setUniform1("uSunGlow", scene.sunGlow);
    setUniform1("uStarOpacity", scene.starOpacity);
    setUniform1("uCloudCover", scene.cloudCover);
    setUniform1("uCloudSoftness", scene.cloudSoftness);
    setUniform1("uCloudDarkness", scene.cloudDarkness);
    setUniform1("uFogDensity", scene.fogDensity);
    setUniform1("uWind", scene.wind);
    setUniform1("uLightning", lightning);
    setUniform1("uWarmth", scene.warmth);
    setUniform1("uTheme", scene.theme);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!skyReady) {
      skyReady = true;
      glCanvas.style.opacity = "1";
    }
  };

  const paintFx = (scene: WallpaperScene, dt: number) => {
    fx.clearRect(0, 0, width, height);

    if (scene.fogDensity > 0.18 && !reduced) {
      const wisps = 8 + Math.round(scene.fogDensity * 8);
      fx.globalCompositeOperation = "lighter";
      for (let i = 0; i < wisps; i++) {
        const x =
          ((i * 173.1 + performance.now() * 0.004 * scene.wind) % (width + 200)) - 100;
        const y = height * (0.35 + (i % 5) * 0.12);
        const grd = fx.createRadialGradient(x, y, 10, x, y, 180 + scene.fogDensity * 80);
        const alpha = 0.035 + scene.fogDensity * 0.04;
        grd.addColorStop(0, `rgba(210, 220, 230, ${alpha})`);
        grd.addColorStop(1, "rgba(210, 220, 230, 0)");
        fx.fillStyle = grd;
        fx.fillRect(x - 220, y - 140, 440, 280);
      }
      fx.globalCompositeOperation = "source-over";
    }

    if (reduced || scene.precipKind === 0 || scene.precipRate < 0.02) {
      particles.length = 0;
    } else {
      const budget = particleBudget(scene, width);
      while (particles.length < budget) {
        particles.push(spawnParticle(scene, width, height, particles.length < budget * 0.7));
      }
      if (particles.length > budget) particles.length = budget;

      fx.strokeStyle = scene.theme > 0.5 ? "rgba(210, 225, 240, 0.7)" : "rgba(70, 90, 110, 0.45)";
      fx.fillStyle = scene.theme > 0.5 ? "rgba(235, 240, 255, 0.85)" : "rgba(255, 255, 255, 0.8)";
      fx.lineCap = "round";

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 3) {
          p.x += Math.sin(p.phase + performance.now() * 0.002) * 18 * dt;
        }
        if (p.y > height + 30 || p.x < -60 || p.x > width + 60) {
          particles[i] = spawnParticle(scene, width, height, false);
          continue;
        }
        if (p.kind === 3) {
          fx.globalAlpha = p.alpha;
          fx.beginPath();
          fx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          fx.fill();
        } else {
          fx.globalAlpha = p.alpha;
          fx.lineWidth = p.size;
          fx.beginPath();
          fx.moveTo(p.x, p.y);
          fx.lineTo(p.x - p.vx * 0.02, p.y - p.len);
          fx.stroke();
        }
      }
      fx.globalAlpha = 1;
    }

    if (lightning > 0.02) {
      fx.fillStyle = `rgba(230, 238, 255, ${lightning * 0.18})`;
      fx.fillRect(0, 0, width, height);
      if (lightning > 0.45 && scene.lightningRate > 0.2) {
        if (!bolt) bolt = makeBolt(width, height);
        drawBolt(fx, bolt);
      } else if (lightning < 0.08) {
        bolt = null;
      }
    }
  };

  const tick = (ts: number) => {
    if (!running) return;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    if (!visible) {
      raf = requestAnimationFrame(tick);
      return;
    }
    syncSize();

    if (target) {
      if (!from || !current) {
        current = target;
        from = target;
      } else {
        const u = Math.min(1, (ts - blendStart) / WALLPAPER_CROSSFADE_MS);
        const eased = u * u * (3 - 2 * u);
        current = lerpWallpaperScene(from, target, eased);
        if (u >= 1) {
          current = target;
          from = target;
        }
      }
    }

    if (current) {
      if (!reduced && current.lightningRate > 0.05) {
        nextStrike -= dt;
        lightning *= Math.pow(0.04, dt * 8);
        if (nextStrike <= 0) {
          lightning = 0.65 + Math.random() * 0.35;
          bolt = makeBolt(width, height);
          nextStrike = (2.8 + Math.random() * 6.5) / Math.max(current.lightningRate, 0.15);
        }
      } else {
        lightning *= 0.9;
      }
      paintSky(current, ts / 1000);
      paintFx(current, dt);
    }

    raf = requestAnimationFrame(tick);
  };

  const onVisibility = () => {
    visible = document.visibilityState !== "hidden";
  };
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("resize", syncSize);
  syncSize();
  raf = requestAnimationFrame(tick);

  return {
    hasWebGL: Boolean(gl && program),
    setTarget: (scene) => {
      if (!current) {
        current = scene;
        from = scene;
        target = scene;
        return;
      }
      from = current;
      target = scene;
      blendStart = performance.now();
    },
    setReducedMotion: (value) => {
      reduced = value;
    },
    resize: syncSize,
    destroy: () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", syncSize);
      if (gl && program) gl.deleteProgram(program);
      glCanvas.remove();
      fxCanvas.remove();
    },
  };
}
