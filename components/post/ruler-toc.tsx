"use client";

import { cn } from "@/lib/utils";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRulerSide, type RulerSide } from "./ruler-settings";

/**
 * RulerToc — a scroll-driven "ruler" table of contents for article pages.
 *
 * The ruler is a vertical measuring tape docked to a screen edge (left or
 * right, devtool-switchable), strictly centered on the viewport — screen
 * furniture, like a semantic scrollbar. Section headings are ticks; the
 * tape slides with scroll so the active section always rests at the optical
 * center. Distance from that reading line drives opacity, a slight inward
 * drift, tick length and type scale — a flat-but-dimensional dial, like a
 * physical ruler read at its index line.
 *
 * Two orthogonal "distance" axes share the same bell falloff:
 *  - Scroll distance is the dynamic near/far: how close a heading is to the
 *    reading line right now.
 *  - Tree depth is the static near/far: h1/h2 are majors (long ticks,
 *    persistent labels), h3/h4 are subs (shorter ticks, quieter labels).
 * Subs sit at their *real* scroll position between their parent major and
 * the next one, so each article's ruler is a unique fingerprint — a dense
 * cluster is a structurally busy section, a blank stretch a long narrative.
 *
 * Density is handled by a fisheye: near the reading line the tape locally
 * expands (the bell moves from styling into *spacing*), so a section's
 * subheadings unfurl as you read into them and compress when far away.
 *
 * Interaction adapts to pointer capability, not viewport width:
 *
 * Hover pointers (desktop): when the gutter is wide enough, major labels are
 * always readable near the reading line and hover brightens the rest. When
 * the gutter is tight, the ruler collapses to bare ticks; hovering reveals
 * the labels over a soft backdrop-blur veil that fades toward the content,
 * so titles can run long without fighting the text behind them.
 *
 * Touch (mobile): bare ticks, directly manipulable — press and drag to
 * scrub (labels cascade in over a frosted scrim while the tape follows the
 * finger), release to snap to the nearest tick of any level; tap to expand.
 *
 * Progress and the scrub/dial gesture live in a fractional heading-index
 * space; subheadings are display-layer fractional positions on the same
 * axis. Headings are discovered from the rendered `.prose-article` DOM
 * (h1–h4), so it works with client-generated ids and both locales.
 */

type Level = 1 | 2 | 3 | 4;

interface Heading {
  el: HTMLElement;
  label: string;
  level: Level;
}

type RulerItem =
  // A real heading. `frac` is its position on the index axis: an integer for
  // majors, a measured fraction between neighbouring majors for subs.
  | { kind: "heading"; idx: number; level: Level; frac: number }
  // Decorative tick past the first/last heading — no semantics, just the
  // "tape continues" feel at the ends.
  | { kind: "end"; frac: number };

/** Measured model emitted from the scroll loop back into React. */
interface RulerModel {
  /** Fractional index per heading (parallel to the headings array). */
  fracs: number[];
  /** Largest reachable fractional index (the last heading). */
  maxFrac: number;
}

/** Mutable flag shared between scroll-tracking and programmatic motion. */
type LockRef = { current: boolean };

/** Decorative ticks beyond the first/last heading, and their spacing. */
const END_TICKS = 3;
const END_STEP = 0.42;

/** Bell curve around 0 — the "reading line" falloff. */
function bell(d: number, spread: number) {
  return Math.exp(-(d * d) / spread);
}

/**
 * Fisheye remap of an index distance into tape units. Near the reading line
 * the local spacing swells (slope 1 + gain/width at the centre); far away it
 * relaxes to 1:1 with a constant offset. Built from tanh so the derivative is
 * 1 + (gain/width)·sech² > 0 for *any* gain — always monotonic, so rows never
 * reorder however hard we magnify. This lets a section whose whole body is
 * subheadings unfurl enough to read when the reading line is inside it.
 */
function fisheye(d: number, gain: number, width: number) {
  return d + gain * Math.tanh(d / width);
}

