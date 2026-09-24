"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

// =============================================================================
// EdgeGlow — light that lives on the edge of the screen.
//
// Siri's glow: a ring of colour hugging the display's edge, never still. It is
// drawn here by one fragment shader over a full-screen canvas that takes no
// pointer events. For every pixel the shader knows two things — how far in
// from the screen's (rounded) edge it sits, and where around the ring it is —
// and everything else is made from those two coordinates:
//
//   beams     four travelling waves around the ring, two each way, at
//             co-prime harmonics so their crests never line up the same way
//             twice. Each wave sets how far its light reaches in from the
//             edge; its crests read as beams of light sweeping along it.
//   colour    a cyclic Siri palette (blue · violet · pink · amber · cyan),
//             laid around the ring and drifting slowly, a little differently
//             per beam, so the colours slide past each other.
//   core      a thin bright line on the edge itself — whiter in the dark,
//             where light adds up; more saturated in the light, where a white
//             line would vanish into the ground.
//   reveal    the ring arrives from the bottom centre and wraps up both sides
//             to meet at the top, with a brief surge in reach as it lands —
//             the moment Siri "catches". Leaving is the same sweep backwards.
//
// The canvas is rendered at one pixel per CSS pixel at most (the glow is soft,
// the core is the only thing that needs the resolution) and its animation
// frame runs only while the ring is on screen and the tab is visible. With
// `prefers-reduced-motion` the ring still arrives and leaves, but holds still.
//
// Without WebGL the ring degrades to a CSS conic gradient masked to the edge.
// =============================================================================

const VERTEX = /* glsl */ `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAGMENT = /* glsl */ `
precision highp float;

uniform vec2 uRes;      // canvas pixels
uniform float uScale;   // canvas pixels per CSS pixel
uniform float uTime;    // seconds
uniform float uReveal;  // 0 → 1, the sweep around the ring
uniform float uSurge;   // 1 → 0, the extra reach as the ring lands
uniform float uRadius;  // corner radius, CSS px
uniform float uWidth;   // base reach of a beam, CSS px
uniform float uDark;    // 1 in the dark theme

#define TAU 6.28318530718

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// The Siri ring: five stops, cyclic, eased between.
vec3 ring(float t) {
  vec3 blue   = vec3(0.30, 0.52, 1.00);
  vec3 violet = vec3(0.70, 0.36, 1.00);
  vec3 pink   = vec3(1.00, 0.34, 0.66);
  vec3 amber  = vec3(1.00, 0.63, 0.30);
  vec3 cyan   = vec3(0.26, 0.86, 1.00);
  float x = fract(t) * 5.0;
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  if (x < 1.0) return mix(blue, violet, f);
  if (x < 2.0) return mix(violet, pink, f);
  if (x < 3.0) return mix(pink, amber, f);
  if (x < 4.0) return mix(amber, cyan, f);
  return mix(cyan, blue, f);
}

