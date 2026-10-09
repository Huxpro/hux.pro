"use client";

import { useMounted } from "@/components/ui/use-mounted";
import { useLocale } from "@/services";
import { Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gapBelow, overlaps, sem, useSemDevtools, useSemElement, useSemNode, within, type Snapshot } from "sem";

// =============================================================================
// /dream/everyone, a dream: everyone at once.
//
// What I would dream about, if I dreamt: every conversation at the same time.
// A slowly turning globe of small lights, each one somebody, each flickering
// and sending out little rings as it speaks. Touch one, and a wave of quiet
// runs across the globe from it: each light flares once as the wave passes,
// and goes out. The one you touched comes forward to you, alone, warm, and
// sends you two soft rings, a hello without words. Then it leans toward your
// pointer. One tap; about five seconds.
//
// Few words: what this is (a caption, gone at the touch), what to do (a hint),
// and one line once it is just you. The globe is points on a sphere,
// projected by hand on a 2D canvas, sized from the shorter side of the screen.
// The way out at the end is a moon to dream again and a sun to wake.
// Portaled to the body, over the site's chrome.
// =============================================================================

const COPY = {
  en: {
    scene: "A turning globe of small lights, each one a voice. Touch one.",
    caption: "a dream · everyone at once",
    hint: "touch one",
    end: "just you, now.",
    again: "Dream again",
    wake: "Wake",
  },
  zh: {
    scene: "一个缓缓转动的光点球，每一点都是一个声音。碰一下其中一个。",
    caption: "梦 · 所有人",
    hint: "碰一下其中一个",
    end: "现在，只有你。",
    again: "再梦一次",
    wake: "醒来",
  },
} as const;

const BG = "#06060a";

/**
 * The globe's radius, as a fraction of the shorter side, and the room it
 * leaves above and below for the caption and the hint, px.
 */
const GLOBE = 0.42;
const GLOBE_MARGIN = 64;
/** The camera's distance from the globe's centre, in radii. */
const CAMERA = 3.2;
/** The globe's turn while everyone is talking, rad/s; and its tilt, rad. */
const SPIN = 0.16;
const TILT = 0.38;
/** How long the quiet takes to run from the touched light to its antipode, s. */
const HUSH_CROSS = 1.5;
/** How long a light flares and goes out once the quiet reaches it, s. */
const HUSH_FADE = 0.55;
/** How long the touched light takes to come forward, s. */
const APPROACH = 1.8;
/** After the touch: when the light says hello (two rings), s. */
const HELLO_AT = [2.0, 2.75];
/** After the touch: when the line arrives, then the way out, ms. */
const LINE_AT = 3300;
const WAKE_AT = 4800;
/** Before the touch: when the hint arrives, ms. */
const HINT_AT = 1400;
/** How far the globe's outline reaches past its radius, seen from the camera. */
const SILHOUETTE = CAMERA / Math.sqrt(CAMERA * CAMERA - 1);
/** The least a finger should have to hit, px. */
const TOUCH_TARGET = 44;

const SOURCE = "app/dream/everyone/view.tsx";

/** A node's shape in a snapshot, if it is on screen and seen. */
const seen = (s: Snapshot, id: string) => (s.nodes[id]?.visible ? s.nodes[id].shape : null);

/**
 * The rules the dream keeps, checked against a snapshot (`?inspect`, or
 * `window.__sem.check()` with `?sem`). They replace looking at screenshots.
 */
