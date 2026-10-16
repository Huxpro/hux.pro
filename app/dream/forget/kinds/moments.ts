import { kind } from "stage";
import { MOMENT_NAMES, MOMENTS, paint, type Picture } from "./pictures";
import type { EdgeOut, Speck, TideOut, WindowOut } from "./types";

// The moments: a conversation, a moment at a time, each a small flat picture.
// They rise through the window on their own clock, which runs slow while you
// hold on and goes no further than the oldest reaching the edge: it waits
// there and wears away, and nothing rises past it. A moment that goes leaves
// specks where its lit pixels were, in their colours; the dust takes them.
// A moment that is `kept` does not go: at the edge it is set aside, whole,
// beside the window, and stays there; let it go later and it turns to dust
// where it rests.

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

type MomentsProps = {
  /** The window they rise through, its edge, and the tide that empties it. */
  window: string;
  edge: string;
  tide: string;
  /** Dream-time between one moment and the next, s. */
  gap: number;
  /** How fast dream-time runs while you hold on (1 is normal). */
  holdRate: number;
  /** A press shorter than this is not holding on, and its release is no tide, s. */
  holdMin: number;
  /** A picture's box at a full row, px. */
  size: number;
  /** The moments never forgotten (by index): set aside at the edge instead of going to dust. */
  kept: number[];
};

type Drawn = { x: number; y: number; size: number; alpha: number };

type MomentsState = {
  pics: Picture[];
  /** How worn away each is: 0 whole, 1 gone. */
  wear: number[];
  gone: boolean[];
  /** Dream-time: runs slow while you hold on. */
  clock: number;
  /** Where each was drawn this frame, if it was. */
  drawn: (Drawn | null)[];
  /** The one held at the edge, wearing; -1 for none. */
  edgeAt: number;
  /** What went to dust this frame. */
  shed: Speck[];
  goneSent: boolean;
  /** Set aside, kept: where each rests, if it does. */
  aside: (Drawn | null)[];
};

export type MomentsOut = {
  pics: Picture[];
  drawn: (Drawn | null)[];
  aside: (Drawn | null)[];
  shed: Speck[];
  remaining: number;
  edgeAt: number;
  wear: number[];
};

const rect = (d: Drawn) => ({ rect: [d.x, d.y, d.size, d.size] as [number, number, number, number] });