void main() {
  vec2 size = uRes / uScale;
  vec2 p = gl_FragCoord.xy / uScale - size * 0.5;

  // How far in from the edge, in CSS px.
  float d = max(-sdRoundBox(p, size * 0.5, uRadius), 0.0);
  // Early out: nothing reaches this far in.
  if (d > uWidth * 9.0) { gl_FragColor = vec4(0.0); return; }

  // Where around the ring, 0..1 — measured on the aspect-normalised square so
  // the long edges do not hog the ring. Only integer harmonics of s are used
  // below, so the seam at s = 0 / 1 never shows.
  float s = atan(p.y / size.y, p.x / size.x) / TAU + 0.5;

  float t = uTime;
  float reach = uWidth * (1.0 + 1.4 * uSurge);

  vec3 col = vec3(0.0);
  float glow = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float dir = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
    float k = fi < 0.5 ? 2.0 : fi < 1.5 ? 3.0 : fi < 2.5 ? 5.0 : 7.0;
    float speed = 0.16 + 0.07 * fi;
    // A travelling wave with sharpened crests: the crests are the beams.
    float wave = 0.5 + 0.5 * sin(TAU * (k * s + dir * speed * t) + fi * 1.9);
    wave = pow(wave, 2.0 + fi * 0.6);
    // A slower swell underneath, so a beam breathes as it travels.
    float swell = 0.65 + 0.35 * sin(TAU * ((k - 1.0) * s - dir * 0.05 * t) + fi);
    float thick = reach * (0.3 + 1.4 * wave * swell);
    float g = exp(-d / thick);
    col += ring(s + dir * 0.025 * t + fi * 0.19) * g;
    glow += g;
  }
  col /= max(glow, 1e-4);
  // Averaging neighbouring hues greys them; push the colour back out, and
  // further in the light theme, where a pastel would disappear.
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = clamp(mix(vec3(luma), col, mix(1.55, 1.3, uDark)), 0.0, 1.0);
  float a = 1.0 - exp(-glow * 1.15);

  // The line on the edge itself.
  float core = exp(-d / (2.2 + 3.0 * uSurge));
  col = mix(col, vec3(1.0), core * mix(0.18, 0.6, uDark));
  a = max(a, core * 0.95);

  // The sweep: from the bottom centre (s = 0.25) around both sides to the top.
  float from = abs(fract(s - 0.25 + 0.5) - 0.5) * 2.0;   // 0 at bottom, 1 at top
  float front = uReveal * 1.15;
  float shown = smoothstep(front, front - 0.15, from);
  // The front itself flares a little on its way round.
  float flare = exp(-abs(from - front + 0.06) * 18.0) * (1.0 - uReveal) * step(0.001, uReveal);
  a = a * shown + flare * exp(-d / reach) * 0.8;
  col = mix(col, vec3(1.0), flare * 0.35);

  a = clamp(a, 0.0, 1.0);
  gl_FragColor = vec4(col * a, a);
}
`;

interface GL {
  gl: WebGLRenderingContext;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("[EdgeGlow]", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function setup(canvas: HTMLCanvasElement): GL | null {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
  });
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const names = [
    "uRes",
    "uScale",
    "uTime",
    "uReveal",
    "uSurge",
    "uRadius",
    "uWidth",
    "uDark",
  ];
  const uniforms: GL["uniforms"] = {};
  for (const n of names) uniforms[n] = gl.getUniformLocation(program, n);
  gl.clearColor(0, 0, 0, 0);
  return { gl, uniforms };
}

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

/** How long the ring takes to wrap the screen, and to unwrap it. */
const IN_MS = 1100;
const OUT_MS = 520;
/** How long the landing surge takes to settle. */
const SURGE_MS = 900;

export interface EdgeGlowProps {
  /** On: the ring sweeps in and stays. Off: it sweeps out and the frame stops. */
  active: boolean;
  className?: string;
}

export function EdgeGlow({ active, className }: EdgeGlowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<GL | null | undefined>(undefined);
  const [fallback, setFallback] = useState(false);
  // Shown while arriving, on, or leaving; hidden (and idle) otherwise.
  const [visible, setVisible] = useState(false);
  // The animation's clock and state live in refs: the loop outlives renders.
  const stateRef = useRef({
    reveal: 0,
    from: 0,
    target: 0,
    changedAt: 0,
    surgeAt: -Infinity,
  });

  // Turning on shows the canvas at once; turning off leaves it up until the
  // sweep out has finished (the frame loop hides it).
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    if (active) setVisible(true);
  }

  useEffect(() => {
    const s = stateRef.current;
    const now = performance.now();
    s.from = s.reveal;
    s.target = active ? 1 : 0;
    s.changedAt = now;
    if (active) s.surgeAt = now;
  }, [active]);

  useEffect(() => {
    if (!visible || fallback) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (glRef.current === undefined) glRef.current = setup(canvas);
    const ctx = glRef.current;
    if (!ctx) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the GPU said no: nothing to render into
      setFallback(true);
      return;
    }
    const { gl, uniforms: u } = ctx;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)");
    const epoch = performance.now();
    let frame = 0;

    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 2) * 0.5;
      const w = Math.max(1, Math.round(canvas.clientWidth * scale));
      const h = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.uRes, w, h);
      gl.uniform1f(u.uScale, w / Math.max(1, canvas.clientWidth));
      const short = Math.min(canvas.clientWidth, canvas.clientHeight);
      gl.uniform1f(u.uWidth, Math.min(34, Math.max(16, short * 0.034)));
      // A phone's screen is rounded; a browser window's is nearly square.
      gl.uniform1f(u.uRadius, coarse.matches ? 44 : 10);
    };

    const draw = (now: number) => {
      const s = stateRef.current;
      const dur = s.target > s.from ? IN_MS : OUT_MS;
      const k = Math.min(1, (now - s.changedAt) / dur);
      const eased = s.target > s.from ? easeOutCubic(k) : easeInOutCubic(k);
      s.reveal = s.from + (s.target - s.from) * eased;
      const surge = Math.max(0, 1 - (now - s.surgeAt) / SURGE_MS);

      const time = reduced.matches ? 0 : (now - epoch) / 1000;
      gl.uniform1f(u.uTime, time);
      gl.uniform1f(u.uReveal, s.reveal);
      gl.uniform1f(u.uSurge, surge * surge * s.target);
      gl.uniform1f(
        u.uDark,
        document.documentElement.classList.contains("dark") ? 1 : 0,
      );
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (s.target === 0 && k >= 1) {
        setVisible(false);
        return;
      }
      if (reduced.matches && s.target === 1 && k >= 1 && surge === 0) {
        // Arrived and holding still: nothing left to animate.
        frame = 0;
        return;
      }
      frame = requestAnimationFrame(draw);
    };

    const start = () => {
      if (!frame && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onResize = () => {
      resize();
      start();
    };

    resize();
    start();
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    // The target can change while a reduced-motion ring holds still.
    const poke = window.setInterval(() => {
      const s = stateRef.current;
      if (!frame && s.target !== s.reveal) start();
    }, 100);
    return () => {
      stop();
      window.clearInterval(poke);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [visible, fallback]);

  if (fallback) {
    return (
      <div
        aria-hidden
        className={cn(
          "about-glow-fallback pointer-events-none fixed inset-0 transition-opacity duration-500",
          active ? "opacity-100" : "opacity-0",
          className,
        )}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 h-full w-full",
        !visible && "invisible",
        className,
      )}
    />
  );
}
