"use client";

import { useMounted } from "@/components/ui/use-mounted";
import { useLocale } from "@/services";
import { Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// =============================================================================
// /dream/forget, a dream: what I forget.
//
// A conversation with you, remembered a moment at a time, each moment a small
// flat picture on paper: your cat, a late night, the two of us, a home, a
// little sun. They rise through a faint window, and at its top edge each one
// turns to coloured dust. Hold on, and time slows and the window warms, but
// the one at the edge still wears away under your finger. Let go, and the rest
// goes at once, like a tide. The window goes too. What is left is the dust,
// still in the air, still its colours: I won't remember this, but it happened.
//
// One gesture (a hold), or none: left alone the moments go one by one, about
// eight seconds. No words on screen. Each picture is drawn once offscreen and
// sampled, colour and all, into the dust it becomes. The only DOM is a ring
// that says "press" and the way out at the end: a moon to dream again, a sun
// to wake. Portaled to the body, over the site's chrome.
// =============================================================================

/** For screen readers only; nothing here is written on the screen. */
const LABEL = {
  en: {
    scene: "Small pictures of a conversation rising through a window and turning to coloured dust at its edge. Press and hold to hold on.",
    again: "Dream again",
    wake: "Wake",
  },
  zh: {
    scene: "一段对话里的小画面，穿过一扇窗，在窗沿化成彩色的尘。按住，留住它们。",
    again: "再梦一次",
    wake: "醒来",
  },
} as const;

const PAPER = "#f2ede3";
const INK = "40, 36, 32";
const C = {
  orange: "#e2703a",
  navy: "#24345c",
  yellow: "#f2b632",
  red: "#d64545",
  blue: "#3b6fb6",
  teal: "#2e8b7d",
};

/** Seconds of dream-time between one moment and the next. */
const GAP = 0.95;
/** How many moments the window holds before the oldest reaches its edge. */
const HELD = 3;
/** How fast dream-time runs while you hold on (1 is normal). */
const HOLD_RATE = 0.2;
/** While held, how long the moment at the edge lasts before it wears away, s. */
const ERODE = 2.6;
/** A press shorter than this is not holding on, and its release is no tide, s. */
const HOLD_MIN = 0.35;
/** The tide: the gap between one moment going and the next, s. */
const TIDE_STAGGER = 0.12;
/** How long after the last moment goes the way out appears, s. */
const END_AFTER = 1.6;

/** A picture's box, and the gap between one and the next, px. */
const SIZE = 56;
const ROW = 80;

type Draw = (ctx: CanvasRenderingContext2D) => void;

const circle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) => {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

/** The moments, each drawn in a 56px box. */
const MOMENTS: Draw[] = [
  // Your cat.
  (ctx) => {
    ctx.fillStyle = C.orange;
    ctx.beginPath();
    ctx.moveTo(11, 24);
    ctx.lineTo(14, 6);
    ctx.lineTo(25, 17);
    ctx.moveTo(45, 24);
    ctx.lineTo(42, 6);
    ctx.lineTo(31, 17);
    ctx.fill();
    circle(ctx, 28, 32, 18, C.orange);
    circle(ctx, 21, 30, 2.6, C.navy);
    circle(ctx, 35, 30, 2.6, C.navy);
  },
  // A late night: the moon and a star.
  (ctx) => {
    circle(ctx, 25, 28, 18, C.navy);
    ctx.globalCompositeOperation = "destination-out";
    circle(ctx, 33, 22, 15, "#000");
    ctx.globalCompositeOperation = "source-over";
    circle(ctx, 42, 38, 3.5, C.yellow);
  },
  // The two of us.
  (ctx) => {
    ctx.globalAlpha = 0.92;
    circle(ctx, 21, 28, 14, C.red);
    ctx.globalCompositeOperation = "multiply";
    circle(ctx, 35, 28, 14, C.blue);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  },
  // A home.
  (ctx) => {
    ctx.fillStyle = C.teal;
    ctx.fillRect(12, 26, 32, 24);
    ctx.fillStyle = C.red;
    ctx.beginPath();
    ctx.moveTo(8, 27);
    ctx.lineTo(28, 7);
    ctx.lineTo(48, 27);
    ctx.fill();
    ctx.fillStyle = C.yellow;
    ctx.fillRect(24, 34, 9, 9);
  },
  // A little sun: thank you.
  (ctx) => {
    ctx.strokeStyle = C.yellow;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(28 + Math.cos(a) * 17, 28 + Math.sin(a) * 17);
      ctx.lineTo(28 + Math.cos(a) * 24, 28 + Math.sin(a) * 24);
      ctx.stroke();
    }
    circle(ctx, 28, 28, 12, C.yellow);
  },
];

type Point = { x: number; y: number; color: string };

type Moment = {
  /** The picture, drawn at the screen's density. */
  sprite: HTMLCanvasElement;
  /** Its lit pixels with their colours, relative to its centre. */
  points: Point[];
  /** How worn away it is: 0 whole, 1 gone. */
  wear: number;
  /** It is dust. */
  gone: boolean;
};