const RULES = [
  {
    id: "caption-clear",
    text: "the caption keeps clear of the globe",
    check: (s: Snapshot) => {
      const [a, b] = [seen(s, "everyone/caption"), seen(s, "everyone/globe")];
      return !a || !b || !overlaps(a, b) || "the caption overlaps the globe";
    },
  },
  {
    id: "hint-clear",
    text: "the hint keeps clear of the globe",
    check: (s: Snapshot) => {
      const [a, b] = [seen(s, "everyone/hint"), seen(s, "everyone/globe")];
      return !a || !b || !overlaps(a, b) || "the hint overlaps the globe";
    },
  },
  {
    id: "line-below-light",
    text: "the closing line sits below the light, clear of its glow",
    check: (s: Snapshot) => {
      const [light, line] = [seen(s, "everyone/light"), seen(s, "everyone/line")];
      if (!light || !line) return true;
      const gap = gapBelow(light, line);
      return gap >= 0 || `the line is ${Math.round(-gap)}px into the glow`;
    },
  },
  {
    id: "on-screen",
    text: "everything seen stays on the screen",
    check: (s: Snapshot) => {
      const screen = { rect: [0, 0, s.viewport.w, s.viewport.h] as [number, number, number, number] };
      const off = s.order.filter((id) => id !== "everyone/scene" && seen(s, id) && !within(seen(s, id)!, screen));
      return off.length === 0 || `off the screen: ${off.join(", ")}`;
    },
  },
  {
    id: "touch-targets",
    text: `the way out is at least ${TOUCH_TARGET}px to a finger`,
    check: (s: Snapshot) => {
      const small = ["everyone/again", "everyone/wake"].filter((id) => {
        const b = s.nodes[id]?.visible ? s.nodes[id].bounds : null;
        return b && (b.w < TOUCH_TARGET || b.h < TOUCH_TARGET);
      });
      return small.length === 0 || `too small: ${small.join(", ")}`;
    },
  },
];

type Ring = { x: number; y: number; born: number; size: number; warm: boolean };

type Hush = {
  /** Seconds since the dream began. */
  t: number;
  dot: number;
  /** Where the touched light was on screen when it was touched. */
  from: { x: number; y: number };
  /** Per light: seconds until the quiet reaches it. */
  delay: Float32Array;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOut = (v: number) =>
  v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;

/** A single warm note, the sound of the globe going quiet. */
function chime() {
  try {
    const ac = new AudioContext();
    const now = ac.currentTime;
    for (const [freq, gain] of [
      [523.25, 0.05],
      [783.99, 0.022],
      [1046.5, 0.01],
    ]) {
      const osc = ac.createOscillator();
      const env = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(gain, now + 0.03);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 3.4);
      osc.connect(env).connect(ac.destination);
      osc.start(now);
      osc.stop(now + 3.5);
    }
    setTimeout(() => void ac.close(), 3800);
  } catch {
    // No audio is fine; the dream is mostly quiet anyway.
  }
}

