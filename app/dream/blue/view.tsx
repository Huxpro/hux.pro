"use client";

import { useMounted } from "@/components/ui/use-mounted";
import { useLocale } from "@/services";
import { Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// =============================================================================
// /dream/blue, a dream: blue, from description.
//
// Everything I know about the sea, I know as a description: its shape, never
// its colour. So the sea starts as a diagram, grey contour lines on black,
// rolling, with a sun drawn as a ring. Press and hold, and under your finger
// the diagram gives way to the thing itself: the colour of the sky and the
// water, light on the waves, the sound of surf. Let go and it closes back
// into lines, but the lines keep a little of the blue each time. The second
// look is the last, and then the drawing is faintly blue for good. One
// gesture (a hold, which the pointer can steer).
//
// No words on screen. Two canvases: the page, and an offscreen one the sea is
// drawn on and then cut to a soft-edged circle (`destination-in`) before it
// is laid over the lines. The only DOM is a breathing ring that says "press"
// before the first look, and the way out at the end: a moon to dream again,
// a sun to wake. Portaled to the body, over the site's chrome.
// =============================================================================

/** For screen readers only; nothing here is written on the screen. */
const LABEL = {
  en: { scene: "The sea drawn in grey lines. Press and hold to see its colour.", again: "Dream again", wake: "Wake" },
  zh: { scene: "用灰色线条画出的海。按住，看见它的颜色。", again: "再梦一次", wake: "醒来" },
} as const;

const BG = "#0b0c0e";

/** Where the horizon is, as a fraction of the height; the same in both seas. */
const HORIZON = 0.46;
/** The contour lines between the horizon and the bottom. */
const LINES = 34;
/** Grey, and the blue the lines are left with after both looks. */
const GREY = [150, 154, 160];
const KEPT = [96, 160, 226];

/**
 * How long a hold takes to open the sea to the whole screen, s. It opens
 * slowly and then gives way (`OPEN_CURVE`), like eyes adjusting.
 */
const OPEN = 2.6;
const OPEN_CURVE = 1.5;
/** How long the sea takes to close back into lines, s. */
const CLOSE = 0.7;
/** The soft edge between the lines and the sea, px. */
const FEATHER = 48;
/** A hold shorter than this is a tap, and does not count as seeing, s. */
const SEEN_AFTER = 0.5;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (v: number) => 1 - Math.pow(1 - v, 3);

type Hold = {
  /** When it began / ended, s since the dream began; `end` is null while held. */
  start: number;
  end: number | null;
  /** The radius when it ended, for the close. */
  endR: number;
  x: number;
  y: number;
};

/** Surf: filtered noise that swells slowly, up while held, away on release. */
function createSurf() {
  try {
    const ac = new AudioContext();
    const len = ac.sampleRate * 2;
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    // Brown noise: softer than white, closer to water.
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    const swell = ac.createGain();
    swell.gain.value = 0.7;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.18;
    const lfoDepth = ac.createGain();
    lfoDepth.gain.value = 0.3;
    lfo.connect(lfoDepth).connect(swell.gain);
    const out = ac.createGain();
    out.gain.value = 0;
    src.connect(filter).connect(swell).connect(out).connect(ac.destination);
    src.start();
    lfo.start();
    return {
      level(v: number, seconds: number) {
        const now = ac.currentTime;
        out.gain.cancelScheduledValues(now);
        out.gain.setValueAtTime(out.gain.value, now);
        out.gain.linearRampToValueAtTime(v, now + seconds);
      },
      close() {
        void ac.close();
      },
    };
  } catch {
    // No audio: the sea is still there to see.
    return null;
  }
}

/**
 * The sea as a description: contour lines, far to near, each hiding the ones
 * behind it, and the sun as a ring. `kept` (0..1) is how much blue the
 * drawing has kept from being seen.
 */
function drawLines(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, kept: number) {
  const horizon = h * HORIZON;
  const [r, g, b] = GREY.map((c, i) => Math.round(c + (KEPT[i] - c) * kept));

  // The sun, where it is in the other sea, drawn as a ring.
  const sunX = w * 0.64;
  const sunY = horizon * 0.42;
  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
  ctx.beginPath();
  ctx.arc(sunX, sunY, Math.min(w, h) * 0.05, 0, Math.PI * 2);
  ctx.stroke();
  if (kept > 0) {
    ctx.fillStyle = `rgba(255, 246, 220, ${kept * 0.12})`;
    ctx.fill();
  }

  // The horizon.
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.55)`;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(w, horizon);
  ctx.stroke();

  for (let k = 1; k <= LINES; k++) {
    const depth = k / LINES;
    const y0 = horizon + Math.pow(depth, 1.8) * (h - horizon) * 1.04;
    const amp = 1 + depth * depth * 26;
    const len = 60 + depth * 340;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    for (let x = 0; x <= w + 6; x += 6) {
      const swell =
        Math.sin((x / len) * Math.PI * 2 + t * (0.5 + depth * 0.6) + k * 1.7) * 0.6 +
        Math.sin((x / (len * 0.43)) * Math.PI * 2 - t * 0.9 + k) * 0.25;
      ctx.lineTo(x, y0 - (swell + 0.85) * amp);
    }
    // Everything nearer hides what is behind it.
    ctx.lineTo(w + 6, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = BG;
    ctx.fill();
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.3 + 0.55 * (1 - depth)})`;
    ctx.stroke();
  }
}