/** True on hover-capable fine pointers, false on touch, null before mount. */
function useHoverPointer(): boolean | null {
  const [capable, setCapable] = useState<boolean | null>(null);
  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setCapable(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return capable;
}

/** Scan the rendered article for headings (h1–h4, prose only). */
function useHeadings(): Heading[] {
  const pathname = usePathname();
  const [headings, setHeadings] = useState<Heading[]>([]);

  useEffect(() => {
    let raf = 0;
    let observer: MutationObserver | undefined;

    const scan = () => {
      const root = document.querySelector(".prose-article");
      const els = root
        ? Array.from(
            root.querySelectorAll<HTMLElement>("h1, h2, h3, h4")
          ).filter((el) => !el.closest(".not-prose"))
        : [];
      const next: Heading[] = els.map((el) => ({
        el,
        level: (Math.min(4, Math.max(1, Number(el.tagName[1]) || 2)) as Level),
        // HeadingWithLink (h1–h3) wraps text in a span next to the copy
        // button — read the span so the copied "✓" never leaks into labels.
        // Plain h4 has no span, so textContent is safe.
        label: (
          el.querySelector(":scope > span")?.textContent ??
          el.textContent ??
          ""
        ).trim(),
      }));
      setHeadings((prev) =>
        prev.length === next.length &&
        prev.every(
          (s, i) =>
            s.el === next[i].el &&
            s.label === next[i].label &&
            s.level === next[i].level
        )
          ? prev
          : next
      );
    };

    // Wait a frame so heading ids/spans from client components exist,
    // then keep watching for content swaps (e.g. language switch).
    raf = requestAnimationFrame(() => {
      scan();
      const root = document.querySelector(".prose-article");
      if (root) {
        observer = new MutationObserver(scan);
        observer.observe(root, { childList: true, subtree: true });
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [pathname]);

  return headings;
}

/**
 * Continuous reading progress in fractional heading-index space: 0 at the
 * first heading, rising to the last heading's fractional index at the bottom
 * of the page, interpolated linearly between every heading's scroll anchor.
 *
 * Majors (h1/h2) sit at integers; subs (h3/h4) sit at a fraction between
 * their parent major and the next major (or the document bottom for the
 * final section — which is what makes a section whose entire body is
 * subheadings reachable at all). Because a sub's fraction is proportional to
 * its scroll offset, adding subs as anchors is a no-op for the interior of
 * the tape and only extends interpolation through the tail.
 *
 * The measured fractions are emitted back to React via `setModel` for the
 * render layer. While `lockRef` is held (scrubbing, jumps) scroll events are
 * ignored so the gesture/animation owns the value.
 */
function useReadingProgress(
  headings: Heading[],
  progress: MotionValue<number>,
  lockRef: LockRef,
  setModel: (m: RulerModel) => void
) {
  useEffect(() => {
    if (headings.length === 0) return;

    let tops: number[] = [];
    let fracs: number[] = [];
    let maxFrac = 0;
    let docHeight = 0;
    let raf = 0;
    let init = 0;
    let prevFracs: number[] = [];
    let prevMax = -1;

    const emitIfChanged = () => {
      const changed =
        fracs.length !== prevFracs.length ||
        Math.abs(maxFrac - prevMax) > 0.002 ||
        fracs.some((f, i) => Math.abs(f - prevFracs[i]) > 0.002);
      if (!changed) return;
      prevFracs = fracs.slice();
      prevMax = maxFrac;
      setModel({ fracs: prevFracs, maxFrac });
    };

    const measure = () => {
      const scrollY = window.scrollY;
      tops = headings.map(({ el }) => el.getBoundingClientRect().top + scrollY);
      docHeight = document.documentElement.scrollHeight;

      // Assign each heading to a major index; collect major offsets.
      const majorTops: number[] = [];
      const majorOf: number[] = [];
      let mi = -1;
      headings.forEach((h, k) => {
        if (h.level <= 2) {
          mi++;
          majorTops.push(tops[k]);
        }
        majorOf[k] = mi;
      });

      fracs = headings.map((h, k) => {
        if (h.level <= 2) return majorOf[k];
        const m = majorOf[k];
        if (m < 0) return 0; // sub before any major (rare) — pin to start
        const parentTop = majorTops[m];
        const nextTop =
          m + 1 < majorTops.length ? majorTops[m + 1] : docHeight;
        const denom = Math.max(nextTop - parentTop, 1);
        const t = Math.min(0.985, Math.max(0.015, (tops[k] - parentTop) / denom));
        return m + t;
      });
      maxFrac = fracs.length ? fracs[fracs.length - 1] : 0;
      emitIfChanged();
    };

    const update = () => {
      raf = 0;
      if (lockRef.current) return;
      // Late-loading media shifts offsets; re-measure when the page grows.
      if (document.documentElement.scrollHeight !== docHeight) measure();
      const n = tops.length;
      if (!n) return;

      const vh = window.innerHeight;
      const maxScroll = Math.max(docHeight - vh, 1);
      const readingLine = vh * 0.4;

      // A heading activates when it crosses the reading line. Clamp anchors
      // into the scrollable range (back-propagated) so the final headings
      // stay reachable on short tail content.
      const anchors = tops.map((t) => t - readingLine);
      anchors[n - 1] = Math.min(anchors[n - 1], maxScroll);
      for (let i = n - 2; i >= 0; i--) {
        anchors[i] = Math.min(anchors[i], anchors[i + 1] - 1);
      }

      const y = window.scrollY;
      let p = fracs[0] ?? 0;
      if (y >= anchors[n - 1]) {
        p = fracs[n - 1];
      } else if (y > anchors[0]) {
        let i = 0;
        while (i < n - 2 && y >= anchors[i + 1]) i++;
        const seg = anchors[i + 1] - anchors[i];
        const t = seg > 0 ? (y - anchors[i]) / seg : 0;
        p = fracs[i] + t * (fracs[i + 1] - fracs[i]);
      }
      progress.set(p);
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const remeasure = () => {
      measure();
      schedule();
    };

    // Defer the first measurement a frame so the emit (setState) never runs
    // synchronously inside the effect body.
    init = requestAnimationFrame(() => {
      measure();
      update();
    });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", remeasure);

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(init);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", remeasure);
    };
  }, [headings, progress, lockRef, setModel]);
}

// =============================================================================
// Geometry — everything below is parametrized on the docked side
// =============================================================================

/** Distance from the screen edge to the tick spine, px. */
const EDGE_INSET = {
  // Desktop right docks next to the browser scrollbar — leave it a lane.
  desktop: { right: 16, left: 10 },
  mobile: { right: 4, left: 4 },
} as const;

const TAPE_MASK =
  "linear-gradient(to bottom, transparent, black 22%, black 78%, transparent)";

interface TapeVariant {
  /** Vertical distance between two integer index steps, px. */
  pitch: number;
  /** Fisheye magnification near the reading line (centre slope 1+gain/width). */
  fisheyeGain: number;
  fisheyeWidth: number;
  /** Inward drift of the active row (toward the content), px. */
  drift: number;
  minorDrift: number;
  /** Major tick length at rest / extra growth when active, px. */
  tickBase: number;
  tickGrow: number;
  /** Decorative end-tick length, px. */
  minorWidth: number;
  /** Label measure (any CSS max-width) and active magnification. */
  labelMaxWidth: number | string;
  activeScale: number;
  /** Major label type size class. */
  labelText: string;
  /**
   * How major labels reveal:
   *  - "persistent": always readable near the reading line; the reveal
   *    value raises the floor for the rest (roomy desktop).
   *  - "overlay": hidden until revealed, cascading outward from the
   *    active section (touch takeover, tight-desktop hover).
   * Sub labels are always reveal-gated regardless of this.
   */
  labels: "persistent" | "overlay";
}

// Desktop geometry scales with the gutter (see DesktopRuler): these are
// the laptop-width baselines; roomy screens interpolate toward the
// generous end so the float breathes where space is free.
const DESKTOP: TapeVariant = {
  pitch: 56,
  fisheyeGain: 2.0,
  fisheyeWidth: 0.52,
  drift: 8,
  minorDrift: 5,
  tickBase: 18,
  tickGrow: 14,
  minorWidth: 8,
  labelMaxWidth: 300,
  activeScale: 1.09,
  // Finer than the mobile takeover — desktop labels are read at arm's
  // length next to 16px prose.
  labelText: "text-[11px]",
  labels: "persistent",
};

const MOBILE: TapeVariant = {
  pitch: 44,
  fisheyeGain: 1.9,
  fisheyeWidth: 0.5,
  // Collapsed ticks must sit clearly inside the content's 24px edge
  // padding: 4px edge inset + 12px max tick + 1px drift = 17px reach,
  // leaving visible air between ruler and text.
  drift: 1,
  minorDrift: 1,
  tickBase: 8,
  tickGrow: 4,
  minorWidth: 4,
  // Labels only show during the full-screen takeover, so they may run
  // nearly edge to edge (80px covers ticks, gaps and the scale-up).
  labelMaxWidth: "min(310px, calc(100vw - 80px))",
  activeScale: 1.08,
  labelText: "text-xs",
  labels: "overlay",
};

/** Desktop tick zone (base + growth) and label gap, for room math. */
const DESKTOP_TICK_ZONE = DESKTOP.tickBase + DESKTOP.tickGrow;
const LABEL_GAP = 12;

/** Per-level tick geometry, expressed as fractions of the major tick. */
function tickMetrics(variant: TapeVariant, level: Level) {
  if (level <= 2) {
    return { base: variant.tickBase, grow: variant.tickGrow };
  }
  if (level === 3) {
    return { base: variant.tickBase * 0.52, grow: variant.tickGrow * 0.4 };
  }
  return { base: variant.tickBase * 0.32, grow: variant.tickGrow * 0.22 };
}

/** Staggered reveal: items further from the reading line arrive later. */
function cascade(r: number, d: number) {
  return Math.min(1, Math.max(0, r * 1.6 - 0.1 * d));
}

/**
 * Map a pointer's y inside the tape window to a fractional index in
 * [0, maxFrac]. A margin keeps the first/last headings reachable without
 * hugging the window edges.
 */
function indexFromPointerY(rect: DOMRect, clientY: number, maxFrac: number) {
  if (maxFrac <= 0) return 0;
  const pad = rect.height * 0.12;
  const f = (clientY - rect.top - pad) / (rect.height - pad * 2);
  return Math.max(0, Math.min(maxFrac, f * maxFrac));
}

// =============================================================================
// Tape row — one tick (with optional label), mirrored by side and by level
// =============================================================================

function TapeRow({
  item,
  variant,
  side,
  label,
  p,
  reveal,
  interactive,
  reduced,
  onSelect,
}: {
  item: RulerItem;
  variant: TapeVariant;
  side: RulerSide;
  label?: string;
  p: MotionValue<number>;
  /** 0..1 — hover (desktop) or expanded/scrubbing (mobile). */
  reveal: MotionValue<number>;
  interactive: boolean;
  reduced: boolean;
  onSelect?: () => void;
}) {
  const frac = item.frac;
  const level = item.kind === "heading" ? item.level : 0;
  const isMajor = level > 0 && level <= 2;
  const isSub = level >= 3;
  const overlay = variant.labels === "overlay";
  // +1 points from the docked edge toward the content.
  const inward = side === "right" ? -1 : 1;

  // Fisheye: the tape's whole vertical layout is per-row now — no tape
  // translate — so the reading-line neighbourhood can locally expand.
  const gain = reduced ? 0 : variant.fisheyeGain;
  const y = useTransform(
    p,
    (v) => fisheye(frac - v, gain, variant.fisheyeWidth) * variant.pitch
  );

  const driftAmt = reduced
    ? 0
    : inward * (isMajor ? variant.drift : variant.minorDrift);
  const x = useTransform(p, (v) => driftAmt * bell(frac - v, 0.6));

  const metrics = tickMetrics(variant, (level || 4) as Level);
  const tickBase = isMajor || isSub ? metrics.base : variant.minorWidth;
  const tickGrow = reduced ? 0 : isMajor || isSub ? metrics.grow : 0;
  const tickWidth = useTransform(
    p,
    (v) => tickBase + tickGrow * bell(frac - v, 0.3)
  );

  const tickOpacity = useTransform(p, (v) => {
    const d = Math.abs(frac - v);
    if (isMajor) return Math.max(0.25, 1 - 0.55 * d);
    if (level === 3) return Math.max(0.16, 0.5 - 0.4 * d);
    if (level === 4) return Math.max(0.12, 0.34 - 0.4 * d);
    return 0.22; // decorative end
  });

  const labelOpacity = useTransform(
    [p, reveal] as MotionValue<number>[],
    (latest) => {
      const [v, r] = latest as number[];
      const d = Math.abs(frac - v);
      if (isMajor) {
        return overlay
          ? cascade(r, d) * Math.max(0.45, 1 - 0.35 * d)
          : Math.max(0.12, 1 - 0.55 * d, r * 0.65);
      }
      if (level === 3) {
        // Reveal-gated and windowed: quiet, cascades in on hover/takeover,
        // and fades with distance so only the focused cluster shows — the
        // fisheye is what separates neighbours near the reading line.
        return cascade(r, d) * bell(d, 0.9) * 0.9;
      }
      // h4: no label by default; surfaces only when it is (near) the tick
      // nearest the reading line, strengthened while revealing.
      return Math.min(0.68, bell(d, 0.06)) * (0.4 + 0.55 * r);
    }
  );

  // Reveal-gated labels slide in from the tick spine as they cascade.
  const labelShift = useTransform(
    [p, reveal] as MotionValue<number>[],
    (latest) => {
      const [v, r] = latest as number[];
      if (reduced) return 0;
      if (isMajor && !overlay) return 0;
      return -inward * 14 * (1 - cascade(r, Math.abs(frac - v)));
    }
  );
  const labelScale = useTransform(p, (v) =>
    reduced
      ? 1
      : 1 +
        (variant.activeScale - 1) * bell(frac - v, 0.3) * (isMajor ? 1 : 0.5)
  );

  const rowDirection =
    side === "right" ? "flex-row justify-end" : "flex-row-reverse justify-end";
  const hasLabel = label !== undefined;
  const labelText = isMajor ? variant.labelText : "text-[10px]";
  const labelColor = isMajor ? "text-foreground" : "text-muted-foreground";
  const spineColor = isMajor ? "bg-foreground" : "bg-muted-foreground";

  return (
    // Outer element carries the fisheye offset; inner centres the row on it
    // (px offset and a -50% self-centre can't share one transform).
    <motion.div
      aria-hidden={item.kind === "end" ? true : undefined}
      className="absolute inset-x-0"
      style={{ y }}
    >
      <motion.div
        className={cn("flex items-center", rowDirection, hasLabel && "gap-3")}
        style={{ x, y: "-50%" }}
      >
        {hasLabel && (
          <motion.button
            type="button"
            onClick={onSelect}
            tabIndex={interactive && isMajor ? 0 : -1}
            className={cn(
              "touch-none font-mono focus:outline-none",
              labelText,
              labelColor,
              // Takeover labels own the screen — let long titles wrap to two
              // lines instead of ellipsizing. Gutter labels stay single-line.
              overlay ? "line-clamp-2 leading-4" : "truncate",
              side === "right" ? "text-right" : "text-left",
              interactive
                ? "pointer-events-auto cursor-pointer"
                : "pointer-events-none"
            )}
            style={{
              maxWidth: variant.labelMaxWidth,
              opacity: labelOpacity,
              x: labelShift,
              scale: labelScale,
              transformOrigin: side === "right" ? "right center" : "left center",
            }}
          >
            {label}
          </motion.button>
        )}
        <motion.span
          aria-hidden
          className={cn("h-px shrink-0", spineColor)}
          style={{ width: tickWidth, opacity: tickOpacity }}
        />
      </motion.div>
    </motion.div>
  );
}

function Tape({
  headings,
  items,
  variant,
  side,
  edgeInset,
  p,
  reveal,
  interactive,
  reduced,
  onJump,
}: {
  headings: Heading[];
  items: RulerItem[];
  variant: TapeVariant;
  side: RulerSide;
  /** Gap between the screen edge and the tick spine, px. */
  edgeInset: number;
  p: MotionValue<number>;
  reveal: MotionValue<number>;
  interactive: boolean;
  reduced: boolean;
  onJump: (idx: number) => void;
}) {
  return (
    <motion.div
      className="absolute top-1/2"
      style={{
        left: side === "left" ? edgeInset : 0,
        right: side === "right" ? edgeInset : 0,
      }}
    >
      {items.map((item) => (
        <TapeRow
          key={item.kind === "heading" ? `h${item.idx}` : `e${item.frac}`}
          item={item}
          variant={variant}
          side={side}
          label={
            item.kind === "heading" ? headings[item.idx]?.label : undefined
          }
          p={p}
          reveal={reveal}
          interactive={interactive}
          reduced={reduced}
          onSelect={
            item.kind === "heading" ? () => onJump(item.idx) : undefined
          }
        />
      ))}
    </motion.div>
  );
}

// =============================================================================
// Desktop — edge-docked ruler for hover pointers
// =============================================================================

function DesktopRuler({
  headings,
  items,
  side,
  maxFrac,
  progress,
  smooth,
  lockRef,
  jumpingRef,
  reduced,
  onJump,
  nearest,
}: {
  headings: Heading[];
  items: RulerItem[];
  side: RulerSide;
  /** Largest reachable fractional index — the scrub span. */
  maxFrac: number;
  /** Raw progress value — the hover scrub writes straight into it. */
  progress: MotionValue<number>;
  /** Spring-smoothed progress that drives the tape. */
  smooth: MotionValue<number>;
  lockRef: LockRef;
  /** True while a jump animation owns the progress/scroll pair. */
  jumpingRef: LockRef;
  reduced: boolean;
  onJump: (idx: number) => void;
  /** Nearest heading index to a fractional value. */
  nearest: (value: number) => number;
}) {
  const edgeInset = EDGE_INSET.desktop[side];
  const navRef = useRef<HTMLElement>(null);
  const [hovered, setHovered] = useState(false);

  const reveal = useSpring(0, { stiffness: 220, damping: 28 });
  useEffect(() => {
    reveal.set(hovered ? 1 : 0);
  }, [hovered, reveal]);

  // Room between the tick spine and the content column decides the label
  // mode: roomy gutters keep labels persistent; tight ones collapse to
  // bare ticks and reveal on hover over a blur veil.
  const [labelRoom, setLabelRoom] = useState<number | null>(null);
  useEffect(() => {
    const measure = () =>
      setLabelRoom(
        window.innerWidth / 2 -
          340 - // content half (680px column)
          edgeInset -
          DESKTOP_TICK_ZONE -
          LABEL_GAP -
          16 // breathing room to the text
      );
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [edgeInset]);

  // Persistent labels are a luxury of genuinely wide screens; laptops
  // default to bare ticks and reveal on hover. The float amplitude also
  // breathes with the gutter — generous on ultrawides, space-saving on
  // laptop widths.
  const persistent = (labelRoom ?? 0) >= 420;
  const variant = useMemo<TapeVariant>(() => {
    const room = labelRoom ?? 0;
    const t = Math.min(1, Math.max(0, (room - 100) / 400));
    return {
      ...DESKTOP,
      drift: DESKTOP.drift + 8 * t,
      minorDrift: DESKTOP.minorDrift + 4 * t,
      tickBase: DESKTOP.tickBase + 6 * t,
      tickGrow: DESKTOP.tickGrow + 12 * t,
      activeScale: DESKTOP.activeScale + 0.07 * t,
      labels: persistent ? "persistent" : "overlay",
      labelMaxWidth: persistent
        ? Math.min(room, 300)
        : "min(300px, calc(100vw - 140px))",
    };
  }, [persistent, labelRoom]);

  // Hovering engages the ruler like a jog dial: the cursor's height scrubs
  // the tape (same mapping as the touch gesture), a click commits, and
  // leaving lets the tape spring back to the real reading position.
  //
  // Hover-out is tracked against the nav's rect (not element boundaries):
  // the tape is pointer-events-none with scattered hit targets, so element
  // enter/leave pairs would flicker crossing the gaps between labels.
  useEffect(() => {
    if (!hovered) return;
    lockRef.current = true;
    let raf = 0;
    let lastX = 0;
    let lastY = 0;
    const onMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const rect = navRef.current?.getBoundingClientRect();
        if (!rect) return;
        const margin = 24;
        if (
          lastX < rect.left - margin ||
          lastX > rect.right + margin ||
          lastY < rect.top - margin ||
          lastY > rect.bottom + margin
        ) {
          setHovered(false);
          return;
        }
        // While a click's jump animation runs it owns the progress value;
        // scrubbing resumes on the next move after it settles.
        if (jumpingRef.current) return;
        lockRef.current = true;
        progress.set(indexFromPointerY(rect, lastY, maxFrac));
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
      // Hand progress back to the scroll position — unless a committed
      // jump is mid-flight and will resync on its own.
      if (!jumpingRef.current) {
        lockRef.current = false;
        window.dispatchEvent(new Event("scroll"));
      }
    };
  }, [hovered, maxFrac, progress, lockRef, jumpingRef]);

  if (labelRoom === null) return null;

  return (
    <>
      {/* Blur veil for the tight-gutter reveal: labels run over the text,
          so a backdrop blur fading toward the content keeps them legible
          while preserving a soft edge transition. */}
      <AnimatePresence>
        {!persistent && hovered && (
          <motion.div
            aria-hidden
            // Both fades live on the blurred element itself: a masked (or
            // filtered/opacity) ANCESTOR would form a backdrop root and the
            // blur would sample nothing but its own empty group.
            className="pointer-events-none fixed top-1/2 z-30 -translate-y-1/2 bg-background/40 backdrop-blur-md"
            style={{
              [side]: 0,
              width: "min(460px, 90vw)",
              height: "min(640px, 86svh)",
              maskImage: `linear-gradient(to bottom, transparent, black 18%, black 82%, transparent), linear-gradient(to ${
                side === "right" ? "left" : "right"
              }, black 55%, transparent)`,
              WebkitMaskImage: `linear-gradient(to bottom, transparent, black 18%, black 82%, transparent), linear-gradient(to ${
                side === "right" ? "left" : "right"
              }, black 55%, transparent)`,
              maskComposite: "intersect",
              WebkitMaskComposite: "source-in",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>

      <nav
        ref={navRef}
        aria-label="Table of contents"
        className="pointer-events-none fixed top-1/2 z-30 -translate-y-1/2 overflow-hidden"
        style={{
          [side]: 0,
          width: "min(430px, calc(100vw - 48px))",
          height: 440,
          maskImage: TAPE_MASK,
          WebkitMaskImage: TAPE_MASK,
        }}
        // Fires when the cursor enters any hit-testable child (edge strip
        // or a revealed label); the rect tracker above handles leaving.
        onMouseEnter={() => setHovered(true)}
        onFocusCapture={() => setHovered(true)}
        onBlurCapture={() => setHovered(false)}
      >
        <Tape
          headings={headings}
          items={items}
          variant={variant}
          side={side}
          edgeInset={edgeInset}
          p={smooth}
          reveal={reveal}
          interactive={persistent || hovered}
          reduced={reduced}
          onJump={onJump}
        />
        {/* Hover strip over the ticks — the collapsed ruler's hit area.
            Clicking it commits the dial's current selection to the nearest
            tick of any level. */}
        <div
          aria-hidden
          className="pointer-events-auto absolute inset-y-0 cursor-pointer"
          style={{ [side]: 0, width: edgeInset + DESKTOP_TICK_ZONE + 8 }}
          onClick={() => onJump(nearest(progress.get()))}
        />
      </nav>
    </>
  );
}

// =============================================================================
// Mobile — scrubbable tick strip on the docked edge
// =============================================================================

function MobileRuler({
  headings,
  items,
  side,
  maxFrac,
  progress,
  smooth,
  lockRef,
  reduced,
  onJump,
  nearest,
}: {
  headings: Heading[];
  items: RulerItem[];
  side: RulerSide;
  maxFrac: number;
  /** Raw progress value — the scrub gesture writes straight into it. */
  progress: MotionValue<number>;
  /** Spring-smoothed progress that drives the tape. */
  smooth: MotionValue<number>;
  lockRef: LockRef;
  reduced: boolean;
  onJump: (idx: number) => void;
  nearest: (value: number) => number;
}) {
  const edgeInset = EDGE_INSET.mobile[side];
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const scrub = useRef<{
    id: number;
    startY: number;
    active: boolean;
    index: number;
  } | null>(null);

  const reveal = useSpring(0, { stiffness: 220, damping: 28 });
  useEffect(() => {
    reveal.set(open ? 1 : 0);
  }, [open, reveal]);

  const indexFromY = useCallback(
    (clientY: number) => {
      const rect = navRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      return indexFromPointerY(rect, clientY, maxFrac);
    },
    [maxFrac]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!e.isPrimary || scrub.current) return;
    // No pointer capture yet — a plain tap must keep its natural target so
    // label buttons still receive their click.
    scrub.current = { id: e.pointerId, startY: e.clientY, active: false, index: 0 };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const s = scrub.current;
    if (!s || e.pointerId !== s.id) return;
    if (!s.active) {
      if (Math.abs(e.clientY - s.startY) < 6) return;
      // Drag detected — take over progress and surface the labels. Capturing
      // here (not on pointerdown) retargets the rest of the gesture to the
      // container, which also keeps the drag from ending in a stray click.
      s.active = true;
      lockRef.current = true;
      setOpen(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Pointer already gone (or synthetic) — the gesture still works.
      }
    }
    s.index = indexFromY(e.clientY);
    progress.set(s.index);
  };

  /**
   * End a gesture: a drag snaps to the nearest tick of any level; a tap acts
   * on what was pressed — the strip toggles, the scrim dismisses, labels are
   * left to their own click handler.
   */
  const endScrub = (e: React.PointerEvent<HTMLElement>) => {
    const s = scrub.current;
    if (!s || e.pointerId !== s.id) return;
    scrub.current = null;

    if (s.active) {
      setOpen(false);
      if (e.type === "pointercancel") {
        // Gesture stolen by the system — resync with the real scroll.
        lockRef.current = false;
        window.dispatchEvent(new Event("scroll"));
      } else {
        // Snap to the nearest tick; the jump animation owns the lockRef.
        onJump(nearest(s.index));
      }
    } else if (e.type !== "pointercancel") {
      const pressed = e.target as HTMLElement;
      if (pressed.closest("[data-ruler-strip]")) {
        setOpen((o) => !o);
      } else if (pressed.closest("[data-ruler-scrim]")) {
        setOpen(false);
      }
    }
  };

  const gestureHandlers = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: endScrub,
    onPointerCancel: endScrub,
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            // Full-screen gesture layer: the takeover is visual AND haptic.
            // touch-none swallows native scrolling while open; dragging
            // anywhere scrubs the tape (finger y maps onto the tape window,
            // so pointing at a label's row selects it); a plain tap dismisses.
            data-ruler-scrim
            className="fixed inset-0 z-40 touch-none bg-background/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            {...gestureHandlers}
          />
        )}
      </AnimatePresence>

      <nav
        ref={navRef}
        aria-label="Table of contents"
        className={cn(
          "pointer-events-none fixed top-1/2 -translate-y-1/2 overflow-hidden",
          open ? "z-50" : "z-30"
        )}
        style={{
          [side]: 0,
          // Wide enough for the takeover labels; the collapsed state only
          // paints ticks (labels sit at opacity 0, pointer-events none).
          width: "calc(100vw - 16px)",
          height: "min(400px, 62svh)",
          maskImage: TAPE_MASK,
          WebkitMaskImage: TAPE_MASK,
        }}
        // Gestures bubble up here from the strip and the labels, so a drag
        // that starts on any of them scrubs instead of scrolling the page.
        {...gestureHandlers}
      >
        <Tape
          headings={headings}
          items={items}
          variant={MOBILE}
          side={side}
          edgeInset={edgeInset}
          p={smooth}
          reveal={reveal}
          interactive={open}
          reduced={reduced}
          onJump={(idx) => {
            setOpen(false);
            onJump(idx);
          }}
        />
        {/* Scrub strip over the ticks — drag to seek, tap to expand.
            touch-none hands the whole gesture to the pointer handlers. */}
        <button
          type="button"
          data-ruler-strip
          aria-label="Table of contents"
          aria-expanded={open}
          onClick={(e) => {
            // Pointer handlers own taps; keep click for keyboard only.
            if (e.detail === 0) setOpen((o) => !o);
          }}
          className="pointer-events-auto absolute inset-y-0 w-10 cursor-pointer touch-none"
          style={{ [side]: 0 }}
        />
      </nav>
    </>
  );
}

// =============================================================================
// Entry
// =============================================================================

export function RulerToc() {
  const reduced = useReducedMotion() ?? false;
  const side = useRulerSide();
  const hoverPointer = useHoverPointer();
  const headings = useHeadings();
  const lockRef = useRef(false);
  // Held while a committed jump animates, so hover-scrub yields to it.
  const jumpingRef = useRef(false);

  const progress = useMotionValue(0);
  const [model, setModel] = useState<RulerModel>({ fracs: [], maxFrac: 0 });
  useReadingProgress(headings, progress, lockRef, setModel);

  // A touch of lag gives the tape its flow; near-rigid when reduced motion.
  const smooth = useSpring(
    progress,
    reduced
      ? { stiffness: 1000, damping: 100 }
      : { stiffness: 170, damping: 26, mass: 0.9 }
  );

  // Structural fallback positions (major integer index; subs midway) drive
  // the tape for the frame before offsets are measured, so it never flashes
  // empty. `majorCount` gates rendering and mirrors the old h2-only guard.
  const { fallback, majorCount } = useMemo(() => {
    const fb: number[] = [];
    let mi = -1;
    headings.forEach((h, k) => {
      if (h.level <= 2) {
        mi++;
        fb[k] = mi;
      } else {
        fb[k] = mi < 0 ? 0 : mi + 0.5;
      }
    });
    return { fallback: fb, majorCount: mi + 1 };
  }, [headings]);

  const fracs =
    model.fracs.length === headings.length ? model.fracs : fallback;
  const maxFrac = model.maxFrac || fracs[fracs.length - 1] || 0;

  const items = useMemo<RulerItem[]>(() => {
    const list: RulerItem[] = [];
    for (let k = END_TICKS; k >= 1; k--) {
      list.push({ kind: "end", frac: -k * END_STEP });
    }
    headings.forEach((h, idx) => {
      list.push({ kind: "heading", idx, level: h.level, frac: fracs[idx] ?? 0 });
    });
    for (let k = 1; k <= END_TICKS; k++) {
      list.push({ kind: "end", frac: maxFrac + k * END_STEP });
    }
    return list;
  }, [headings, fracs, maxFrac]);

  const nearest = useCallback(
    (value: number) => {
      let best = 0;
      let bd = Infinity;
      for (let k = 0; k < headings.length; k++) {
        const d = Math.abs((fracs[k] ?? 0) - value);
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      return best;
    },
    [headings, fracs]
  );

  /**
   * Animated jump: the tape rolls to the target heading (via the spring)
   * while the document glides underneath. The scroll lock keeps the two
   * from fighting; any user input cancels the glide immediately.
   */
  const jumpTo = useCallback(
    (idx: number) => {
      const el = headings[idx]?.el;
      if (!el) return;
      const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - 96);
      if (el.id) window.history.replaceState(null, "", `#${el.id}`);

      lockRef.current = true;
      jumpingRef.current = true;
      progress.set(fracs[idx] ?? 0);

      if (reduced) {
        window.scrollTo(0, top);
        jumpingRef.current = false;
        lockRef.current = false;
        window.dispatchEvent(new Event("scroll"));
        return;
      }

      let done = false;
      let stopOnInput = () => {};
      const finish = () => {
        if (done) return;
        done = true;
        window.removeEventListener("wheel", stopOnInput);
        window.removeEventListener("touchmove", stopOnInput);
        jumpingRef.current = false;
        lockRef.current = false;
        window.dispatchEvent(new Event("scroll"));
      };
      const controls = animate(window.scrollY, top, {
        duration: Math.min(1.1, 0.5 + Math.abs(top - window.scrollY) / 8000),
        ease: [0.32, 0.72, 0, 1],
        onUpdate: (v) => window.scrollTo(0, v),
      });
      stopOnInput = () => {
        controls.stop();
        finish();
      };
      window.addEventListener("wheel", stopOnInput, { passive: true });
      window.addEventListener("touchmove", stopOnInput, { passive: true });
      controls.then(finish, finish);
    },
    [headings, fracs, reduced, progress]
  );

  if (majorCount < 2 || hoverPointer === null) return null;

  return hoverPointer ? (
    <DesktopRuler
      headings={headings}
      items={items}
      side={side}
      maxFrac={maxFrac}
      progress={progress}
      smooth={smooth}
      lockRef={lockRef}
      jumpingRef={jumpingRef}
      reduced={reduced}
      onJump={jumpTo}
      nearest={nearest}
    />
  ) : (
    <MobileRuler
      headings={headings}
      items={items}
      side={side}
      maxFrac={maxFrac}
      progress={progress}
      smooth={smooth}
      lockRef={lockRef}
      reduced={reduced}
      onJump={jumpTo}
      nearest={nearest}
    />
  );
}