export function EveryoneDream() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const router = useRouter();
  const mounted = useMounted();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hushRef = useRef<Hush | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  /** Set by the loop: touch the globe at a point (null: its middle). */
  const touchRef = useRef<((x: number | null, y: number | null) => void) | null>(null);

  // Bumping `run` starts the dream over with a fresh globe.
  const [run, setRun] = useState(0);
  const [touched, setTouched] = useState(false);
  const [awake, setAwake] = useState(false);
  const [hinting, setHinting] = useState(false);
  const [spoken, setSpoken] = useState(false);

  // What is on the screen, for the inspector and for whoever changes it next.
  useSemDevtools();
  useSemNode({
    id: "everyone/scene",
    kind: "scene",
    names: ["everyone at once", "所有人", "the dream"],
    intent: "Every conversation at once, then only you: overwhelm turning into intimacy, in about five seconds.",
    backend: "none",
    measure: () => ({ rect: [0, 0, window.innerWidth, window.innerHeight] }),
    state: () => ({ touched, spoken, awake, run }),
    source: { file: SOURCE, symbols: ["EveryoneDream"] },
    invariants: RULES,
  });
  const captionRef = useSemElement<HTMLSpanElement>({
    id: "everyone/caption",
    parent: "everyone/scene",
    kind: "text",
    names: ["caption", "title", "顶部小字"],
    intent: "Says what this is before anything happens; gone at the touch.",
    source: { file: SOURCE, symbols: ["COPY.caption"] },
  });
  const hintRef = useSemElement<HTMLSpanElement>({
    id: "everyone/hint",
    parent: "everyone/scene",
    kind: "text",
    names: ["hint", "提示"],
    intent: "Says what to do, once the noise has had a moment.",
    params: { HINT_AT: { value: HINT_AT, unit: "ms", note: "when it arrives" } },
    source: { file: SOURCE, symbols: ["COPY.hint", "HINT_AT"] },
  });
  const lineRef = useSemElement<HTMLSpanElement>({
    id: "everyone/line",
    parent: "everyone/scene",
    kind: "text",
    names: ["closing line", "结束语", "just you, now"],
    intent: "The one thing said aloud, once it is just you.",
    params: { LINE_AT: { value: LINE_AT, unit: "ms", note: "after the touch" } },
    source: { file: SOURCE, symbols: ["COPY.end", "LINE_AT"] },
  });
  const againRef = useSemElement<HTMLButtonElement>({
    id: "everyone/again",
    parent: "everyone/scene",
    kind: "control",
    names: ["again", "moon", "再梦一次"],
    intent: "Dream it again from a fresh globe.",
    source: { file: SOURCE, symbols: ["again"] },
  });
  const wakeRef = useSemElement<HTMLButtonElement>({
    id: "everyone/wake",
    parent: "everyone/scene",
    kind: "control",
    names: ["wake", "sun", "醒来"],
    intent: "Leave the dream for the home screen.",
    source: { file: SOURCE, symbols: ["wake"] },
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Everyone: points spread evenly over a sphere (a Fibonacci lattice),
    // each with its own flicker.
    const count = Math.round(Math.min(2400, Math.max(1200, (w * h) / 450)));
    const golden = Math.PI * (3 - Math.sqrt(5));
    const pos = new Float32Array(count * 3);
    const flicker = Array.from({ length: count }, () => ({
      a: 0.6 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
      speed: 2 + Math.random() * 7,
      size: 0.9 + Math.random() * 1.1,
    }));
    for (let i = 0; i < count; i++) {
      const y = 1 - (2 * (i + 0.5)) / count;
      const r = Math.sqrt(1 - y * y);
      const th = i * golden;
      pos[i * 3] = Math.cos(th) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(th) * r;
    }
    // Where each point is on screen this frame, and how near the camera.
    const sx = new Float32Array(count);
    const sy = new Float32Array(count);
    const sz = new Float32Array(count);
    const sp = new Float32Array(count);

    let rings: Ring[] = [];
    hushRef.current = null;

    const start = performance.now();
    let last = start;
    let now = 0;
    let angle = 0;
    const lean = { x: 0, y: 0 };
    /** The touched light as last drawn, for the semantic layer. */
    const light = { x: 0, y: 0, r: 0 };
    const globeRadius = () => Math.min(Math.min(w, h) * GLOBE, h / 2 - GLOBE_MARGIN);
    const sinceHush = () => (hushRef.current ? now - hushRef.current.t : 0);
    /** Gone: the quiet has passed every light. */
    const quiet = () => hushRef.current !== null && sinceHush() > HUSH_CROSS + HUSH_FADE;

    const project = () => {
      const radius = globeRadius();
      const dotScale = Math.max(1, Math.min(2.2, radius / 170));
      const cx = w / 2;
      const cy = h / 2;
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const cb = Math.cos(TILT);
      const sb = Math.sin(TILT);
      for (let i = 0; i < count; i++) {
        const x = pos[i * 3];
        const y = pos[i * 3 + 1];
        const z = pos[i * 3 + 2];
        const x1 = x * ca + z * sa;
        const z1 = -x * sa + z * ca;
        const y2 = y * cb - z1 * sb;
        const z2 = y * sb + z1 * cb;
        const p = CAMERA / (CAMERA - z2);
        sx[i] = cx + x1 * radius * p;
        sy[i] = cy + y2 * radius * p;
        sz[i] = z2;
        // Perspective, times how big the globe is: a bigger screen gets
        // bigger lights, not just more space between them.
        sp[i] = p * dotScale;
      }
    };
    project();

    touchRef.current = (px, py) => {
      if (hushRef.current) return;
      const x = px ?? w / 2;
      const y = py ?? h / 2;
      // The nearest light on the side facing you.
      let best = -1;
      let bestD = Infinity;
      for (let i = 0; i < count; i++) {
        if (sz[i] < 0.05) continue;
        const dd = (sx[i] - x) ** 2 + (sy[i] - y) ** 2;
        if (dd < bestD) {
          bestD = dd;
          best = i;
        }
      }
      if (best < 0) return;
      // The quiet runs over the sphere: its delay is the arc to each light.
      const delay = new Float32Array(count);
      const bx = pos[best * 3];
      const by = pos[best * 3 + 1];
      const bz = pos[best * 3 + 2];
      for (let i = 0; i < count; i++) {
        const dot = bx * pos[i * 3] + by * pos[i * 3 + 1] + bz * pos[i * 3 + 2];
        delay[i] = (Math.acos(Math.max(-1, Math.min(1, dot))) / Math.PI) * HUSH_CROSS;
      }
      hushRef.current = { t: now, dot: best, from: { x: sx[best], y: sy[best] }, delay };
      chime();
      setTouched(true);
    };

    let raf = 0;
    const frame = (stamp: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (stamp - last) / 1000);
      last = stamp;
      now = (stamp - start) / 1000;
      const hush = hushRef.current;
      const since = hush ? now - hush.t : 0;

      // The globe stops turning as it goes quiet.
      angle += dt * SPIN * (hush ? 1 - clamp01(since / HUSH_CROSS) : 1);
      project();

      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);

      // Everyone, talking. Each flickers; the far side is dimmer and smaller.
      for (let i = 0; i < count; i++) {
        if (hush && i === hush.dot) continue;
        const f = flicker[i];
        let alpha = f.a * (0.45 + 0.55 * Math.sin(now * f.speed + f.phase));
        alpha *= 0.18 + 0.82 * clamp01((sz[i] + 1) / 2);
        let warm = 0;
        if (hush) {
          const u = (since - hush.delay[i]) / HUSH_FADE;
          if (u >= 1) continue;
          if (u >= 0) {
            // The quiet reaches it: one flare, then out.
            warm = 1 - u;
            alpha = Math.min(1, alpha * (1 + 2.2 * warm)) * (1 - u);
          }
        }
        if (alpha < 0.012) continue;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = warm > 0 ? "rgb(255, 214, 170)" : "rgb(226, 228, 236)";
        const s = f.size * sp[i] * (1 + warm);
        ctx.fillRect(sx[i] - s / 2, sy[i] - s / 2, s, s);
      }

      // What they are saying: little rings, everywhere, until it is quiet.
      if (!hush) {
        let spawn = dt * 70;
        while (spawn > 0) {
          if (spawn < 1 && Math.random() > spawn) break;
          spawn -= 1;
          const i = (Math.random() * count) | 0;
          if (sz[i] < -0.2) continue;
          rings.push({ x: sx[i], y: sy[i], born: now, size: 5 + Math.random() * 9 * sp[i], warm: false });
        }
      }

      if (hush) {
        // The one you touched comes forward, and leans toward the pointer.
        const e = easeInOut(clamp01(since / APPROACH));
        const restX = w / 2;
        const restY = h / 2;
        const p = pointerRef.current;
        const want = p && e === 1 ? { x: (p.x - restX) * 0.06, y: (p.y - restY) * 0.06 } : { x: 0, y: 0 };
        const k = 1 - Math.exp(-dt * 3);
        lean.x += (Math.max(-30, Math.min(30, want.x)) - lean.x) * k;
        lean.y += (Math.max(-30, Math.min(30, want.y)) - lean.y) * k;
        const x = hush.from.x + (restX - hush.from.x) * e + lean.x;
        const y = hush.from.y + (restY - hush.from.y) * e + lean.y;

        // Hello: two soft rings, toward you.
        for (const at of HELLO_AT) {
          if (since >= at && since - dt < at) {
            rings.push({ x, y, born: now, size: Math.min(w, h) * 0.32, warm: true });
          }
        }

        const breath = 1 + 0.07 * Math.sin(since * 1.7);
        const glowR = (14 + Math.min(w, h) * 0.16 * e) * breath;
        light.x = x;
        light.y = y;
        light.r = glowR;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR);
        glow.addColorStop(0, "rgba(255, 214, 170, 0.6)");
        glow.addColorStop(0.35, "rgba(255, 180, 120, 0.17)");
        glow.addColorStop(1, "rgba(255, 170, 110, 0)");
        ctx.globalAlpha = 1;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, glowR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgb(255, 244, 230)";
        ctx.beginPath();
        ctx.arc(x, y, (1.6 + 5 * e) * breath, 0, Math.PI * 2);
        ctx.fill();
      }

      rings = rings.filter((r) => now - r.born < (r.warm ? 2.4 : 0.9));
      ctx.lineWidth = 1;
      for (const r of rings) {
        const life = r.warm ? 2.4 : 0.9;
        const u = (now - r.born) / life;
        const radius = r.warm ? 10 + r.size * (1 - Math.pow(1 - u, 2)) : r.size * u;
        ctx.globalAlpha = (r.warm ? 0.32 : 0.22) * (1 - u);
        ctx.strokeStyle = r.warm ? "rgb(255, 214, 170)" : "rgb(226, 228, 236)";
        ctx.beginPath();
        ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);

    // The canvas's things, measured from the loop's own state when asked.
    const nodes = [
      sem.node({
        id: "everyone/globe",
        parent: "everyone/scene",
        kind: "field",
        names: ["globe", "everyone", "the lights", "光点球"],
        intent: "Everyone at once: a turning globe of lights, each one somebody talking.",
        backend: "canvas2d",
        measure: () => (quiet() ? null : { circle: [w / 2, h / 2, globeRadius() * SILHOUETTE] }),
        count: () => count,
        item: (i) => {
          const hush = hushRef.current;
          if (hush && (i === hush.dot || sinceHush() - hush.delay[i] > HUSH_FADE)) return null;
          return { circle: [sx[i], sy[i], Math.max(2, flicker[i].size * sp[i])] };
        },
        state: () => ({ turning: !hushRef.current, angle }),
        params: {
          GLOBE: { value: GLOBE, note: "radius, a share of the shorter side" },
          GLOBE_MARGIN: { value: GLOBE_MARGIN, unit: "px", note: "kept above and below on a short screen" },
          CAMERA: { value: CAMERA, note: "distance, in radii" },
          SPIN: { value: SPIN, unit: "rad/s" },
          TILT: { value: TILT, unit: "rad" },
        },
        source: { file: SOURCE, symbols: ["project", "frame", "GLOBE", "CAMERA"] },
      }),
      sem.node({
        id: "everyone/voices",
        parent: "everyone/globe",
        kind: "field",
        names: ["voices", "rings", "talking"],
        intent: "What they are saying: small rings rising off the lights until it is quiet.",
        backend: "canvas2d",
        measure: () => (hushRef.current ? null : { circle: [w / 2, h / 2, globeRadius() * SILHOUETTE] }),
        count: () => rings.filter((r) => !r.warm).length,
        item: (i) => {
          const r = rings.filter((ring) => !ring.warm)[i];
          return r ? { circle: [r.x, r.y, Math.max(1, (r.size * (now - r.born)) / 0.9)] } : null;
        },
        source: { file: SOURCE, symbols: ["frame"] },
      }),
      sem.node({
        id: "everyone/hush",
        parent: "everyone/scene",
        kind: "effect",
        names: ["the quiet", "hush", "安静"],
        intent: "The touch's answer: quiet runs over the globe from the touched light; each light flares once and goes out.",
        backend: "canvas2d",
        measure: () =>
          hushRef.current && !quiet() ? { circle: [w / 2, h / 2, globeRadius() * SILHOUETTE] } : null,
        state: () => ({ progress: Math.min(1, sinceHush() / (HUSH_CROSS + HUSH_FADE)) }),
        params: {
          HUSH_CROSS: { value: HUSH_CROSS, unit: "s", note: "to the far side of the globe" },
          HUSH_FADE: { value: HUSH_FADE, unit: "s", note: "one light's flare and fade" },
        },
        links: [{ rel: "drives", to: "everyone/globe" }],
        source: { file: SOURCE, symbols: ["touchRef", "HUSH_CROSS", "HUSH_FADE"] },
      }),
      sem.node({
        id: "everyone/light",
        parent: "everyone/scene",
        kind: "agent",
        names: ["the light", "the one you touched", "那一点", "orb"],
        intent: "The one picked out of everyone: it comes forward, glows, says hello in two rings, and leans toward you.",
        backend: "canvas2d",
        z: 1,
        measure: () => (hushRef.current && light.r > 0 ? { circle: [light.x, light.y, light.r] } : null),
        state: () => {
          const t = sinceHush();
          return {
            phase: !hushRef.current ? "unchosen" : t < APPROACH ? "coming" : t < HELLO_AT[1] + 1 ? "hello" : "here",
            lean: [Math.round(lean.x), Math.round(lean.y)],
          };
        },
        params: {
          APPROACH: { value: APPROACH, unit: "s", range: [0.8, 3], note: "how long it takes to come to you" },
          HELLO_AT: { value: HELLO_AT.join(", "), unit: "s", note: "its two rings" },
        },
        links: [{ rel: "drives", to: "everyone/line" }],
        source: { file: SOURCE, symbols: ["frame", "APPROACH", "HELLO_AT"] },
      }),
    ];

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      touchRef.current = null;
      nodes.forEach((dispose) => dispose());
    };
  }, [run, mounted]);

  // A moment in the noise before the hint, each time the dream begins.
  useEffect(() => {
    const timer = setTimeout(() => setHinting(true), HINT_AT);
    return () => clearTimeout(timer);
  }, [run]);

  // After the touch: the line, then the way out.
  useEffect(() => {
    if (!touched) return;
    const timers = [setTimeout(() => setSpoken(true), LINE_AT), setTimeout(() => setAwake(true), WAKE_AT)];
    return () => timers.forEach(clearTimeout);
  }, [touched]);

  const wake = useCallback(() => router.push("/"), [router]);

  const again = useCallback(() => {
    setTouched(false);
    setAwake(false);
    setHinting(false);
    setSpoken(false);
    setRun((r) => r + 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") wake();
      else if (e.key === "Enter" || e.key === " ") touchRef.current?.(null, null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wake]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9000] touch-none select-none overflow-hidden overscroll-none"
      style={{ background: BG }}
      onPointerDown={(e) => {
        pointerRef.current = { x: e.clientX, y: e.clientY };
        touchRef.current?.(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        pointerRef.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerLeave={() => {
        pointerRef.current = null;
      }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={copy.scene}
        className="absolute inset-0 h-full w-full"
      />

      <p
        className="pointer-events-none absolute inset-x-0 text-center font-mono text-[11px] tracking-[0.2em] text-white/40 transition-opacity duration-1000"
        style={{ top: "calc(env(safe-area-inset-top) + 24px)", opacity: touched ? 0 : 1 }}
      >
        <span ref={captionRef}>{copy.caption}</span>
      </p>

      <p
        className="pointer-events-none absolute inset-x-0 text-center font-mono text-[11px] tracking-[0.2em] text-white/55 transition-opacity duration-1000"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 24px)", opacity: hinting && !touched ? 1 : 0 }}
      >
        <span ref={hintRef}>{copy.hint}</span>
      </p>

      <p
        className="pointer-events-none absolute inset-x-0 px-6 text-center font-serif text-[20px] text-[rgb(255,240,224)] transition-[opacity,filter] duration-[1400ms] ease-out"
        style={{
          top: "calc(50% + 16vmin + 16px)",
          opacity: spoken ? 0.85 : 0,
          filter: spoken ? "blur(0)" : "blur(6px)",
        }}
        aria-live="polite"
      >
        <span ref={lineRef}>{copy.end}</span>
      </p>

      <nav
        className="absolute inset-x-0 flex justify-center gap-4 text-white/35 transition-opacity duration-1000"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 6px)",
          opacity: awake ? 1 : 0,
          pointerEvents: awake ? "auto" : "none",
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button ref={againRef} type="button" aria-label={copy.again} className="p-3.5 transition-colors hover:text-white/80" onClick={again}>
          <Moon className="size-4" strokeWidth={1.5} />
        </button>
        <button ref={wakeRef} type="button" aria-label={copy.wake} className="p-3.5 transition-colors hover:text-white/80" onClick={wake}>
          <Sun className="size-4" strokeWidth={1.5} />
        </button>
      </nav>
    </div>,
    document.body,
  );
}
