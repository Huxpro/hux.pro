"use client";

import { cn } from "@/lib/utils";
import { useInputCapability } from "@/services";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// =============================================================================
// WidgetScrollRow — the horizontal snapping stack, as one primitive.
//
// The row counterpart of `WidgetScrollBody`: cards snap under the card's
// padding, both edges fade out under a mask instead of clipping hard, a dot
// rail below reports (and jumps to) the active card, and — for fine pointers
// only — a pair of chevrons appears on hover at the row's edges so a mouse can
// browse the stack without dragging. Touch keeps its native swipe.
//
// Cards mark themselves with `data-carousel-card`; the row measures the first
// one (plus the flex gap) as the snap stride.
// =============================================================================

export function WidgetScrollRow({
  count,
  resetKey,
  className,
  children,
}: {
  /** Number of cards — drives the dots and the chevrons' end detection. */
  count: number;
  /** When this changes the row scrolls back to the start (e.g. album switch). */
  resetKey?: unknown;
  className?: string;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { hasFineHoverPointer } = useInputCapability();

  const getStride = useCallback((): number | null => {
    const el = scrollRef.current;
    if (!el) return null;
    const card = el.querySelector<HTMLElement>("[data-carousel-card]");
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
    setActiveIndex(Math.min(Math.max(next, 0), Math.max(count - 1, 0)));
  }, [getStride, count]);

  const scrollToIndex = useCallback(
    (index: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const stride = getStride();
      if (!stride) return;
      const clamped = Math.min(Math.max(index, 0), Math.max(count - 1, 0));
      el.scrollTo({ left: clamped * stride, behavior: "smooth" });
    },
    [getStride, count],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Jump back to the start when the content set changes (album switch).
  // Layout effect so the reset lands before paint — no flash of the old
  // offset over the new cards.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: 0 });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing derived scroll state to the reset
    setActiveIndex(0);
  }, [resetKey]);

  // Pointer capability is only known on the client; render the chevrons
  // after mount so the server and first client paint agree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: browser-only capability gate
    setMounted(true);
  }, []);
  const showChevrons = mounted && hasFineHoverPointer && count > 1;
  const atStart = activeIndex <= 0;
  const atEnd = activeIndex >= count - 1;

  return (
    <div className={cn("group/row relative pb-5", className)}>
      <div
        ref={scrollRef}
        className={cn(
          "flex gap-3 pl-5 pr-5",
          "overflow-x-auto snap-x snap-mandatory scroll-pl-5 scroll-smooth",
          "no-scrollbar",
          // Edge fades sized to the padding: at rest only the gutters fade;
          // once scrolled, cards slip under the fade instead of being cut.
          "[mask-image:linear-gradient(to_right,transparent,black_20px,black_calc(100%-20px),transparent)]",
        )}
      >
        {children}
        <div className="w-5 shrink-0" aria-hidden />
      </div>

      {showChevrons && (
        <>
          <RowChevron
            side="left"
            hidden={atStart}
            onClick={() => scrollToIndex(activeIndex - 1)}
          />
          <RowChevron
            side="right"
            hidden={atEnd}
            onClick={() => scrollToIndex(activeIndex + 1)}
          />
        </>
      )}

      {count > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-3">
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollToIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-200",
                i === activeIndex
                  ? "w-3 bg-foreground/60"
                  : "w-1.5 bg-foreground/20 hover:bg-foreground/40",
              )}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Hover chevron at a row edge — a small frosted disc that only exists for
 * fine pointers, fades in with the row's hover, and steps out of the way at
 * the end it can't scroll past. Vertically centred on the card area (the
 * dots below are excluded via the bottom offset).
 */
function RowChevron({
  side,
  hidden,
  onClick,
}: {
  side: "left" | "right";
  hidden: boolean;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={-1}
      aria-hidden
      className={cn(
        "absolute top-1/2 z-10 -translate-y-1/2 -mt-5",
        side === "left" ? "left-2" : "right-2",
        "inline-flex h-7 w-7 items-center justify-center rounded-full",
        "border border-border/60 bg-card/80 text-muted-foreground shadow-raised backdrop-blur-xl",
        "transition-all duration-200 hover:text-foreground",
        hidden
          ? "pointer-events-none opacity-0"
          : "opacity-0 group-hover/row:opacity-100",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
