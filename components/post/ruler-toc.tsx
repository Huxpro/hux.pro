"use client";

import {
  emitPageScroll,
  onPageScroll,
  pageOffsetOf,
  pageScrollHeight,
  pageScrollTop,
  pageViewportHeight,
  scrollPageTo,
} from "vitre";
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
 * furniture, like a semantic scrollbar. Section headings are major ticks;
 * the tape slides with scroll so the active section always rests at the
 * optical center. Distance from that reading line drives opacity, a slight
 * inward drift, tick length and type scale — a flat-but-dimensional dial,
 * like a physical ruler read at its index line.
 *
 * Interaction adapts to pointer capability, not viewport width:
 *
 * Hover pointers (desktop): when the gutter is wide enough, labels are
 * always readable near the reading line and hover brightens the rest.
 * When the gutter is tight, the ruler collapses to bare ticks; hovering
 * reveals the labels over a soft backdrop-blur veil that fades toward the
 * content, so titles can run long without fighting the text behind them.
 *
 * Touch (mobile): bare ticks, directly manipulable — press and drag to
 * scrub (labels cascade in over a frosted scrim while the tape follows
 * the finger), release to snap to the nearest section; tap to expand.
 *
 * Headings are discovered from the rendered `.prose-article` DOM (h1/h2),
 * so it works with client-generated heading ids and both locales.
 */

interface Section {
  el: HTMLElement;
  label: string;
}

type RulerItem =
  | { kind: "major"; index: number; section: number }
  | { kind: "minor"; index: number };

/** Mutable flag shared between scroll-tracking and programmatic motion. */
type LockRef = { current: boolean };

/** Bell curve around 0 — the "reading line" falloff. */
function bell(d: number, spread: number) {
  return Math.exp(-(d * d) / spread);
}

/** Major + minor tick positions in section-index space, with ruler ends. */
function buildItems(count: number, minorsPerGap: number): RulerItem[] {
  const items: RulerItem[] = [];
  const step = 1 / (minorsPerGap + 1);
  for (let k = minorsPerGap; k >= 1; k--) {
    items.push({ kind: "minor", index: -k * step });
  }
  for (let i = 0; i < count; i++) {
    items.push({ kind: "major", index: i, section: i });
    for (let k = 1; k <= minorsPerGap; k++) {
      items.push({ kind: "minor", index: i + k * step });
    }
  }
  return items;
}

