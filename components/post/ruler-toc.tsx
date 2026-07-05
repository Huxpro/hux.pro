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

/**
 * RulerToc — a scroll-driven "ruler" table of contents for article pages.
 *
 * Desktop (xl+): a vertical measuring tape fixed in the left gutter of the
 * reading column, strictly centered on the viewport. Section headings are
 * major ticks; the tape slides with scroll so the active section always
 * rests at the optical center. Distance from that reading line drives
 * opacity, a slight leftward drift, tick length and type scale — a
 * flat-but-dimensional dial, like a physical ruler read at its index line.
 * Hovering reveals every section label; clicking one scrolls to it.
 *
 * Mobile (< xl): the same tape pinned to the right edge as a scrollbar-like
 * strip of bare ticks (the top edge belongs to the Dock, the bottom to the
 * FAB). It is directly manipulable: press and drag to scrub — labels
 * cascade in over a frosted scrim and the tape follows the finger — then
 * release to snap to the nearest section. A plain tap expands the list.
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

    const measure = () => {
      const scrollY = window.scrollY;
      tops = sections.map(
        ({ el }) => el.getBoundingClientRect().top + scrollY
      );
      docHeight = document.documentElement.scrollHeight;
    };

    const update = () => {
      raf = 0;
      if (lockRef.current) return;
      // Late-loading media shifts offsets; re-measure when the page grows.
      if (document.documentElement.scrollHeight !== docHeight) measure();

      const vh = window.innerHeight;
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

      const y = window.scrollY;
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
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", remeasure);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", remeasure);
    };
  }, [sections, progress, lockRef]);
}

// =============================================================================
// Tape row — one tick (with optional label) on the vertical ruler
// =============================================================================

interface TapeVariant {
  /** Vertical distance between two section ticks, px. */
  pitch: number;
  /** Leftward drift of the active row, px (major / minor). */
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
  /**
   * How labels reveal:
   *  - "persistent": always readable near the reading line; the reveal
   *    value raises the floor for the rest (desktop hover).
   *  - "overlay": hidden until revealed, cascading outward from the
   *    active section (mobile expanded/scrubbing state).
   */
  labels: "persistent" | "overlay";
}

const DESKTOP: TapeVariant = {
  pitch: 56,
  drift: -10,
  minorDrift: -7,
  tickBase: 22,
  tickGrow: 22,
  minorWidth: 10,
  labelMaxWidth: 168,
  activeScale: 1.14,
  labels: "persistent",
};

const MOBILE: TapeVariant = {
  pitch: 44,
  // Collapsed ticks must stay inside the content's 24px right padding:
  // 4px edge offset + 14px max tick + 2px drift = 20px reach, leaving a
  // sliver of air between ruler and text.
  drift: -2,
  minorDrift: -1,
  tickBase: 9,
  tickGrow: 5,
  minorWidth: 4,
  // Labels only show during the full-screen takeover, so they may run
  // nearly edge to edge (96px covers ticks, gaps and the scale-up).
  labelMaxWidth: "min(310px, calc(100vw - 80px))",
  activeScale: 1.08,
  labels: "overlay",
};

/** Staggered reveal: items further from the reading line arrive later. */
function cascade(r: number, d: number) {
  return Math.min(1, Math.max(0, r * 1.6 - 0.1 * d));
}

