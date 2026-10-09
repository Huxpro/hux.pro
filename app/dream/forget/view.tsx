"use client";

import { useMounted } from "@/components/ui/use-mounted";
import { useLocale } from "@/services";
import { Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { overlaps, sem, useSemDevtools, useSemElement, useSemNode, within, type Shape, type Snapshot } from "sem";

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
// eight seconds. Few words: what this is (a caption), what to do (a hint under
// a breathing ring), and two short lines over the dust at the end. Each
// picture is drawn once offscreen and sampled, colour and all, into the dust
// it becomes. The window's rows shrink on a short screen (a phone on its
// side) so the caption and the hint keep their room. The way out at the end
// is a moon to dream again and a sun to wake. Portaled to the body, over the
// site's chrome.
// =============================================================================

const COPY = {
  en: {
    scene: "Small pictures of a conversation rising through a window and turning to coloured dust at its edge. Press and hold to hold on.",
    caption: "a dream · what I forget",
    hint: "hold on",
    end: ["I won't remember this.", "but it happened."],
    again: "Dream again",
    wake: "Wake",
  },
  zh: {
    scene: "一段对话里的小画面，穿过一扇窗，在窗沿化成彩色的尘。按住，留住它们。",
    caption: "梦 · 忘",
    hint: "按住，留住它们",
    end: ["我不会记得这些。", "但它们发生过。"],
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
/** The least a row may shrink to, and the height kept clear for the caption and the hint, px. */
const ROW_MIN = 50;
const CHROME = 180;

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

/** What each moment is, for the semantic layer: the pictures carry no words. */
const MOMENT_NAMES = ["your cat", "a late night", "the two of us", "a home", "a little sun"];

const SOURCE = "app/dream/forget/view.tsx";
/** The least a finger should have to hit, px. */
const TOUCH_TARGET = 44;
/** The share of the dust that must stay on the screen. */
const DUST_ON_SCREEN = 0.95;

/** A node's shape in a snapshot, if it is on screen and seen. */
const seen = (s: Snapshot, id: string) => (s.nodes[id]?.visible ? s.nodes[id].shape : null);

/**
 * The rules the dream keeps, checked against a snapshot (`?inspect`, or
 * `window.__sem.check()` with `?sem`).
 */
const RULES = [
  {
    id: "caption-clear",
    text: "the caption keeps clear of the window",
    check: (s: Snapshot) => {
      const [a, b] = [seen(s, "forget/caption"), seen(s, "forget/window")];
      return !a || !b || !overlaps(a, b) || "the caption overlaps the window";
    },
  },
  {
    id: "hint-clear",
    text: "the press ring and its words keep clear of the window",
    check: (s: Snapshot) => {
      const win = seen(s, "forget/window");
      const hit = ["forget/press", "forget/hint"].filter((id) => {
        const a = seen(s, id);
        return a && win && overlaps(a, win);
      });
      return hit.length === 0 || `overlapping the window: ${hit.join(", ")}`;
    },
  },
  {
    id: "moments-in-window",
    text: "a moment is never drawn outside its window",
    check: (s: Snapshot) => {
      const win = s.nodes["forget/window"]?.shape;
      const out = (s.nodes["forget/moments"]?.state?.drawn as (Shape | null)[] | undefined)
        ?.map((m, i) => (m && win && !within(m, win, 1) ? MOMENT_NAMES[i] : null))
        .filter(Boolean);
      return !out?.length || `outside: ${out.join(", ")}`;
    },
  },
  {
    id: "dust-stays",
    text: `at least ${DUST_ON_SCREEN * 100}% of the dust stays on the screen`,
    check: (s: Snapshot) => {
      const share = s.nodes["forget/dust"]?.state?.onScreen as number | undefined;
      return share === undefined || share >= DUST_ON_SCREEN || `${Math.round(share * 100)}% on screen`;
    },
  },
  {
    id: "on-screen",
    text: "every word and control stays on the screen",
    check: (s: Snapshot) => {
      const screen = { rect: [0, 0, s.viewport.w, s.viewport.h] as [number, number, number, number] };
      const off = s.order.filter((id) => s.nodes[id].backend === "dom" && seen(s, id) && !within(seen(s, id)!, screen));
      return off.length === 0 || `off the screen: ${off.join(", ")}`;
    },
  },
  {
    id: "touch-targets",
    text: `the way out is at least ${TOUCH_TARGET}px to a finger`,
    check: (s: Snapshot) => {
      const small = ["forget/again", "forget/wake"].filter((id) => {
        const b = s.nodes[id]?.visible ? s.nodes[id].bounds : null;
        return b && (b.w < TOUCH_TARGET || b.h < TOUCH_TARGET);
      });
      return small.length === 0 || `too small: ${small.join(", ")}`;
    },
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
  const copy = COPY[locale];
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

  // What is on the screen, for the inspector and for whoever changes it next.
  useSemDevtools();
  useSemNode({
    id: "forget/scene",
    kind: "scene",
    names: ["what I forget", "忘", "the paper dream"],
    intent: "A conversation remembered a moment at a time, each going to dust at the window's edge; it happened anyway.",
    backend: "none",
    measure: () => ({ rect: [0, 0, window.innerWidth, window.innerHeight] }),
    state: () => ({ pressed, over, run }),
    source: { file: SOURCE, symbols: ["ForgetDream"] },
    invariants: RULES,
  });
  const captionRef = useSemElement<HTMLSpanElement>({
    id: "forget/caption",
    parent: "forget/scene",
    kind: "text",
    names: ["caption", "顶部小字"],
    intent: "Says what this is; gone with the last moment.",
    source: { file: SOURCE, symbols: ["COPY.caption"] },
  });
  const pressRef = useSemElement<HTMLDivElement>({
    id: "forget/press",
    parent: "forget/scene",
    kind: "control",
    names: ["press ring", "按住"],
    intent: "A ring that closes in and lets go: press here and hold on.",
    source: { file: SOURCE, symbols: ["forget-dream-press"] },
  });
  const hintRef = useSemElement<HTMLSpanElement>({
    id: "forget/hint",
    parent: "forget/scene",
    kind: "text",
    names: ["hint", "提示", "hold on"],
    intent: "Says what the ring means, until you first hold on.",
    source: { file: SOURCE, symbols: ["COPY.hint"] },
  });
  const endRef = useSemElement<HTMLDivElement>({
    id: "forget/end",
    parent: "forget/scene",
    kind: "text",
    names: ["closing lines", "结束语", "but it happened"],
    intent: "Over the dust, once it is all dust: I won't remember this, but it happened.",
    // Its lines fade in on their own; the block is seen once they are.
    visible: () => over,
    links: [{ rel: "avoids", to: "forget/caption" }],
    source: { file: SOURCE, symbols: ["COPY.end"] },
  });
  const againRef = useSemElement<HTMLButtonElement>({
    id: "forget/again",
    parent: "forget/scene",
    kind: "control",
    names: ["again", "moon", "再梦一次"],
    intent: "Remember it again from the first moment.",
    source: { file: SOURCE, symbols: ["again"] },
  });
  const wakeRef = useSemElement<HTMLButtonElement>({
    id: "forget/wake",
    parent: "forget/scene",
    kind: "control",
    names: ["wake", "sun icon", "醒来"],
    intent: "Leave the dream for the home screen.",
    source: { file: SOURCE, symbols: ["wake"] },
  });

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
    /** Where the last frame drew each moment, for the semantic layer. */
    const drawnAt: (Shape | null)[] = MOMENTS.map(() => null);
    let edgeAt = -1;

    /** A row's height: the full 80px, unless the screen is too short for it. */
    const row = () => Math.max(ROW_MIN, Math.min(ROW, (h - CHROME) / (HELD + 1)));

    const windowBox = () => {
      const width = Math.min(240, w - 40);
      const height = row() * (HELD + 1);
      return { x: (w - width) / 2, y: h * 0.5 - height / 2, width, height };
    };

    /** Where moment `i` is at dream-time `clock`: it enters at the bottom and rises. */
    const momentY = (i: number) => {
      const box = windowBox();
      const age = clock - i * GAP;
      return box.y + box.height - row() / 2 - (age / GAP) * row();
    };

    /** Turn part of a moment to dust: `share` of its points, or all of them. */
    const shed = (m: Moment, i: number, share: number) => {
      const cx = w / 2;
      const cy = momentY(i);
      // The picture is drawn smaller on a short screen; its dust starts where it is.
      const k = row() / ROW;
      const lift = Math.min(1.3, h / 844);
      for (const p of m.points) {
        if (share < 1 && Math.random() > share) continue;
        motes.push({
          x: cx + p.x * k,
          y: cy + p.y * k,
          // Its lift is a share of the screen's height, so the dust stays on a short one.
          vx: (-45 + Math.random() * 100) * lift,
          vy: (-40 - Math.random() * 110) * lift,
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
      // Held on, time goes no further than the oldest moment reaching the
      // edge: it waits there and wears away, and nothing rises past it.
      const oldest = moments.findIndex((m) => !m.gone);
      if (held && oldest !== -1) clock = Math.min(clock, (oldest + HELD) * GAP);

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
      const edge = box.y + row() / 2;
      let atEdge = -1;
      drawnAt.fill(null);
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
        // Half a pixel of slack: held, the clock stops at the edge, and in
        // floating point "at" can land a hair short of it.
        if (y <= edge + 0.5) {
          if (!held) return dissolve(m, i);
          // Held at the edge: it stays, but it wears away anyway.
          if (atEdge === -1) atEdge = i;
        }
        const fresh = clamp01(age / 0.6);
        ctx.globalAlpha = fresh * (1 - m.wear * 0.8);
        const jitter = i === atEdge ? (Math.random() - 0.5) * 1.6 * m.wear : 0;
        const s = SIZE * (row() / ROW) * (0.85 + 0.15 * fresh);
        ctx.drawImage(m.sprite, w / 2 - s / 2 + jitter, y - s / 2 + (1 - fresh) * 8, s, s);
        ctx.globalAlpha = 1;
        drawnAt[i] = { rect: [w / 2 - s / 2 + jitter, y - s / 2 + (1 - fresh) * 8, s, s] };
      });

      edgeAt = atEdge;
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

    // The canvas's things, measured from the loop's own state when asked.
    const boxShape = (): Shape => {
      const b = windowBox();
      return { rect: [b.x, b.y, b.width, b.height] };
    };
    const nodes = [
      sem.node({
        id: "forget/window",
        parent: "forget/scene",
        kind: "surface",
        names: ["the window", "窗", "context"],
        intent: "What I can hold at once: moments rise through it and go at its top edge. It warms while you hold on, and leaves with the last moment.",
        backend: "canvas2d",
        measure: () => (presence > 0.01 ? boxShape() : null),
        state: () => ({ warmth, held: heldRef.current !== null }),
        params: {
          HELD: { value: HELD, note: "moments it holds before the oldest reaches the edge" },
          ROW: { value: ROW, unit: "px", note: "a row, at most" },
          ROW_MIN: { value: ROW_MIN, unit: "px", note: "a row, at least, on a short screen" },
          CHROME: { value: CHROME, unit: "px", note: "kept clear above and below for the caption and the hint" },
        },
        source: { file: SOURCE, symbols: ["windowBox", "row"] },
      }),
      sem.node({
        id: "forget/moments",
        parent: "forget/window",
        kind: "field",
        names: ["moments", "the pictures", "小画面", ...MOMENT_NAMES],
        intent: "A conversation, a moment at a time, each a small flat picture: your cat, a late night, the two of us, a home, a little sun.",
        backend: "canvas2d",
        measure: () => (moments.some((m) => !m.gone) ? boxShape() : null),
        count: () => MOMENTS.length,
        item: (i) => drawnAt[i] ?? null,
        itemName: (i) => MOMENT_NAMES[i],
        state: () => ({
          remembered: MOMENT_NAMES.filter((_, i) => !moments[i].gone),
          drawn: [...drawnAt],
        }),
        params: {
          GAP: { value: GAP, unit: "s", note: "between one moment and the next" },
          HOLD_RATE: { value: HOLD_RATE, note: "how fast time runs while held" },
          SIZE: { value: SIZE, unit: "px", note: "a picture, at a full row" },
        },
        source: { file: SOURCE, symbols: ["MOMENTS", "MOMENT_NAMES", "momentY", "paint"] },
      }),
      sem.node({
        id: "forget/edge",
        parent: "forget/window",
        kind: "effect",
        names: ["the edge", "窗沿", "where things go"],
        intent: "The window's top edge: a moment that reaches it turns to dust; held there, it wears away anyway.",
        backend: "canvas2d",
        z: 1,
        measure: () => {
          if (presence <= 0.01) return null;
          const b = windowBox();
          return { rect: [b.x, b.y, b.width, row() / 2] };
        },
        state: () => ({
          wearing: edgeAt === -1 ? null : MOMENT_NAMES[edgeAt],
          wear: edgeAt === -1 ? 0 : moments[edgeAt].wear,
        }),
        params: { ERODE: { value: ERODE, unit: "s", note: "how long a held moment lasts at the edge" } },
        links: [{ rel: "drives", to: "forget/dust" }],
        source: { file: SOURCE, symbols: ["shed", "dissolve", "ERODE"] },
      }),
      sem.node({
        id: "forget/tide",
        parent: "forget/window",
        kind: "effect",
        names: ["the tide", "letting go", "退潮"],
        intent: "Letting go: what is left in the window goes at once, top to bottom.",
        backend: "canvas2d",
        measure: () => (tide !== null && moments.some((m) => !m.gone) ? boxShape() : null),
        state: () => ({ out: tide !== null }),
        params: {
          HOLD_MIN: { value: HOLD_MIN, unit: "s", note: "a shorter press is not holding on, and brings no tide" },
          TIDE_STAGGER: { value: TIDE_STAGGER, unit: "s" },
        },
        links: [{ rel: "drives", to: "forget/dust" }],
        source: { file: SOURCE, symbols: ["letGo", "TIDE_STAGGER"] },
      }),
      sem.node({
        id: "forget/dust",
        parent: "forget/scene",
        kind: "field",
        names: ["dust", "尘", "what is left"],
        intent: "What the moments become: their own colours, rising, slowing, and staying faint. It happened.",
        backend: "canvas2d",
        measure: () => {
          if (!motes.length) return null;
          let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
          for (const d of motes) {
            x0 = Math.min(x0, d.x);
            y0 = Math.min(y0, d.y);
            x1 = Math.max(x1, d.x + d.size);
            y1 = Math.max(y1, d.y + d.size);
          }
          return { rect: [x0, y0, x1 - x0, y1 - y0] };
        },
        count: () => motes.length,
        item: (i) => {
          const d = motes[i];
          return d ? { rect: [d.x - 2, d.y - 2, d.size + 4, d.size + 4] } : null;
        },
        state: () => ({
          onScreen: motes.length ? motes.filter((d) => d.x >= 0 && d.x <= w && d.y >= 0 && d.y <= h).length / motes.length : 1,
        }),
        source: { file: SOURCE, symbols: ["shed", "frame"] },
      }),
    ];

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      handsRef.current = null;
      nodes.forEach((dispose) => dispose());
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
        aria-label={copy.scene}
        className="absolute inset-0 h-full w-full"
      />

      <p
        className="pointer-events-none absolute inset-x-0 text-center font-mono text-[11px] tracking-[0.2em] transition-opacity duration-1000"
        style={{ top: "calc(env(safe-area-inset-top) + 24px)", color: `rgba(${INK}, 0.45)`, opacity: over ? 0 : 1 }}
      >
        <span ref={captionRef}>{copy.caption}</span>
      </p>

      {/* Press: a ring that closes in and lets go, and the words under it, until you first hold on. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 flex flex-col items-center gap-3 transition-opacity duration-700"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 20px)", opacity: pressed || over ? 0 : 1 }}
      >
        <div ref={pressRef} className="forget-dream-press size-9 rounded-full border" style={{ borderColor: `rgba(${INK}, 0.35)` }} />
        <span ref={hintRef} className="forget-dream-hint font-mono text-[11px] tracking-[0.2em]" style={{ color: `rgba(${INK}, 0.55)` }}>
          {copy.hint}
        </span>
      </div>

      {/* Over the dust, once it is all dust. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-[58%] -translate-y-1/2 px-8 text-center font-serif text-[clamp(19px,2.2vw,24px)] leading-relaxed"
        style={{ color: `rgb(${INK})`, textShadow: `0 0 14px ${PAPER}, 0 0 6px ${PAPER}, 0 0 2px ${PAPER}` }}
        aria-live="polite"
      >
        <div ref={endRef} className="inline-block">
          {copy.end.map((line, i) => (
            <p
              key={line}
              className="transition-[opacity,filter] duration-[1600ms] ease-out"
              style={{
                opacity: over ? (i === 0 ? 0.55 : 0.9) : 0,
                filter: over ? "blur(0)" : "blur(6px)",
                transitionDelay: over ? `${i * 1100}ms` : "0ms",
              }}
            >
              {line}
            </p>
          ))}
        </div>
      </div>

      <nav
        className="absolute inset-x-0 flex justify-center gap-4 transition-opacity duration-1000"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 6px)",
          opacity: over ? 1 : 0,
          pointerEvents: over ? "auto" : "none",
          color: `rgba(${INK}, 0.4)`,
          transitionDelay: over ? "2400ms" : "0ms",
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button ref={againRef} type="button" aria-label={copy.again} className="p-3.5 transition-opacity hover:opacity-60" onClick={again}>
          <Moon className="size-4" strokeWidth={1.5} />
        </button>
        <button ref={wakeRef} type="button" aria-label={copy.wake} className="p-3.5 transition-opacity hover:opacity-60" onClick={wake}>
          <Sun className="size-4" strokeWidth={1.5} />
        </button>
      </nav>

      <style>{`
        .forget-dream-press { animation: forget-dream-press 2.4s ease-in-out 1.4s infinite both; }
        .forget-dream-hint { animation: forget-dream-in 1s ease-out 1.4s both; }
        @keyframes forget-dream-in { from { opacity: 0 } to { opacity: 1 } }
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