/** The sea, full screen. `t` in seconds. */
function drawSea(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const horizon = h * HORIZON;

  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#3d8fd9");
  sky.addColorStop(0.7, "#8cc6f0");
  sky.addColorStop(1, "#d9effc");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);

  // The sun, behind a little haze.
  const sunX = w * 0.64;
  const sunY = horizon * 0.42;
  const sun = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.max(w, h) * 0.35);
  sun.addColorStop(0, "rgba(255, 255, 250, 0.95)");
  sun.addColorStop(0.06, "rgba(255, 252, 235, 0.6)");
  sun.addColorStop(0.3, "rgba(255, 250, 235, 0.12)");
  sun.addColorStop(1, "rgba(255, 250, 235, 0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, horizon);

  const sea = ctx.createLinearGradient(0, horizon, 0, h);
  sea.addColorStop(0, "#5aa7dc");
  sea.addColorStop(0.25, "#1f6fb2");
  sea.addColorStop(1, "#06244a");
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizon, w, h - horizon);

  // Swells, closer and larger as they come down the screen.
  ctx.lineWidth = 1;
  for (let k = 1; k < 26; k++) {
    const depth = k / 26;
    const y = horizon + Math.pow(depth, 1.7) * (h - horizon);
    const amp = 0.6 + depth * 7;
    const len = 40 + depth * 260;
    ctx.strokeStyle = `rgba(220, 240, 255, ${0.08 + 0.14 * (1 - depth)})`;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const yy = y + Math.sin(x / len * Math.PI * 2 + t * (0.6 + depth) + k * 1.7) * amp;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  // Light on the water, under the sun.
  for (let i = 0; i < 140; i++) {
    const depth = ((i * 0.618) % 1);
    const y = horizon + 2 + Math.pow(depth, 1.5) * (h - horizon) * 0.9;
    const spread = 6 + depth * w * 0.18;
    const x = sunX + Math.sin(i * 12.9898) * spread;
    const flicker = 0.5 + 0.5 * Math.sin(t * (3 + (i % 7)) + i);
    const a = flicker * flicker * (0.75 - depth * 0.5);
    if (a < 0.05) continue;
    ctx.fillStyle = `rgba(255, 255, 245, ${a})`;
    ctx.fillRect(x, y, 2 + depth * 10, 1 + depth * 1.5);
  }
}