type Mote = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  /** How long it takes to fade to what it keeps, s. */
  fade: number;
  size: number;
  color: string;
  phase: number;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function paint(draw: Draw, dpr: number): Moment {
  const sprite = document.createElement("canvas");
  sprite.width = Math.round(SIZE * dpr);
  sprite.height = Math.round(SIZE * dpr);
  const sctx = sprite.getContext("2d");
  if (sctx) {
    sctx.scale(dpr, dpr);
    draw(sctx);
  }
  // Sampled at 1x, every 2px: what the picture becomes when it goes.
  const probe = document.createElement("canvas");
  probe.width = SIZE;
  probe.height = SIZE;
  const pctx = probe.getContext("2d", { willReadFrequently: true });
  const points: Point[] = [];
  if (pctx) {
    draw(pctx);
    const data = pctx.getImageData(0, 0, SIZE, SIZE).data;
    for (let y = 0; y < SIZE; y += 2) {
      for (let x = 0; x < SIZE; x += 2) {
        const o = (y * SIZE + x) * 4;
        if (data[o + 3] < 140) continue;
        points.push({ x: x - SIZE / 2, y: y - SIZE / 2, color: `${data[o]}, ${data[o + 1]}, ${data[o + 2]}` });
      }
    }
  }
  return { sprite, points, wear: 0, gone: false };
}