/** Scan the rendered article for section headings (h1/h2, prose only). */
function useSections(): Section[] {
  const pathname = usePathname();
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    let raf = 0;
    let observer: MutationObserver | undefined;

    const scan = () => {
      const root = document.querySelector(".prose-article");
      const els = root
        ? Array.from(root.querySelectorAll<HTMLElement>("h1, h2")).filter(
            (el) => !el.closest(".not-prose")
          )
        : [];
      const next = els.map((el) => ({
        el,
        // HeadingWithLink wraps text in a span next to the copy button —
        // read the span so the copied "✓" never leaks into labels.
        label: (
          el.querySelector(":scope > span")?.textContent ??
          el.textContent ??
          ""
        ).trim(),
      }));
      setSections((prev) =>
        prev.length === next.length &&
        prev.every((s, i) => s.el === next[i].el && s.label === next[i].label)
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

  return sections;
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

/**
 * Continuous reading progress in section-index space: 0 at the first
 * heading, n-1 at the last, linearly interpolated between anchors and
 * guaranteed to reach the end at the bottom of the page.
 *
 * While `lockRef` is held (scrubbing, programmatic jumps) scroll events are
 * ignored so the gesture/animation owns the progress value.
 */
function useReadingProgress(
  sections: Section[],
  progress: MotionValue<number>,
  lockRef: LockRef
) {
  useEffect(() => {
    if (sections.length === 0) return;

    let tops: number[] = [];
    let docHeight = 0;
    let raf = 0;

    // Page geometry, not window geometry: in container scroll the page scrolls
    // in Vitre's scroll container, so the window's scrollY is always 0 there and
    // its height is not the height of what scrolls. See vitre.
    const measure = () => {
      tops = sections.map(({ el }) => pageOffsetOf(el));
      docHeight = pageScrollHeight();
    };

    const update = () => {
      raf = 0;
      if (lockRef.current) return;
      // Late-loading media shifts offsets; re-measure when the page grows.
      if (pageScrollHeight() !== docHeight) measure();

      const vh = pageViewportHeight();
      const maxScroll = Math.max(docHeight - vh, 1);
      const readingLine = vh * 0.4;

      // A section activates when its heading crosses the reading line.
      // Clamp anchors into the scrollable range (back-propagated) so the
      // last sections stay reachable on short tail content.
      const anchors = tops.map((t) => t - readingLine);
      anchors[anchors.length - 1] = Math.min(
        anchors[anchors.length - 1],
        maxScroll
      );
      for (let i = anchors.length - 2; i >= 0; i--) {
        anchors[i] = Math.min(anchors[i], anchors[i + 1] - 1);
      }

      const y = pageScrollTop();
      let p = 0;
      if (y >= anchors[anchors.length - 1]) {
        p = anchors.length - 1;
      } else if (y > anchors[0]) {
        let i = 0;
        while (i < anchors.length - 2 && y >= anchors[i + 1]) i++;
        p = i + (y - anchors[i]) / (anchors[i + 1] - anchors[i]);
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

    measure();
    update();
    const offScroll = onPageScroll(schedule);
    window.addEventListener("resize", remeasure);

    return () => {
      cancelAnimationFrame(raf);
      offScroll();
      window.removeEventListener("resize", remeasure);
    };
  }, [sections, progress, lockRef]);
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
  /** Vertical distance between two section ticks, px. */
  pitch: number;
  /** Inward drift of the active row (toward the content), px. */
  drift: number;
  minorDrift: number;
  /** Major tick length at rest / extra growth when active, px. */
  tickBase: number;
  tickGrow: number;
  /** Minor tick length, px. */
  minorWidth: number;
  /** Label measure (any CSS max-width) and active magnification. */
  labelMaxWidth: number | string;
  activeScale: number;
  /** Label type size classes. */
  labelText: string;
  /**
   * How labels reveal:
   *  - "persistent": always readable near the reading line; the reveal
   *    value raises the floor for the rest (roomy desktop).
   *  - "overlay": hidden until revealed, cascading outward from the
   *    active section (touch takeover, tight-desktop hover).
   */
  labels: "persistent" | "overlay";
}

// Desktop geometry scales with the gutter (see DesktopRuler): these are
// the laptop-width baselines; roomy screens interpolate toward the
// generous end so the float breathes where space is free.
const DESKTOP: TapeVariant = {
  pitch: 56,
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

/** Staggered reveal: items further from the reading line arrive later. */
function cascade(r: number, d: number) {
  return Math.min(1, Math.max(0, r * 1.6 - 0.1 * d));
}

/**
 * Map a pointer's y inside the tape window to a fractional section index.
 * A margin keeps the first/last sections reachable without hugging the
 * window edges.
 */
function indexFromPointerY(rect: DOMRect, clientY: number, count: number) {
  if (count < 2) return 0;
  const pad = rect.height * 0.12;
  const f = (clientY - rect.top - pad) / (rect.height - pad * 2);
  return Math.max(0, Math.min(count - 1, f * (count - 1)));
}

// =============================================================================
// Tape row — one tick (with optional label), mirrored by side
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
  const isMajor = item.kind === "major";
  const overlay = variant.labels === "overlay";
  // +1 points from the docked edge toward the content.
  const inward = side === "right" ? -1 : 1;
  const drift = reduced
    ? 0
    : inward * (isMajor ? variant.drift : variant.minorDrift);

  const x = useTransform(p, (v) => drift * bell(item.index - v, 0.6));
  const tickWidth = useTransform(p, (v) =>
    isMajor
      ? variant.tickBase +
        (reduced ? 0 : variant.tickGrow * bell(item.index - v, 0.3))
      : variant.minorWidth
  );
  const tickOpacity = useTransform(p, (v) =>
    isMajor ? Math.max(0.25, 1 - 0.55 * Math.abs(item.index - v)) : 0.25
  );
  const labelOpacity = useTransform(
    [p, reveal] as MotionValue<number>[],
    (latest) => {
      const [v, r] = latest as number[];
      const d = Math.abs(item.index - v);
      return overlay
        ? cascade(r, d) * Math.max(0.45, 1 - 0.35 * d)
        : Math.max(0.12, 1 - 0.55 * d, r * 0.65);
    }
  );
  // Overlay labels slide in from the tick spine as they cascade.
  const labelShift = useTransform(
    [p, reveal] as MotionValue<number>[],
    (latest) => {
      const [v, r] = latest as number[];
      if (!overlay || reduced) return 0;
      return -inward * 14 * (1 - cascade(r, Math.abs(item.index - v)));
    }
  );
  const labelScale = useTransform(p, (v) =>
    reduced ? 1 : 1 + (variant.activeScale - 1) * bell(item.index - v, 0.3)
  );

  const rowDirection =
    side === "right" ? "flex-row justify-end" : "flex-row-reverse justify-end";

  if (!isMajor) {
    return (
      <motion.div
        aria-hidden
        className={cn("absolute inset-x-0 flex", rowDirection)}
        style={{ top: item.index * variant.pitch, x, y: "-50%" }}
      >
        <motion.span
          className="h-px bg-muted-foreground"
          style={{ width: tickWidth, opacity: tickOpacity }}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn("absolute inset-x-0 flex items-center gap-3", rowDirection)}
      style={{ top: item.index * variant.pitch, x, y: "-50%" }}
    >
      <motion.button
        type="button"
        onClick={onSelect}
        tabIndex={interactive ? 0 : -1}
        className={cn(
          "touch-none font-mono text-foreground focus:outline-none",
          variant.labelText,
          // Takeover labels own the screen — let long titles wrap to two
          // lines instead of ellipsizing (the point is reading them).
          // Persistent gutter labels stay single-line.
          overlay ? "line-clamp-2 leading-4" : "truncate",
          side === "right" ? "text-right" : "text-left",
          interactive
            ? "pointer-events-auto cursor-pointer"
            : "pointer-events-none"
        )}
        style={{
          // Cap width so the active scale-up still fits the tape box.
          maxWidth: variant.labelMaxWidth,
          opacity: labelOpacity,
          x: labelShift,
          scale: labelScale,
          transformOrigin: side === "right" ? "right center" : "left center",
        }}
      >
        {label}
      </motion.button>
      <motion.span
        aria-hidden
        className="h-px shrink-0 bg-foreground"
        style={{ width: tickWidth, opacity: tickOpacity }}
      />
    </motion.div>
  );
}

function Tape({
  sections,
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
  sections: Section[];
  items: RulerItem[];
  variant: TapeVariant;
  side: RulerSide;
  /** Gap between the screen edge and the tick spine, px. */
  edgeInset: number;
  p: MotionValue<number>;
  reveal: MotionValue<number>;
  interactive: boolean;
  reduced: boolean;
  onJump: (i: number) => void;
}) {
  const tapeY = useTransform(p, (v) => -v * variant.pitch);

  return (
    <motion.div
      className="absolute top-1/2"
      style={{
        y: tapeY,
        left: side === "left" ? edgeInset : 0,
        right: side === "right" ? edgeInset : 0,
      }}
    >
      {items.map((item) => (
        <TapeRow
          key={`${item.kind}-${item.index}`}
          item={item}
          variant={variant}
          side={side}
          label={
            item.kind === "major" ? sections[item.section]?.label : undefined
          }
          p={p}
          reveal={reveal}
          interactive={interactive}
          reduced={reduced}
          onSelect={
            item.kind === "major" ? () => onJump(item.section) : undefined
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
  sections,
  items,
  side,
  progress,
  smooth,
  lockRef,
  jumpingRef,
  reduced,
  onJump,
}: {
  sections: Section[];
  items: RulerItem[];
  side: RulerSide;
  /** Raw progress value — the hover scrub writes straight into it. */
  progress: MotionValue<number>;
  /** Spring-smoothed progress that drives the tape. */
  smooth: MotionValue<number>;
  lockRef: LockRef;
  /** True while a jump animation owns the progress/scroll pair. */
  jumpingRef: LockRef;
  reduced: boolean;
  onJump: (i: number) => void;
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
        progress.set(indexFromPointerY(rect, lastY, sections.length));
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
        emitPageScroll();
      }
    };
  }, [hovered, sections.length, progress, lockRef, jumpingRef]);

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
          sections={sections}
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
            Clicking it commits the dial's current selection. */}
        <div
          aria-hidden
          className="pointer-events-auto absolute inset-y-0 cursor-pointer"
          style={{ [side]: 0, width: edgeInset + DESKTOP_TICK_ZONE + 8 }}
          onClick={() => onJump(Math.round(progress.get()))}
        />
      </nav>
    </>
  );
}

// =============================================================================
// Mobile — scrubbable tick strip on the docked edge
// =============================================================================

function MobileRuler({
  sections,
  items,
  side,
  progress,
  smooth,
  lockRef,
  reduced,
  onJump,
}: {
  sections: Section[];
  items: RulerItem[];
  side: RulerSide;
  /** Raw progress value — the scrub gesture writes straight into it. */
  progress: MotionValue<number>;
  /** Spring-smoothed progress that drives the tape. */
  smooth: MotionValue<number>;
  lockRef: LockRef;
  reduced: boolean;
  onJump: (i: number) => void;
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
      return indexFromPointerY(rect, clientY, sections.length);
    },
    [sections.length]
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
   * End a gesture: a drag snaps to the nearest section; a tap acts on what
   * was pressed — the strip toggles, the scrim dismisses, labels are left
   * to their own click handler.
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
        emitPageScroll();
      } else {
        // Snap to the nearest section; the jump animation owns the lockRef.
        onJump(Math.round(s.index));
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
          sections={sections}
          items={items}
          variant={MOBILE}
          side={side}
          edgeInset={edgeInset}
          p={smooth}
          reveal={reveal}
          interactive={open}
          reduced={reduced}
          onJump={(i) => {
            setOpen(false);
            onJump(i);
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
  const sections = useSections();
  const lockRef = useRef(false);
  // Held while a committed jump animates, so hover-scrub yields to it.
  const jumpingRef = useRef(false);

  const progress = useMotionValue(0);
  useReadingProgress(sections, progress, lockRef);

  // A touch of lag gives the tape its flow; near-rigid when reduced motion.
  const smooth = useSpring(
    progress,
    reduced
      ? { stiffness: 1000, damping: 100 }
      : { stiffness: 170, damping: 26, mass: 0.9 }
  );

  const minorsPerGap = sections.length > 16 ? 1 : 2;
  const items = useMemo(
    () => buildItems(sections.length, minorsPerGap),
    [sections.length, minorsPerGap]
  );

  /**
   * Animated jump: the tape rolls to the target section (via the spring)
   * while the document glides underneath. The scroll lock keeps the two
   * from fighting; any user input cancels the glide immediately.
   */
  const jumpTo = useCallback(
    (i: number) => {
      const el = sections[i]?.el;
      if (!el) return;
      const top = Math.max(0, pageOffsetOf(el) - 96);
      if (el.id) window.history.replaceState(null, "", `#${el.id}`);

      lockRef.current = true;
      jumpingRef.current = true;
      progress.set(i);

      if (reduced) {
        scrollPageTo(top);
        jumpingRef.current = false;
        lockRef.current = false;
        emitPageScroll();
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
        emitPageScroll();
      };
      const from = pageScrollTop();
      const controls = animate(from, top, {
        duration: Math.min(1.1, 0.5 + Math.abs(top - from) / 8000),
        ease: [0.32, 0.72, 0, 1],
        onUpdate: (v) => scrollPageTo(v),
      });
      stopOnInput = () => {
        controls.stop();
        finish();
      };
      window.addEventListener("wheel", stopOnInput, { passive: true });
      window.addEventListener("touchmove", stopOnInput, { passive: true });
      controls.then(finish, finish);
    },
    [sections, reduced, progress]
  );

  if (sections.length < 2 || hoverPointer === null) return null;

  return hoverPointer ? (
    <DesktopRuler
      sections={sections}
      items={items}
      side={side}
      progress={progress}
      smooth={smooth}
      lockRef={lockRef}
      jumpingRef={jumpingRef}
      reduced={reduced}
      onJump={jumpTo}
    />
  ) : (
    <MobileRuler
      sections={sections}
      items={items}
      side={side}
      progress={progress}
      smooth={smooth}
      lockRef={lockRef}
      reduced={reduced}
      onJump={jumpTo}
    />
  );
}