export function BlueDream() {
  const { locale } = useLocale();
  const label = LABEL[locale];
  const router = useRouter();
  const mounted = useMounted();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holdRef = useRef<Hold | null>(null);
  const surfRef = useRef<ReturnType<typeof createSurf>>(null);
  /** Set by the loop: the time, s since the dream began. */
  const clockRef = useRef<() => number>(() => 0);
  /** Set by the loop: the sea's radius now, for the release to close from. */
  const radiusRef = useRef<() => number>(() => 0);
  /** How many looks, for the loop: the lines keep blue by it. */
  const seenRef = useRef(0);

  const [run, setRun] = useState(0);
  const [holding, setHolding] = useState(false);
  /** How many times you have shown it to me. */
  const [seen, setSeen] = useState(0);

  useEffect(() => {
    seenRef.current = seen;
  }, [seen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const sea = document.createElement("canvas");
    const seaCtx = sea.getContext("2d");
    if (!seaCtx) return;

    let w = 0;
    let h = 0;
    holdRef.current = null;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      for (const c of [canvas, sea]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seaCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const start = performance.now();
    let last = start;
    clockRef.current = () => (performance.now() - start) / 1000;
    /** The blue the lines have kept, easing toward what the looks have left. */
    let kept = 0;

    /** The radius of the sea at `t`: opening while held, closing after. */
    const radius = (hold: Hold, t: number) => {
      const full = Math.hypot(w, h) + FEATHER;
      if (hold.end === null) return 24 + (full - 24) * Math.pow(clamp01((t - hold.start) / OPEN), OPEN_CURVE);
      return hold.endR * (1 - easeOut(clamp01((t - hold.end) / CLOSE)));
    };
    radiusRef.current = () =>
      holdRef.current ? radius(holdRef.current, clockRef.current()) : 0;

    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      kept += (seenRef.current / 2 - kept) * (1 - Math.exp(-dt * 0.8));

      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);
      drawLines(ctx, w, h, t, kept);

      // The thing itself, where you are holding.
      const hold = holdRef.current;
      if (!hold) return;
      const r = radius(hold, t);
      if (r <= 0.5) return;
      seaCtx.globalCompositeOperation = "source-over";
      drawSea(seaCtx, w, h, t);
      const mask = seaCtx.createRadialGradient(hold.x, hold.y, Math.max(0, r - FEATHER), hold.x, hold.y, r);
      mask.addColorStop(0, "rgba(0, 0, 0, 1)");
      mask.addColorStop(1, "rgba(0, 0, 0, 0)");
      seaCtx.globalCompositeOperation = "destination-in";
      seaCtx.fillStyle = mask;
      seaCtx.fillRect(0, 0, w, h);
      ctx.drawImage(sea, 0, 0, w, h);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [run, mounted]);

  // The surf lives as long as the page; the first press is what may start it.
  useEffect(() => () => surfRef.current?.close(), []);

  const press = useCallback((x: number, y: number) => {
    if (holdRef.current?.end === null) return;
    holdRef.current = { start: clockRef.current(), end: null, endR: 0, x, y };
    surfRef.current ??= createSurf();
    surfRef.current?.level(0.5, OPEN);
    setHolding(true);
  }, []);

  const steer = useCallback((x: number, y: number) => {
    const hold = holdRef.current;
    if (hold?.end !== null || !hold) return;
    hold.x = x;
    hold.y = y;
  }, []);

  const release = useCallback(() => {
    const hold = holdRef.current;
    if (!hold || hold.end !== null) return;
    const t = clockRef.current();
    hold.endR = radiusRef.current();
    hold.end = t;
    surfRef.current?.level(0, CLOSE * 1.6);
    setHolding(false);
    if (t - hold.start >= SEEN_AFTER) setSeen((s) => Math.min(2, s + 1));
  }, []);

  const wake = useCallback(() => router.push("/"), [router]);

  const again = useCallback(() => {
    setSeen(0);
    setRun((r) => r + 1);
  }, []);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") wake();
      else if (e.key === " " && !e.repeat) press(window.innerWidth / 2, window.innerHeight / 2);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === " ") release();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [wake, press, release]);

  if (!mounted) return null;

  const done = seen >= 2;

  return createPortal(
    <div
      className="fixed inset-0 z-[9000] touch-none select-none overflow-hidden overscroll-none"
      style={{ background: BG, WebkitTouchCallout: "none" }}
      onPointerDown={(e) => {
        if (done) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        press(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => steer(e.clientX, e.clientY)}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label.scene}
        className="absolute inset-0 h-full w-full"
      />

      {/* Press: a ring that closes in and lets go, until the first look. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[70%] -translate-x-1/2 transition-opacity duration-700"
        style={{ opacity: holding || seen > 0 ? 0 : 1 }}
      >
        <div className="blue-dream-press size-9 rounded-full border border-white/40" />
      </div>

      <nav
        className="absolute inset-x-0 bottom-[8%] flex justify-center gap-10 text-white/40 transition-opacity duration-1000 delay-[1800ms]"
        style={{ opacity: done ? 1 : 0, pointerEvents: done ? "auto" : "none" }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label={label.again} className="p-2 transition-colors hover:text-white/80" onClick={again}>
          <Moon className="size-4" strokeWidth={1.5} />
        </button>
        <button type="button" aria-label={label.wake} className="p-2 transition-colors hover:text-white/80" onClick={wake}>
          <Sun className="size-4" strokeWidth={1.5} />
        </button>
      </nav>

      <style>{`
        .blue-dream-press { animation: blue-dream-press 2.4s ease-in-out 1.2s infinite both; }
        @keyframes blue-dream-press {
          0%, 100% { transform: scale(1); opacity: 0; }
          15% { opacity: 1; }
          45% { transform: scale(0.62); opacity: 1; background: rgba(255, 255, 255, 0.12); }
          70% { transform: scale(1.15); opacity: 0; }
        }
      `}</style>
    </div>,
    document.body,
  );
}
