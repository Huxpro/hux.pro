import { GLOW_FRAGMENT, GLOW_VERTEX } from "./shader";

// =============================================================================
// The glow renderer — one WebGL context for every glow on the page.
//
// A glow is small and there can be many (a badge under the pointer, a field
// listening, the About's whole screen), and a browser keeps only a handful of
// WebGL contexts alive before it starts dropping the oldest. So there is one
// context, on a canvas that is never in the document, and every glow is an
// *instance*: a plain 2D canvas in the page that the renderer draws the shader
// into and then copies across (`drawImage` in the same task, before the
// WebGL buffer is presented and cleared).
//
// One `requestAnimationFrame` loop serves every instance, and it runs only
// while some instance is live — arriving, on, or leaving — and the tab is
// visible. An instance scrolled off screen is skipped (the component watches
// it with an IntersectionObserver). When a device cannot hold 60 fps the loop
// drops to every other frame, and every few seconds tries full rate again
// (border-beam / voice-glow's pacing): the glow's own dynamics are far slower
// than 30 Hz, and a steady half rate reads better than a ragged full one.
// =============================================================================

export interface GlowUniforms {
  /** Canvas px per CSS px for this instance. */
  scale: number;
  time: number;
  reveal: number;
  surge: number;
  radius: number;
  width: number;
  bleed: number;
  dark: number;
  strength: number;
  level: number;
  bands: readonly [number, number, number];
  focus: number;
  focusAt: number;
  /** 1 for the line shape: focus along the bottom edge. */
  line: number;
  /** -1 to mirror top to bottom (a line along the top edge), else 1. */
  flip: number;
  /** Where the light must end, px off the side / top-bottom edges; 0,0 = no limit. */
  extent: readonly [number, number];
  /** Seconds the beams have travelled — `time` while they flow, held while a pulse breathes. */
  wave: number;
  /** Ring units the palette is turned by (a rotation carries its colours round). */
  hue: number;
  /** Reach × this in each quarter of the ring (right, bottom, left, top): a pulse's breath. */
  breath: readonly [number, number, number, number];
  /** 0 to draw only the halo past the edge (a pulse outside), else 1. */
  inside: number;
  /** 1: the light deepens toward the focus centre (a rotation's arc). */
  swell: number;
  /** Nothing is moving: once drawn, the frame can stand until this clears. */
  hold?: boolean;
}

export interface GlowInstance {
  /** The canvas in the page the glow is copied into. */
  canvas: HTMLCanvasElement;
  /** On screen (or close to it). An instance off screen is not drawn. */
  visible: boolean;
  /**
   * Called once per frame while the instance is live. Returns the uniforms
   * to draw with, or null when the instance has finished (faded out): its
   * canvas is cleared and it stops being drawn until `wake()` is called.
   */
  frame: (now: number, dt: number) => GlowUniforms | null;
  /** Set by the renderer once a `hold` frame is on the canvas; clear it to
   *  force a redraw (the component does on a resize). */
  held?: boolean;
}

const UNIFORMS = [
  "uRes",
  "uScale",
  "uTime",
  "uReveal",
  "uSurge",
  "uRadius",
  "uWidth",
  "uBleed",
  "uDark",
  "uStrength",
  "uLevel",
  "uBands",
  "uFocus",
  "uFocusAt",
  "uLine",
  "uFlip",
  "uExtent",
  "uWave",
  "uHue",
  "uBreath",
  "uInside",
  "uSwell",
] as const;

type Uniform = (typeof UNIFORMS)[number];

interface Context {
  gl: WebGLRenderingContext;
  canvas: HTMLCanvasElement;
  u: Record<Uniform, WebGLUniformLocation | null>;
}

let ctx: Context | null | undefined;
const live = new Set<GlowInstance>();
const idle = new Set<GlowInstance>();
let raf = 0;
let last = 0;

// Pacing (see the header).
const SLOW_GAP = 22;
const SLOW_FOR = 500;
const PROBE_EVERY = 4000;
let half = false;
let skip = false;
let slowSince = 0;
let probeAt = 0;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn("[glow]", gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

function create(): Context | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
  });
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, GLOW_VERTEX);
  const fs = compile(gl, gl.FRAGMENT_SHADER, GLOW_FRAGMENT);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.clearColor(0, 0, 0, 0);
  const u = {} as Context["u"];
  for (const name of UNIFORMS) u[name] = gl.getUniformLocation(program, name);
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    ctx = undefined; // recreated on the next frame
  });
  return { gl, canvas, u };
}

