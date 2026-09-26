"use client";

import { cn } from "@/lib/utils";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

// =============================================================================
// SnapPager — the horizontally stacked, snap-paged strip the home widgets
// are built from, as one primitive.
//
// The Featured Talks widget and the featured-stack widget each wrote their own
// copy of the same three things: a scroll track that snaps card by card, a
// reading of which card is in view (scrollLeft ÷ the card's stride), and a row
// of dots that reports it and jumps to a card on tap. The attachment surface
// (systems/attachments) is the third strip built this way, and the one that
// made the pattern worth naming: a pager is a pager whether it holds talk
// covers, featured commits or a commit's attachments, and the dots should
// read identically wherever they appear.
//
// Two pieces, composed by the caller so the track can keep its own padding,
// widths and gaps:
//
//   useSnapPager(count)   the scroll ref, the in-view index, scrollTo(i)
//   <PagerDots>           the indicator row, tappable
//
// A card marks itself with `data-pager-card`; the hook measures the first one
// for the stride (its width plus the track's gap), so cards must be uniform.
//
// A track that can overflow vertically, even by a pixel, should also say
// `overflow-y-hidden`. `overflow-x: auto` makes Y `auto` as well, and a track
// that scrolls both ways drifts vertically under a sideways swipe on iOS (see
// the attachment surface, where it did). A track inside a bottom sheet also
// wants `useSheetAxisLock` (systems/surface), so a diagonal swipe moves the
// track or the sheet, never both.
// =============================================================================

/** Marks one page of the track. The hook reads the first for the stride. */
export const PAGER_CARD_ATTR = "data-pager-card";

export interface SnapPager {
  /** The scroll track. */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** The card currently in view — live, for the dots and the counter. */
  index: number;
  /**
   * The card the track came to rest on. It moves only once scrolling has
   * stopped, so anything that restyles the cards (inert, aria-hidden) waits
   * for the snap to finish instead of landing in the middle of it.
   */
  settled: number;
  /** Smooth-scroll the track to a card. */
  scrollTo: (index: number, behavior?: ScrollBehavior) => void;
}

/**
 * Quiet time (ms) after the last scroll event, with no finger on the track,
 * that counts as at rest. A finger that pauses mid-drag stops the scroll
 * events too, and the snap has not started yet.
 */
const SETTLE_MS = 150;

export function useSnapPager(count: number, initial = 0): SnapPager {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(initial);
  const [settled, setSettled] = useState(initial);
  const settleTimer = useRef<number | undefined>(undefined);
  const touching = useRef(false);
  const latest = useRef(initial);

  const getStride = useCallback((): number | null => {
    const el = scrollRef.current;
    if (!el) return null;
    const card = el.querySelector<HTMLElement>(`[${PAGER_CARD_ATTR}]`);
    if (!card) return null;
    const gap = Number.parseFloat(getComputedStyle(el).gap || "0");
    return card.offsetWidth + (Number.isFinite(gap) ? gap : 0);
  }, []);

  const armSettle = () => {
    window.clearTimeout(settleTimer.current);
    if (touching.current) return;
    settleTimer.current = window.setTimeout(() => setSettled(latest.current), SETTLE_MS);
  };

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const stride = getStride();
    if (!stride) return;
    const next = Math.min(
      Math.max(Math.round(el.scrollLeft / stride), 0),
      Math.max(count - 1, 0),
    );
    latest.current = next;
    setIndex(next);
    armSettle();
  }, [getStride, count]);

  const scrollTo = useCallback(
    (i: number, behavior: ScrollBehavior = "smooth") => {
      const el = scrollRef.current;
      if (!el) return;
      const stride = getStride();
      if (!stride) return;
      el.scrollTo({ left: i * stride, behavior });
    },
    [getStride],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const down = (e: TouchEvent) => {
      touching.current = e.touches.length > 0;
      window.clearTimeout(settleTimer.current);
    };
    const up = (e: TouchEvent) => {
      touching.current = e.touches.length > 0;
      armSettle();
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    el.addEventListener("touchstart", down, { passive: true });
    el.addEventListener("touchend", up, { passive: true });
    el.addEventListener("touchcancel", up, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      el.removeEventListener("touchstart", down);
      el.removeEventListener("touchend", up);
      el.removeEventListener("touchcancel", up);
      window.clearTimeout(settleTimer.current);
    };
  }, [handleScroll]);

  return { scrollRef, index, settled, scrollTo };
}

export interface PagerDotsProps {
  count: number;
  index: number;
  /** Tappable when supplied; a plain indicator otherwise. */
  onSelect?: (index: number) => void;
  /** Accessible name for a dot; receives the 1-based page number. */
  label?: (page: number) => string;
  className?: string;
}

/**
 * The indicator: one dot per page, the current one drawn as a short bar. The
 * geometry is the widgets' — a 6px dot, a 12px bar — and the ink is the
 * foreground at an alpha so it sits on glass and on the page alike.
 */
export function PagerDots({
  count,
  index,
  onSelect,
  label = (page) => `Go to page ${page}`,
  className,
}: PagerDotsProps) {
  if (count <= 1) return null;
  return (
    <div
      className={cn("flex items-center justify-center gap-1.5", className)}
      role={onSelect ? "tablist" : undefined}
      aria-hidden={onSelect ? undefined : true}
    >
      {Array.from({ length: count }, (_, i) => {
        const active = i === index;
        const shape = cn(
          "h-1.5 rounded-full transition-all duration-200",
          active ? "w-3 bg-foreground/60" : "w-1.5 bg-foreground/20",
        );
        return onSelect ? (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={label(i + 1)}
            onClick={() => onSelect(i)}
            className={cn(
              // The well is 24px (WCAG 2.5.8); `-m-[9px]` cancels the extra
              // so the row still reads as 6px dots with a 6px gap.
              "pressable relative -m-[9px] inline-flex size-6 items-center justify-center rounded-full outline-none",
              "hover:bg-foreground/[0.08] focus-visible:bg-foreground/[0.08] active:bg-foreground/[0.12]",
            )}
          >
            <span className={shape} aria-hidden />
          </button>
        ) : (
          <span key={i} className={shape} />
        );
      })}
    </div>
  );
}