function TapeRow({
  item,
  variant,
  label,
  p,
  reveal,
  interactive,
  reduced,
  onSelect,
}: {
  item: RulerItem;
  variant: TapeVariant;
  label?: string;
  p: MotionValue<number>;
  /** 0..1 — hover (desktop) or expanded/scrubbing (mobile). */
  reveal: MotionValue<number>;
  interactive: boolean;
  reduced: boolean;
  onSelect?: () => void;
}) {
  const isMajor = item.kind === "major";
  const drift = reduced ? 0 : isMajor ? variant.drift : variant.minorDrift;
  const overlay = variant.labels === "overlay";

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
  // Overlay labels slide in from the tick side as they cascade.
  const labelShift = useTransform(
    [p, reveal] as MotionValue<number>[],
    (latest) => {
      const [v, r] = latest as number[];
      if (!overlay || reduced) return 0;
      return 14 * (1 - cascade(r, Math.abs(item.index - v)));
    }
  );
  const labelScale = useTransform(p, (v) =>
    reduced ? 1 : 1 + (variant.activeScale - 1) * bell(item.index - v, 0.3)
  );

  if (!isMajor) {
    return (
      <motion.div
        aria-hidden
        className="absolute inset-x-0 flex justify-end"
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
      className="absolute inset-x-0 flex items-center justify-end gap-3"
      style={{ top: item.index * variant.pitch, x, y: "-50%" }}
    >
      <motion.button
        type="button"
        onClick={onSelect}
        tabIndex={interactive ? 0 : -1}
        className={cn(
          "touch-none truncate text-right font-mono text-xs text-foreground focus:outline-none",
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
          transformOrigin: "right center",
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
  p,
  reveal,
  interactive,
  reduced,
  onJump,
}: {
  sections: Section[];
  items: RulerItem[];
  variant: TapeVariant;
  p: MotionValue<number>;
  reveal: MotionValue<number>;
  interactive: boolean;
  reduced: boolean;
  onJump: (i: number) => void;
}) {
  const tapeY = useTransform(p, (v) => -v * variant.pitch);

  return (
    <motion.div className="absolute inset-x-0 top-1/2" style={{ y: tapeY }}>
      {items.map((item) => (
        <TapeRow
          key={`${item.kind}-${item.index}`}
          item={item}
          variant={variant}
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

const TAPE_MASK =
  "linear-gradient(to bottom, transparent, black 22%, black 78%, transparent)";

// =============================================================================
// Desktop — vertical ruler in the left gutter, labels on hover
// =============================================================================

function DesktopRuler({
  sections,
  items,
  p,
  reduced,
  onJump,
}: {
  sections: Section[];
  items: RulerItem[];
  p: MotionValue<number>;
  reduced: boolean;
  onJump: (i: number) => void;
}) {
  const hover = useSpring(0, { stiffness: 260, damping: 30 });

  return (
    <nav
      aria-label="Table of contents"
      className="fixed top-1/2 z-30 hidden -translate-y-1/2 overflow-hidden xl:block"
      style={{
        right: "calc(50% + 388px)",
        width: 248,
        height: 440,
        maskImage: TAPE_MASK,
        WebkitMaskImage: TAPE_MASK,
      }}
      onMouseEnter={() => hover.set(1)}
      onMouseLeave={() => hover.set(0)}
      onFocusCapture={() => hover.set(1)}
      onBlurCapture={() => hover.set(0)}
    >
      <Tape
        sections={sections}
        items={items}
        variant={DESKTOP}
        p={p}
        reveal={hover}
        interactive
        reduced={reduced}
        onJump={onJump}
      />
    </nav>
  );
}

// =============================================================================
// Mobile — scrubbable tick strip on the right edge
// =============================================================================

function MobileRuler({
  sections,
  items,
  progress,
  smooth,
  lockRef,
  reduced,
  onJump,
}: {
  sections: Section[];
  items: RulerItem[];
  /** Raw progress value — the scrub gesture writes straight into it. */
  progress: MotionValue<number>;
  /** Spring-smoothed progress that drives the tape. */
  smooth: MotionValue<number>;
  lockRef: LockRef;
  reduced: boolean;
  onJump: (i: number) => void;
}) {
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
      if (!rect || sections.length < 2) return 0;
      // Keep a margin so the first/last sections are reachable with the
      // finger still comfortably on screen.
      const pad = rect.height * 0.12;
      const f = (clientY - rect.top - pad) / (rect.height - pad * 2);
      return Math.max(0, Math.min(sections.length - 1, f * (sections.length - 1)));
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
        window.dispatchEvent(new Event("scroll"));
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
            className="fixed inset-0 z-40 touch-none bg-background/60 backdrop-blur-sm xl:hidden"
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
          "pointer-events-none fixed top-1/2 right-1 -translate-y-1/2 overflow-hidden xl:hidden",
          open ? "z-50" : "z-30"
        )}
        style={{
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
          className="pointer-events-auto absolute inset-y-0 right-0 w-10 cursor-pointer touch-none"
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
  const sections = useSections();
  const lockRef = useRef(false);

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
   * while the document glides underneath. The scroll lockRef keeps the two
   * from fighting; any user input cancels the glide immediately.
   */
  const jumpTo = useCallback(
    (i: number) => {
      const el = sections[i]?.el;
      if (!el) return;
      const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - 96);
      if (el.id) window.history.replaceState(null, "", `#${el.id}`);

      lockRef.current = true;
      progress.set(i);

      if (reduced) {
        window.scrollTo(0, top);
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
    [sections, reduced, progress]
  );

  if (sections.length < 2) return null;

  return (
    <>
      <DesktopRuler
        sections={sections}
        items={items}
        p={smooth}
        reduced={reduced}
        onJump={jumpTo}
      />
      <MobileRuler
        sections={sections}
        items={items}
        progress={progress}
        smooth={smooth}
        lockRef={lockRef}
        reduced={reduced}
        onJump={jumpTo}
      />
    </>
  );
}