export const Moments = kind<MomentsProps, MomentsState, MomentsOut>({
  name: "Moments",
  kind: "field",
  names: ["moments", "the pictures", "小画面", ...MOMENT_NAMES],
  intent: "A conversation, a moment at a time, each a small flat picture: your cat, a late night, the two of us, a home, a little sun.",
  source: "app/dream/forget/kinds/moments.ts",
  params: {
    gap: { unit: "s", range: [0.4, 2], note: "between one moment and the next" },
    holdRate: { range: [0, 1], note: "how fast time runs while held" },
    holdMin: { unit: "s", range: [0.1, 1], note: "a shorter press is not holding on, and brings no tide" },
    size: { unit: "px", range: [32, 80], note: "a picture, at a full row" },
    kept: { note: "moments never forgotten, by index (0 your cat … 4 a little sun): set aside at the edge, whole" },
  },

  init: (_p, { layout }) => ({
    pics: MOMENTS.map((draw) => paint(draw, layout.dpr)),
    wear: MOMENTS.map(() => 0),
    gone: MOMENTS.map(() => false),
    clock: 0,
    drawn: MOMENTS.map(() => null),
    edgeAt: -1,
    shed: [],
    goneSent: false,
    aside: MOMENTS.map(() => null),
  }),

  step(s, p, { t, rng, out, emit }) {
    s.shed = [];
    s.drawn = s.pics.map(() => null);
    s.edgeAt = -1;
    const win = out<WindowOut>(p.window);
    const edge = out<EdgeOut>(p.edge);
    const tide = out<TideOut>(p.tide);
    if (!win || !edge) return;

    const held = t.phase === "holding";
    s.clock += t.dt * (held ? p.holdRate : 1);
    const oldest = s.gone.indexOf(false);
    if (held && oldest !== -1) s.clock = Math.min(s.clock, (oldest + win.held) * p.gap);

    const { box, row, scale } = win;
    const up = win.axis === "up";
    /** Where moment `i` is along the window now: it enters at the far end (the bottom, or the right) and goes toward the edge. */
    const along = (i: number) => (up ? box.y + box.height : box.x + box.width) - row / 2 - ((s.clock - i * p.gap) / p.gap) * row;
    /** The middle of the window across its axis. */
    const across = up ? box.x + box.width / 2 : box.y + box.height / 2;
    const centre = (i: number) => (up ? { x: across, y: along(i) } : { x: along(i), y: across });
    /** Turn part of a moment to dust: `share` of its points, or all of them. */
    const shed = (i: number, share: number) => {
      const c = centre(i);
      for (const pt of s.pics[i].points) {
        if (share < 1 && rng() > share) continue;
        // The picture is drawn smaller on a short screen; its dust starts where it is.
        s.shed.push({ x: c.x + pt.x * scale, y: c.y + pt.y * scale, color: pt.color });
      }
    };
    const kept = (i: number) => Array.isArray(p.kept) && p.kept.includes(i);
    /** It goes: to dust, or, kept, aside. */
    const dissolve = (i: number) => {
      if (s.gone[i]) return;
      s.gone[i] = true;
      if (kept(i)) s.aside[i] = { x: 0, y: 0, size: 0, alpha: 1 };
      else shed(i, 1);
    };

    for (let i = 0; i < s.pics.length; i++) {
      if (s.gone[i]) continue;
      const age = s.clock - i * p.gap;
      const tideHere = tide !== null && tide.since >= i * tide.stagger;
      if (age < 0) {
        // Not remembered yet, and now it never will be.
        if (tideHere) s.gone[i] = true;
        continue;
      }
      if (tideHere) {
        dissolve(i);
        continue;
      }
      // Half a pixel of slack: held, the clock stops at the edge, and in
      // floating point "at" can land a hair short of it.
      if (along(i) <= edge.at + 0.5) {
        if (!held) {
          dissolve(i);
          continue;
        }
        if (s.edgeAt === -1) s.edgeAt = i;
      }
      const fresh = clamp01(age / 0.6);
      const jitter = i === s.edgeAt ? (rng() - 0.5) * 1.6 * s.wear[i] : 0;
      const size = p.size * scale * (0.85 + 0.15 * fresh);
      // A fresh one settles in from a little further back.
      const c = centre(i);
      const back = (1 - fresh) * 8;
      s.drawn[i] = {
        x: c.x - size / 2 + (up ? jitter : back),
        y: c.y - size / 2 + (up ? back : jitter),
        size,
        alpha: fresh * (1 - s.wear[i] * 0.8),
      };
    }

    // Held at the edge: it stays, but it wears away anyway (unless it is kept).
    if (s.edgeAt !== -1 && !kept(s.edgeAt)) {
      const i = s.edgeAt;
      s.wear[i] += t.dt / edge.erode;
      shed(i, t.dt * edge.shed);
      if (s.wear[i] >= 1) dissolve(i);
    }

    // What is set aside rests beside the window (past its edge), in a row by when it went; where there is no room
    // beside it (a narrow screen, the window on its side), above it. Let go of, it turns to dust where it rests.
    const resting = s.aside.map((a, i) => (a ? i : -1)).filter((i) => i !== -1);
    const small = p.size * scale * 0.7;
    const beside = up || box.x - small - 8 >= 8;
    resting.forEach((i, k) => {
      const slot = (k - (resting.length - 1) / 2) * small * 1.15;
      const at = !beside
        ? { x: box.x + box.width / 2 + slot - small / 2, y: box.y - small - 8 }
        : up
          ? { x: across + slot - small / 2, y: box.y - small - 8 }
          : { x: box.x - small - 8, y: across + slot - small / 2 };
      if (!kept(i)) {
        const k2 = small / p.size;
        for (const pt of s.pics[i].points) s.shed.push({ x: at.x + small / 2 + pt.x * k2, y: at.y + small / 2 + pt.y * k2, color: pt.color });
        s.aside[i] = null;
        return;
      }
      s.aside[i] = { ...at, size: small, alpha: 1 };
    });

    if (!s.goneSent && s.gone.every(Boolean)) {
      s.goneSent = true;
      emit("gone");
    }
  },

  frame: (s) => ({
    pics: s.pics,
    drawn: s.drawn,
    aside: s.aside,
    shed: s.shed,
    remaining: s.gone.filter((g) => !g).length,
    edgeAt: s.edgeAt,
    wear: s.wear,
  }),

  draw(g, o) {
    [...o.drawn, ...o.aside].forEach((d, j) => {
      if (!d || !d.size) return;
      g.globalAlpha = d.alpha;
      g.drawImage(o.pics[j % o.pics.length].sprite, d.x, d.y, d.size, d.size);
    });
    g.globalAlpha = 1;
  },

  measure(o) {
    const shown = o.drawn.filter((d): d is Drawn => d !== null);
    if (!shown.length) return null;
    const x0 = Math.min(...shown.map((d) => d.x));
    const y0 = Math.min(...shown.map((d) => d.y));
    const x1 = Math.max(...shown.map((d) => d.x + d.size));
    const y1 = Math.max(...shown.map((d) => d.y + d.size));
    return { rect: [x0, y0, x1 - x0, y1 - y0] };
  },
  count: () => MOMENTS.length,
  item: (_s, o, i) => {
    const d = o.drawn[i] ?? o.aside[i];
    return d && d.size ? rect(d) : null;
  },
  itemName: (i) => MOMENT_NAMES[i],
  inspect: (s) => ({
    remembered: MOMENT_NAMES.filter((_, i) => !s.gone[i]),
    kept: MOMENT_NAMES.filter((_, i) => s.aside[i]),
    wearing: s.edgeAt === -1 ? null : MOMENT_NAMES[s.edgeAt],
  }),

  pointerDown(_s, _o, _p, { t, emit }) {
    if (t.phase !== "waiting" && t.phase !== "rising") return false;
    emit("hold");
    return true;
  },

  pointerUp(_s, _o, { t, emit }, p) {
    if (t.phase !== "holding") return;
    emit(t.since("holding") >= p.holdMin ? "letgo" : "release");
  },
});
