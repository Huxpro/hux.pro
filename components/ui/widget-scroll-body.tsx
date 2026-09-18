"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import {
  ADAPTIVE_PRESENTATION,
  AdaptiveSurface,
} from "@/systems/surface";
import { GripVertical } from "lucide-react";
import { Link } from "next-view-transitions";
import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useWidgetScrollMode } from "./widget-scroll-mode";
import { pageChildren } from "./widget-scroll";

// =============================================================================
// WidgetScrollBody — the vertically clipped stack, plus the prototypes that
// try to stop it fighting the page on a phone.
//
// Nested (default) is the body that shipped: overflow-y, snap-y, a fade on
// the tail. Every other mode is a prototype behind the home lab bar.
// =============================================================================

export function WidgetScrollBody({
  className,
  children,
  label,
  href,
  sheetId,
  pageSize = 3,
}: {
  /** Height goes here — defaults to a fixed `h-64`; pass `max-h-*` for a
   *  stack that should only scroll once it overflows. */
  className?: string;
  children: ReactNode;
  /** Surface title for the sheet prototype, and rail/lock aria names. */
  label?: string;
  /** "View all" target, also used as the sheet's destination. */
  href?: string;
  /** AdaptiveSurface id so two widgets in sheet mode don't share a drawer. */
  sheetId?: string;
  /** How many rows share a screen in `pages` mode. */
  pageSize?: number;
}) {
  const { locale } = useLocale();
  const { mode } = useWidgetScrollMode();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [armed, setArmed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  const [seenMode, setSeenMode] = useState(mode);
  if (seenMode !== mode) {
    setSeenMode(mode);
    setExpanded(false);
    setArmed(false);
    setSheetOpen(false);
  }

  const heightClass = className ?? "h-64";
  const isExpanded = mode === "expand" && expanded;
  const isArmed = mode === "lock" && armed;
  // Rail keeps overflow hidden so the card never captures a vertical pan —
  // only the grip moves `scrollTop`. Nested / armed lock are the two modes
  // that opt back into a real inner scroller.
  const innerScrolls = mode === "nested" || isArmed;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || isExpanded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM: overflow check
      setOverflows(false);
      return;
    }
    const sync = () => {
      setOverflows(el.scrollHeight > el.clientHeight + 1);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode, isExpanded, children]);

  const frameClass = cn(
    "relative -mx-2 px-2",
    isExpanded ? "pb-5" : "pb-7",
    !isExpanded && heightClass,
    innerScrolls &&
      "overflow-y-auto snap-y snap-mandatory scroll-smooth no-scrollbar",
    !innerScrolls && mode !== "pages" && "overflow-hidden touch-pan-y",
    !isExpanded &&
      "[mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]",
  );

  const showMore = mode === "expand" && overflows && !expanded;
  const showLess = mode === "expand" && expanded;
  const showLock = mode === "lock" && overflows;
  const showBrowse = mode === "sheet" && overflows && !!sheetId;
  const showRail = mode === "rail" && overflows;

  return (
    <div className="px-5">
      <div
        className={cn(
          "relative flex",
          isArmed && "rounded-xl ring-2 ring-foreground/35",
        )}
        data-widget-scroll={mode}
        data-widget-scroll-armed={isArmed ? "" : undefined}
        data-widget-scroll-expanded={isExpanded ? "" : undefined}
        data-widget-scroll-overflows={overflows ? "" : undefined}
      >
        {mode === "pages" ? (
          <PagesBody
            className={cn("min-w-0 flex-1", heightClass)}
            pageSize={pageSize}
          >
            {children}
          </PagesBody>
        ) : (
          <div ref={scrollerRef} className={cn("min-w-0 flex-1", frameClass)}>
            {children}
          </div>
        )}

        {showRail && (
          <WidgetScrollRail
            scrollerRef={scrollerRef}
            label={t(locale, "widgetScrollRailAria")}
          />
        )}

        {(showMore || showLess) && (
          <Affordance
            label={t(locale, showLess ? "widgetScrollLess" : "widgetScrollMore")}
            onClick={() => setExpanded((v) => !v)}
          />
        )}
        {showLock && (
          <Affordance
            label={t(locale, armed ? "widgetScrollArmed" : "widgetScrollArm")}
            pressed={armed}
            onClick={() => setArmed((v) => !v)}
          />
        )}
        {showBrowse && (
          <Affordance
            label={t(locale, "widgetScrollBrowse")}
            onClick={() => setSheetOpen(true)}
          />
        )}
      </div>

      {mode === "sheet" && sheetId && (
        <AdaptiveSurface
          id={sheetId}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          presentation={ADAPTIVE_PRESENTATION}
          title={label ?? t(locale, "widgetScrollBrowse")}
          closeLabel={t(locale, "widgetScrollClose")}
          snapPoints={[0.55, 0.92]}
          contentClassName="px-4 pb-6"
          actions={
            href ? (
              <Link
                href={href}
                className="rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
              >
                {t(locale, "widgetScrollViewAll")}
              </Link>
            ) : undefined
          }
        >
          <div className="-mx-1">{children}</div>
        </AdaptiveSurface>
      )}
    </div>
  );
}

