"use client";

import { cn } from "@/lib/utils";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

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
 * FAB). Tapping the strip expands it in place — labels slide in over a
 * frosted scrim, mirroring the desktop hover state — and tapping a label
 * jumps to that section.
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
 */
function useReadingProgress(sections: Section[]): MotionValue<number> {
  const progress = useMotionValue(0);

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
  }, [sections, progress]);

  return progress;
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
  /**
   * How labels reveal:
   *  - "persistent": always readable near the reading line; the reveal
   *    value raises the floor for the rest (desktop hover).
   *  - "overlay": hidden until revealed (mobile expanded state).
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
  labels: "persistent",
};

const MOBILE: TapeVariant = {
  pitch: 44,
  drift: -6,
  minorDrift: -4,
  tickBase: 14,
  tickGrow: 12,
  minorWidth: 6,
  labels: "overlay",
};

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
  /** 0..1 — hover (desktop) or expanded (mobile). */
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
        ? r * Math.max(0.45, 1 - 0.35 * d)
        : Math.max(0.12, 1 - 0.55 * d, r * 0.65);
    }
  );
  const labelScale = useTransform(p, (v) =>
    reduced ? 1 : 1 + 0.14 * bell(item.index - v, 0.3)
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
          // Cap width so the active 1.14× scale-up still fits the tape box.
          "max-w-42 truncate text-right font-mono text-xs text-foreground focus:outline-none",
          interactive ? "pointer-events-auto cursor-pointer" : "pointer-events-none"
        )}
        style={{
          opacity: labelOpacity,
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
// Mobile — scrollbar-like tick strip on the right edge, expands on tap
// =============================================================================

function MobileRuler({
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
  const [open, setOpen] = useState(false);
  const reveal = useSpring(0, { stiffness: 300, damping: 32 });

  useEffect(() => {
    reveal.set(open ? 1 : 0);
  }, [open, reveal]);

  const jump = useCallback(
    (i: number) => {
      setOpen(false);
      onJump(i);
    },
    [onJump]
  );

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm xl:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <nav
        aria-label="Table of contents"
        className={cn(
          "pointer-events-none fixed top-1/2 right-2 -translate-y-1/2 overflow-hidden xl:hidden",
          open ? "z-50" : "z-30"
        )}
        style={{
          width: 240,
          height: "min(400px, 62svh)",
          maskImage: TAPE_MASK,
          WebkitMaskImage: TAPE_MASK,
        }}
      >
        <Tape
          sections={sections}
          items={items}
          variant={MOBILE}
          p={p}
          reveal={reveal}
          interactive={open}
          reduced={reduced}
          onJump={jump}
        />
        {/* Tap strip over the ticks — the collapsed ruler's only hit area. */}
        {!open && (
          <button
            type="button"
            aria-label="Table of contents"
            onClick={() => setOpen(true)}
            className="pointer-events-auto absolute inset-y-0 right-0 w-10 cursor-pointer"
          />
        )}
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
  const progress = useReadingProgress(sections);

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

  const jumpTo = useCallback(
    (i: number) => {
      const el = sections[i]?.el;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
      if (el.id) window.history.replaceState(null, "", `#${el.id}`);
    },
    [sections, reduced]
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
        p={smooth}
        reduced={reduced}
        onJump={jumpTo}
      />
    </>
  );
}