/** Whether glows can be drawn here at all. Creates the context on first ask. */
export function glowSupported(): boolean {
  if (ctx === undefined) ctx = create();
  return ctx !== null;
}

function draw(c: Context, inst: GlowInstance, f: GlowUniforms) {
  const target = inst.canvas;
  const w = Math.max(1, Math.round(target.clientWidth * f.scale));
  const h = Math.max(1, Math.round(target.clientHeight * f.scale));
  if (target.width !== w || target.height !== h) {
    target.width = w;
    target.height = h;
  }
  const { gl, canvas, u } = c;
  // The shared canvas only grows, so a frame of many sizes does not
  // reallocate it per instance; each draws into its bottom-left corner.
  if (canvas.width < w || canvas.height < h) {
    canvas.width = Math.max(canvas.width, w);
    canvas.height = Math.max(canvas.height, h);
  }
  gl.viewport(0, 0, w, h);
  gl.uniform2f(u.uRes, w, h);
  gl.uniform1f(u.uScale, f.scale);
  gl.uniform1f(u.uTime, f.time);
  gl.uniform1f(u.uReveal, f.reveal);
  gl.uniform1f(u.uSurge, f.surge);
  gl.uniform1f(u.uRadius, f.radius);
  gl.uniform1f(u.uWidth, f.width);
  gl.uniform1f(u.uBleed, f.bleed);
  gl.uniform1f(u.uDark, f.dark);
  gl.uniform1f(u.uStrength, f.strength);
  gl.uniform1f(u.uLevel, f.level);
  gl.uniform3f(u.uBands, f.bands[0], f.bands[1], f.bands[2]);
  gl.uniform1f(u.uFocus, f.focus);
  gl.uniform1f(u.uFocusAt, f.focusAt);
  gl.uniform1f(u.uLine, f.line);
  gl.uniform1f(u.uFlip, f.flip);
  gl.uniform2f(u.uExtent, f.extent[0], f.extent[1]);
  gl.uniform1f(u.uWave, f.wave);
  gl.uniform1f(u.uHue, f.hue);
  gl.uniform4f(u.uBreath, f.breath[0], f.breath[1], f.breath[2], f.breath[3]);
  gl.uniform1f(u.uInside, f.inside);
  gl.uniform1f(u.uSwell, f.swell);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  const out = target.getContext("2d");
  if (!out) return;
  out.clearRect(0, 0, w, h);
  // WebGL's origin is bottom-left: the viewport sits at the bottom of the
  // shared canvas, which in image coordinates is its last `h` rows.
  out.drawImage(canvas, 0, canvas.height - h, w, h, 0, 0, w, h);
}

function clear(inst: GlowInstance) {
  inst.canvas.getContext("2d")?.clearRect(0, 0, inst.canvas.width, inst.canvas.height);
}

function tick(now: number) {
  raf = 0;
  if (live.size === 0 || document.hidden) return;
  raf = requestAnimationFrame(tick);

  const gap = last ? now - last : 16;
  last = now;
  if (half) {
    skip = !skip;
    if (skip) return;
    if (now >= probeAt) {
      half = false;
      slowSince = 0;
    }
  } else if (gap > SLOW_GAP) {
    if (!slowSince) slowSince = now;
    else if (now - slowSince > SLOW_FOR) {
      half = true;
      probeAt = now + PROBE_EVERY;
    }
  } else {
    slowSince = 0;
  }

  if (ctx === undefined) ctx = create();
  const c = ctx;
  const dt = Math.min(0.05, (half ? gap * 2 : gap) / 1000);
  for (const inst of live) {
    const f = inst.frame(now, dt);
    if (!f) {
      clear(inst);
      live.delete(inst);
      idle.add(inst);
      continue;
    }
    if (!c || !inst.visible) continue;
    if (f.hold && inst.held) continue;
    draw(c, inst, f);
    inst.held = !!f.hold;
  }
}

function kick() {
  if (!raf && live.size > 0 && typeof document !== "undefined" && !document.hidden) {
    last = 0;
    raf = requestAnimationFrame(tick);
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", kick);
}

/** Register an instance; it starts idle. Returns the unregister function. */
export function registerGlow(inst: GlowInstance): () => void {
  idle.add(inst);
  return () => {
    live.delete(inst);
    idle.delete(inst);
  };
}

/** Make an instance live: it is drawn every frame until `frame` returns null. */
export function wakeGlow(inst: GlowInstance) {
  if (!idle.has(inst) && !live.has(inst)) return;
  idle.delete(inst);
  inst.held = false;
  live.add(inst);
  kick();
}