function Affordance({
  label,
  onClick,
  pressed,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-widget-scroll-affordance=""
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "pressable absolute bottom-2 left-1/2 z-10 -translate-x-1/2",
        "rounded-full border border-border/60 bg-glass-strong px-3 py-1",
        "font-mono text-[10px] uppercase tracking-wider text-muted-foreground",
        "shadow-raised backdrop-blur-xl",
        "hover:text-foreground active:bg-muted/40 active:text-foreground",
        pressed && "bg-foreground text-background border-foreground/40",
      )}
    >
      {label}
    </button>
  );
}

function WidgetScrollRail({
  scrollerRef,
  label,
}: {
  scrollerRef: RefObject<HTMLDivElement | null>;
  label: string;
}) {
  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    e.stopPropagation();
    const pointerId = e.pointerId;
    const startY = e.clientY;
    const startScroll = scroller.scrollTop;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      scroller.scrollTop = startScroll + (startY - ev.clientY);
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const step = e.key === "PageDown" || e.key === "PageUp" ? scroller.clientHeight : 48;
    if (e.key === "ArrowDown" || e.key === "PageDown") {
      e.preventDefault();
      scroller.scrollTop += step;
    } else if (e.key === "ArrowUp" || e.key === "PageUp") {
      e.preventDefault();
      scroller.scrollTop -= step;
    } else if (e.key === "Home") {
      e.preventDefault();
      scroller.scrollTop = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      scroller.scrollTop = scroller.scrollHeight;
    }
  };

  return (
    <button
      type="button"
      data-widget-inert
      aria-label={label}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onClick={(e) => e.stopPropagation()}
      className="pressable relative mb-7 w-8 shrink-0 touch-none cursor-ns-resize self-stretch"
      data-widget-scroll-rail
    >
      <span
        aria-hidden
        className="absolute inset-y-3 left-1/2 w-1 -translate-x-1/2 rounded-full bg-foreground/15"
      />
      <GripVertical
        aria-hidden
        className="absolute top-1/2 left-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-muted-foreground"
      />
    </button>
  );
}

function PagesBody({
  className,
  pageSize,
  children,
}: {
  className?: string;
  pageSize: number;
  children: ReactNode;
}) {
  const nodes = Children.toArray(children);
  const pages = pageChildren(nodes, pageSize);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    setActive(
      Math.min(
        pages.length - 1,
        Math.max(0, Math.round(el.scrollLeft / el.clientWidth)),
      ),
    );
  }, [pages.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const scrollTo = (index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="min-w-0 w-full flex-1">
      <div
        ref={scrollRef}
        data-widget-scroll-pages
        className={cn(
          "flex w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden",
          "overscroll-x-contain touch-pan-x scroll-smooth no-scrollbar",
          className,
        )}
      >
        {pages.map((page, i) => (
          <div
            key={i}
            className={cn(
              "w-full min-w-full shrink-0 snap-start snap-always overflow-hidden",
              "relative px-2 pb-7",
              "[mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]",
            )}
          >
            {page}
          </div>
        ))}
      </div>
      {pages.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pb-3 pt-1">
          {pages.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                scrollTo(i);
              }}
              className={cn(
                "pressable h-1.5 rounded-full transition-all duration-200",
                i === active
                  ? "w-3 bg-foreground/60"
                  : "w-1.5 bg-foreground/20 hover:bg-foreground/40 active:bg-foreground/55",
              )}
              aria-label={`Go to page ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