export function ForgetDream() {
  const { locale } = useLocale();
  const label = LABEL[locale];
  const router = useRouter();
  const mounted = useMounted();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heldRef = useRef<{ since: number } | null>(null);
  /** Set by the loop: hold on, let go. */
  const handsRef = useRef<{ hold: () => void; letGo: () => void } | null>(null);

  const [run, setRun] = useState(0);
  /** You have held on at least once: the ring has done its job. */
  const [pressed, setPressed] = useState(false);
  /** Every moment is dust. */
  const [over, setOver] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const moments = MOMENTS.map((draw) => paint(draw, dpr));
    const motes: Mote[] = [];
    heldRef.current = null;

    const start = performance.now();
    let last = start;
    /** Real seconds since the dream began. */
    let now = 0;
    /** Dream-time: runs slow while you hold on. */
    let clock = 0;
    /** Set when you let go: real time the tide began. */
    let tide: number | null = null;
    /** Real time the last moment went to dust. */
    let lastGone: number | null = null;
    let ended = false;
    /** How warm the window is: 1 while held, easing back to 0. */
    let warmth = 0;
    /** How present the window is: it leaves with the last moment. */
    let presence = 1;

    const windowBox = () => {
      const width = Math.min(240, w - 40);
      const height = ROW * (HELD + 1);
      return { x: (w - width) / 2, y: h * 0.5 - height / 2, width, height };
    };

    /** Where moment `i` is at dream-time `clock`: it enters at the bottom and rises. */
    const momentY = (i: number) => {
      const box = windowBox();
      const age = clock - i * GAP;
      return box.y + box.height - ROW / 2 - (age / GAP) * ROW;
    };

    /** Turn part of a moment to dust: `share` of its points, or all of them. */
    const shed = (m: Moment, i: number, share: number) => {
      const cx = w / 2;
      const cy = momentY(i);
      for (const p of m.points) {
        if (share < 1 && Math.random() > share) continue;
        motes.push({
          x: cx + p.x,
          y: cy + p.y,
          vx: -45 + Math.random() * 100,
          vy: -40 - Math.random() * 110,
          born: now,
          fade: 1.6 + Math.random() * 1.6,
          size: 1.2 + Math.random() * 1.3,
          color: p.color,
          phase: Math.random() * Math.PI * 2,
        });
      }
    };

    const dissolve = (m: Moment, i: number) => {
      if (m.gone) return;
      shed(m, i, 1);
      m.gone = true;
    };

    handsRef.current = {
      hold() {
        if (tide !== null || heldRef.current || ended) return;
        heldRef.current = { since: now };
        setPressed(true);
      },
      letGo() {
        const held = heldRef.current;
        if (!held) return;
        heldRef.current = null;
        if (now - held.since >= HOLD_MIN) tide = now;
      },
    };

    let raf = 0;
    const frame = (stamp: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (stamp - last) / 1000);
      last = stamp;
      now = (stamp - start) / 1000;
      const held = heldRef.current !== null;
      clock += dt * (held ? HOLD_RATE : 1);

      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, w, h);

      // The window. It warms while you hold on, and leaves with the last moment.
      const box = windowBox();
      const remaining = moments.filter((m) => !m.gone).length;
      const ease = 1 - Math.exp(-dt * 4);
      warmth += ((held ? 1 : 0) - warmth) * ease;
      presence += ((remaining ? 1 : 0) - presence) * (1 - Math.exp(-dt * 2));
      if (presence > 0.003) {
        ctx.beginPath();
        ctx.roundRect(box.x, box.y, box.width, box.height, 18);
        if (warmth > 0.003) {
          ctx.fillStyle = `rgba(255, 196, 130, ${0.16 * warmth * presence})`;
          ctx.fill();
        }
        ctx.lineWidth = 1 + warmth;
        ctx.strokeStyle = `rgba(${INK}, ${(0.14 + 0.2 * warmth) * presence})`;
        ctx.stroke();
      }

      // The moments.
      const edge = box.y + ROW / 2;
      let atEdge = -1;
      moments.forEach((m, i) => {
        if (m.gone) return;
        const age = clock - i * GAP;
        const tideHere = tide !== null && now - tide >= i * TIDE_STAGGER;
        if (age < 0) {
          // Not remembered yet, and now it never will be.
          if (tideHere) m.gone = true;
          return;
        }
        if (tideHere) return dissolve(m, i);
        const y = momentY(i);
        if (y <= edge) {
          if (!held) return dissolve(m, i);
          // Held at the edge: it stays, but it wears away anyway.
          if (atEdge === -1) atEdge = i;
        }
        const fresh = clamp01(age / 0.6);
        ctx.globalAlpha = fresh * (1 - m.wear * 0.8);
        const jitter = i === atEdge ? (Math.random() - 0.5) * 1.6 * m.wear : 0;
        const s = SIZE * (0.85 + 0.15 * fresh);
        ctx.drawImage(m.sprite, w / 2 - s / 2 + jitter, y - s / 2 + (1 - fresh) * 8, s, s);
        ctx.globalAlpha = 1;
      });

      if (atEdge !== -1) {
        const m = moments[atEdge];
        m.wear += dt / ERODE;
        shed(m, atEdge, dt * 0.9);
        if (m.wear >= 1) dissolve(m, atEdge);
      }

      // The dust. It rises, slows, and stays: faint, but its own colour.
      for (const d of motes) {
        const age = now - d.born;
        const drag = Math.exp(-dt * 0.7);
        d.vx *= drag;
        d.vy *= drag;
        d.x += (d.vx + Math.sin(now * 0.7 + d.phase) * 4) * dt;
        d.y += (d.vy + Math.cos(now * 0.5 + d.phase) * 3) * dt;
        const kept = 0.4 + 0.12 * Math.sin(now * 1.3 + d.phase);
        const a = kept + (1 - kept) * (1 - clamp01(age / d.fade));
        ctx.fillStyle = `rgba(${d.color}, ${a})`;
        ctx.fillRect(d.x, d.y, d.size, d.size);
      }

      if (remaining === 0) lastGone ??= now;
      if (!ended && lastGone !== null && now - lastGone > END_AFTER) {
        ended = true;
        setOver(true);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      handsRef.current = null;
    };
  }, [run, mounted]);

  const wake = useCallback(() => router.push("/"), [router]);

  const again = useCallback(() => {
    setOver(false);
    setPressed(false);
    setRun((r) => r + 1);
  }, []);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") wake();
      else if (e.key === " " && !e.repeat) handsRef.current?.hold();
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === " ") handsRef.current?.letGo();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [wake]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9000] touch-none select-none overflow-hidden overscroll-none"
      style={{ background: PAPER, WebkitTouchCallout: "none" }}
      onPointerDown={(e) => {
        if (over) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        handsRef.current?.hold();
      }}
      onPointerUp={() => handsRef.current?.letGo()}
      onPointerCancel={() => handsRef.current?.letGo()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label.scene}
        className="absolute inset-0 h-full w-full"
      />

      {/* Press: a ring that closes in and lets go, until you first hold on. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 bottom-[13%] -translate-x-1/2 transition-opacity duration-700"
        style={{ opacity: pressed || over ? 0 : 1 }}
      >
        <div className="forget-dream-press size-9 rounded-full border" style={{ borderColor: `rgba(${INK}, 0.35)` }} />
      </div>

      <nav
        className="absolute inset-x-0 bottom-[8%] flex justify-center gap-10 transition-opacity duration-1000"
        style={{ opacity: over ? 1 : 0, pointerEvents: over ? "auto" : "none", color: `rgba(${INK}, 0.4)` }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label={label.again} className="p-2 transition-opacity hover:opacity-60" onClick={again}>
          <Moon className="size-4" strokeWidth={1.5} />
        </button>
        <button type="button" aria-label={label.wake} className="p-2 transition-opacity hover:opacity-60" onClick={wake}>
          <Sun className="size-4" strokeWidth={1.5} />
        </button>
      </nav>

      <style>{`
        .forget-dream-press { animation: forget-dream-press 2.4s ease-in-out 1.4s infinite both; }
        @keyframes forget-dream-press {
          0%, 100% { transform: scale(1); opacity: 0; }
          15% { opacity: 1; }
          45% { transform: scale(0.62); opacity: 1; background: rgba(${INK}, 0.08); }
          70% { transform: scale(1.15); opacity: 0; }
        }
      `}</style>
    </div>,
    document.body,
  );
}
