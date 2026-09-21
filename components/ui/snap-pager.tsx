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
// =============================================================================

/** Marks one page of the track. The hook reads the first for the stride. */
export const PAGER_CARD_ATTR = "data-pager-card";

export interface SnapPager {
  /** The scroll track. */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** The card currently in view. */
  index: number;
  /** Smooth-scroll the track to a card. */
  scrollTo: (index: number, behavior?: ScrollBehavior) => void;
}

export function useSnapPager(count: number): SnapPager {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const getStride = useCallback((): number | null => {
    const el = scrollRef.current;
    if (!el) return null;
    const card = el.querySelector<HTMLElement>(`[${PAGER_CARD_ATTR}]`);
    if (!card) return null;
    const gap = Number.parseFloat(getComputedStyle(el).gap || "0");
    return card.offsetWidth + (Number.isFinite(gap) ? gap : 0);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const stride = getStride();
    if (!stride) return;
    const next = Math.round(el.scrollLeft / stride);
    setIndex(Math.min(Math.max(next, 0), Math.max(count - 1, 0)));
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
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return { scrollRef, index, scrollTo };
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
