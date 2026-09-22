"use client";

import { HANDOFF, useHomeEditing } from "@/components/ui/home-edit-store";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { useCommand } from "@/systems/command";
import { useCompactViewport } from "@/systems/command/use-compact-viewport";
import { useDevtool } from "@/systems/devtool";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { FileText, GitCommit, Home, Search, Sparkles } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useScrollShrunk } from "./use-scroll-shrunk";
import { useTransitionSolid } from "./use-transition-solid";

// =============================================================================
// LiquidTabBar — phone-only five-tab glass dock behind a DevTool switch.
//
// Replaces the Search FAB on compact viewports when `liquidTabBar` is on.
// Order is fixed: Home · Writing · Search · Works · Prompts. Search still
// opens the command drawer; the other four navigate.
//
// The selection is one rounded rectangle — concentric with the bar (outer
// radius minus the padding), the iOS 26 glass stamp rather than a circle.
// It moves by transform only. A horizontal drag scrubs it 1:1 between tabs
// (the liquid-glass finger-scrub: the stamp tracks the finger, icons light
// up as it passes them, and the route changes on release, never mid-drag).
// A tap still selects directly. Scroll-down scales the whole dock, also by
// transform, so the stamp's translation stays in local pixels.
// =============================================================================

/** Release spring, nearly critically damped — settles, does not bounce. */
const SPRING = { type: "spring" as const, stiffness: 520, damping: 42, mass: 0.8 };

/** Hold the bar this long and the DevTool opens (same as the Search FAB). */
const DEVTOOL_HOLD_MS = 1200;
const DEVTOOL_HOLD_REVEAL_MS = 700;
const HOLD_SLOP_PX = 10;
const HOLD_RING_OUTSET = 10;

/**
 * A horizontal move past this, larger than the vertical one, is a scrub
 * rather than a tap or a scroll.
 */
const SCRUB_SLOP_PX = 8;

/**
 * Rounded rectangle, not a pill. 18px on a ~52px bar leaves flat top and
 * bottom edges — the liquid-glass toolbar, not a circle.
 * The stamp's radius is the outer radius minus the 4px padding, so the
 * corners stay concentric.
 */
const BAR_RADIUS = 18;
const STAMP_RADIUS = 14;

/** Full size vs scroll-down temporary shrink. Applied as transform only. */
const SCALE_FULL = 1;
const SCALE_SHRUNK = 0.86;

/** How far a fast scrub may stretch the stamp, as a fraction. */
const STRETCH_MAX = 0.08;

type TabId = "home" | "writing" | "search" | "works" | "prompt";

interface TabDef {
  id: TabId;
  /** Navigate target; absent for Search (opens the drawer). */
  href?: string;
  match?: (pathname: string) => boolean;
  icon: ReactNode;
  labelKey:
    | "home"
    | "writingTitle"
    | "searchMobile"
    | "worksTitle"
    | "promptsTitle";
}

interface Slot {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ICON = "h-5 w-5";

const TABS: TabDef[] = [
  {
    id: "home",
    href: "/",
    match: (p) => p === "/",
    icon: <Home className={ICON} strokeWidth={2} />,
    labelKey: "home",
  },
  {
    id: "writing",
    href: "/writing",
    match: (p) => p === "/writing" || p.startsWith("/writing/"),
    icon: <FileText className={ICON} strokeWidth={2} />,
    labelKey: "writingTitle",
  },
  {
    id: "search",
    icon: <Search className={ICON} strokeWidth={2} />,
    labelKey: "searchMobile",
  },
  {
    id: "works",
    href: "/works",
    match: (p) => p === "/works" || p.startsWith("/works/"),
    icon: <GitCommit className={ICON} strokeWidth={2} />,
    labelKey: "worksTitle",
  },
  {
    id: "prompt",
    href: "/prompt",
    match: (p) => p === "/prompt" || p.startsWith("/prompt/"),
    icon: <Sparkles className={ICON} strokeWidth={2} />,
    labelKey: "promptsTitle",
  },
];

function activeTabId(pathname: string, searchOpen: boolean): TabId | null {
  // While the drawer is open, Search owns the stamp — it is the action in
  // progress, and sliding there then back is the liquid read.
  if (searchOpen) return "search";
  for (const tab of TABS) {
    if (tab.match?.(pathname)) return tab.id;
  }
  return null;
}

export function LiquidTabBar() {
  const { liquidTabBar, summon: summonDevtool } = useDevtool();
  const { isOpen: searchOpen, toggle, close } = useCommand();
  const { locale } = useLocale();
  const pathname = usePathname();
  const router = useTransitionRouter();
  const compact = useCompactViewport();
  const homeEditing = useHomeEditing();
  const shrunk = useScrollShrunk();
  const reduceMotion = useReducedMotion();
  const shown = liquidTabBar && compact;
  const solid = useTransitionSolid(shown);

  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(0);

  const routeId = activeTabId(pathname, searchOpen);
  const routeIndex = TABS.findIndex((tab) => tab.id === routeId);

  // Stamp geometry, in the bar's local pixels (immune to the scroll scale).
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const width = useMotionValue(0);
  const height = useMotionValue(0);
  const stretch = useMotionValue(1);
  const stampOpacity = useMotionValue(0);

  const trackRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const slotsRef = useRef<(Slot | null)[]>([]);
  const draggingRef = useRef(false);
  const previewRef = useRef(0);
  const routeIndexRef = useRef(routeIndex);
  const reduceRef = useRef(reduceMotion);
  const animRef = useRef<Array<{ stop: () => void }>>([]);
  const lastSample = useRef({ x: 0, t: 0 });
  // Separate from the hold origin: cancelling the hold must not drop the scrub.
  const gestureOrigin = useRef<{ x: number; y: number; pointerId: number } | null>(null);

  const stopAnims = useCallback(() => {
    for (const a of animRef.current) a.stop();
    animRef.current = [];
  }, []);

  const glideTo = useCallback(
    (index: number) => {
      const slot = slotsRef.current[index];
      if (!slot) return;
      stopAnims();
      if (reduceRef.current) {
        x.set(slot.x);
        y.set(slot.y);
        width.set(slot.w);
        height.set(slot.h);
        stretch.set(1);
        return;
      }
      animRef.current = [
        animate(x, slot.x, SPRING),
        animate(y, slot.y, SPRING),
        animate(width, slot.w, SPRING),
        animate(height, slot.h, SPRING),
        animate(stretch, 1, SPRING),
      ];
    },
    [stopAnims, x, y, width, height, stretch]
  );

  const measure = useCallback(() => {
    slotsRef.current = tabRefs.current.map((el) =>
      el
        ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }
        : null
    );
  }, []);

  // Place (or re-place) the stamp on the route's tab. Skipped mid-scrub so
  // a render cannot pull the stamp off the finger.
  useLayoutEffect(() => {
    routeIndexRef.current = routeIndex;
    reduceRef.current = reduceMotion;
    if (!shown) return;
    measure();
    if (draggingRef.current) return;
    if (routeIndex < 0) {
      stampOpacity.set(0);
      return;
    }
    const slot = slotsRef.current[routeIndex];
    if (!slot) return;
    previewRef.current = routeIndex;
    stampOpacity.set(1);
    if (width.get() === 0) {
      x.set(slot.x);
      y.set(slot.y);
      width.set(slot.w);
      height.set(slot.h);
      return;
    }
    glideTo(routeIndex);
  }, [shown, routeIndex, reduceMotion, measure, glideTo, x, y, width, height, stampOpacity]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !shown) return;
    const observer = new ResizeObserver(() => {
      measure();
      if (draggingRef.current) return;
      const index = routeIndexRef.current;
      const slot = index >= 0 ? slotsRef.current[index] : null;
      if (!slot) return;
      x.set(slot.x);
      y.set(slot.y);
      width.set(slot.w);
      height.set(slot.h);
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, [shown, measure, x, y, width, height]);

  const localX = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const scale = rect.width / track.offsetWidth || 1;
    return (clientX - rect.left) / scale;
  }, []);

  // Nearest tab in viewport pixels, so a scaled bar and a device-mode
  // viewport still agree about which icon the finger is on.
  const indexAt = useCallback((clientX: number) => {
    let best = 0;
    let bestD = Infinity;
    tabRefs.current.forEach((el, i) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const d = Math.abs(clientX - (rect.left + rect.width / 2));
      if (d < bestD) {
        best = i;
        bestD = d;
      }
    });
    return best;
  }, []);

  // Hold-to-summon DevTool — same hidden gesture as the Search FAB.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdOrigin = useRef<{ x: number; y: number } | null>(null);
  const heldRef = useRef(false);
  const suppressClick = useRef(false);
  const [holdRing, setHoldRing] = useState<DOMRect | null>(null);

  const cancelHold = useCallback(() => {
    clearTimeout(holdTimer.current ?? undefined);
    clearTimeout(revealTimer.current ?? undefined);
    holdOrigin.current = null;
    setHoldRing(null);
  }, []);

  const startHold = useCallback(
    (point: { clientX: number; clientY: number }) => {
      heldRef.current = false;
      holdOrigin.current = { x: point.clientX, y: point.clientY };
      revealTimer.current = setTimeout(() => {
        setHoldRing(trackRef.current?.getBoundingClientRect() ?? null);
      }, DEVTOOL_HOLD_REVEAL_MS);
      holdTimer.current = setTimeout(() => {
        heldRef.current = true;
        setHoldRing(null);
        summonDevtool();
      }, DEVTOOL_HOLD_MS);
    },
    [summonDevtool]
  );

  useEffect(() => cancelHold, [cancelHold]);

  const commit = useCallback(
    (index: number) => {
      const tab = TABS[index];
      if (!tab) return;
      if (tab.id === "search") {
        if (!searchOpen) toggle();
        return;
      }
      if (searchOpen) close();
      if (tab.href && !tab.match?.(pathname)) router.push(tab.href);
    },
    [toggle, close, searchOpen, pathname, router]
  );

  const followFinger = useCallback(
    (clientX: number) => {
      const lx = localX(clientX);
      const slots = slotsRef.current.filter((s): s is Slot => s !== null);
      if (!slots.length) return;
      const w = width.get() || slots[0].w;
      const min = slots[0].x;
      const max = slots[slots.length - 1].x;
      x.set(Math.min(max, Math.max(min, lx - w / 2)));

      const now = performance.now();
      const prev = lastSample.current;
      const dt = Math.max(now - prev.t, 8);
      const v = Math.abs(lx - prev.x) / dt;
      lastSample.current = { x: lx, t: now };
      stretch.set(1 + Math.min(v * 0.12, STRETCH_MAX));

      const next = indexAt(clientX);
      if (next !== previewRef.current) {
        previewRef.current = next;
        setPreview(next);
      }
    },
    [localX, indexAt, x, width, stretch]
  );

  // Latest gesture callbacks for the window listeners. A scrub has to keep
  // receiving moves after the finger leaves a tab button — element listeners
  // drop that pointerup, and the click is cancelled with it, so the release
  // selected nothing.
  const gestureApi = useRef({
    followFinger,
    cancelHold,
    stopAnims,
    measure,
    glideTo,
    commit,
    indexAt,
    localX,
  });
  useLayoutEffect(() => {
    gestureApi.current = {
      followFinger,
      cancelHold,
      stopAnims,
      measure,
      glideTo,
      commit,
      indexAt,
      localX,
    };
  }, [followFinger, cancelHold, stopAnims, measure, glideTo, commit, indexAt, localX]);

  useEffect(() => {
    const finish = (e: PointerEvent, commitRelease: boolean) => {
      const origin = gestureOrigin.current;
      if (!origin || e.pointerId !== origin.pointerId) return;
      gestureOrigin.current = null;
      const api = gestureApi.current;
      api.cancelHold();
      draggingRef.current = false;
      setDragging(false);
      if (!commitRelease || heldRef.current) {
        heldRef.current = false;
        if (routeIndexRef.current >= 0) api.glideTo(routeIndexRef.current);
        return;
      }
      // Release point, not the last preview — the finger is the selection.
      const index = api.indexAt(e.clientX);
      api.glideTo(index);
      api.commit(index);
    };

    const onMove = (e: PointerEvent) => {
      const origin = gestureOrigin.current;
      if (!origin || e.pointerId !== origin.pointerId) return;
      const api = gestureApi.current;
      if (draggingRef.current) {
        api.followFinger(e.clientX);
        return;
      }
      if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > HOLD_SLOP_PX) {
        api.cancelHold();
      }
      if (Math.abs(e.clientX - origin.x) < SCRUB_SLOP_PX) return;
      draggingRef.current = true;
      api.cancelHold();
      api.stopAnims();
      api.measure();
      const slot = slotsRef.current.find((s) => s !== null);
      if (slot && width.get() === 0) {
        y.set(slot.y);
        width.set(slot.w);
        height.set(slot.h);
      }
      stampOpacity.set(1);
      setDragging(true);
      api.followFinger(e.clientX);
    };

    // Mouse fallback for input paths that emit mousedown/move/up and no
    // pointer events. Real pointers claim the gesture first (pointerdown
    // fires before mousedown), so this does not double-fire on a finger.
    const onMouseMove = (e: MouseEvent) => {
      const origin = gestureOrigin.current;
      if (!origin || origin.pointerId !== -1) return;
      onMove({ ...e, pointerId: -1 } as PointerEvent);
    };
    const onMouseUp = (e: MouseEvent) => {
      const origin = gestureOrigin.current;
      if (!origin || origin.pointerId !== -1) return;
      finish({ ...e, pointerId: -1 } as PointerEvent, true);
    };

    const onUp = (e: PointerEvent) => finish(e, true);
    const onCancel = (e: PointerEvent) => finish(e, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [width, y, height, stampOpacity]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      gestureOrigin.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
      suppressClick.current = true;
      measure();
      startHold(e);
      lastSample.current = { x: localX(e.clientX), t: performance.now() };
    },
    [startHold, localX, measure]
  );

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (!suppressClick.current && !heldRef.current) return;
    suppressClick.current = false;
    heldRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleTab = useCallback(
    (index: number) => {
      if (heldRef.current) {
        heldRef.current = false;
        return;
      }
      commit(index);
    },
    [commit]
  );

  if (!shown) return null;

  const yielding = homeEditing;
  const lit = dragging ? preview : routeIndex;

  return (
    <>
      <div
        className={cn(
          "system-chrome fixed bottom-6 left-0 right-0 z-50 px-6",
          "flex justify-center pointer-events-none"
        )}
      >
        <motion.div
          ref={trackRef}
          role="tablist"
          aria-label={locale === "zh" ? "导航" : "Navigation"}
          data-liquid-tabs=""
          data-tab-solid={solid ? "" : undefined}
          onPointerDown={onPointerDown}
          onMouseDown={(e) => {
            if (e.button !== 0 || gestureOrigin.current) return;
            gestureOrigin.current = { x: e.clientX, y: e.clientY, pointerId: -1 };
            suppressClick.current = true;
            measure();
            startHold(e);
            lastSample.current = { x: localX(e.clientX), t: performance.now() };
          }}
          onClickCapture={onClickCapture}
          className={cn(
            "pointer-events-auto relative select-none",
            "flex items-center gap-1 p-1",
            "border border-border/50 shadow-raised",
            // Touch owns the horizontal scrub; the page still scrolls around it.
            "touch-none",
            yielding && "pointer-events-none",
            solid ? "bg-[var(--glass-base)]" : "bg-glass backdrop-blur-xl"
          )}
          style={{
            borderRadius: BAR_RADIUS,
            transformOrigin: "50% 100%",
            ...(solid
              ? { backdropFilter: "none", WebkitBackdropFilter: "none" }
              : null),
          }}
          animate={{
            opacity: yielding ? 0 : 1,
            scale: yielding ? SCALE_FULL : shrunk ? SCALE_SHRUNK : SCALE_FULL,
          }}
          transition={{
            opacity: yielding
              ? { duration: HANDOFF.out }
              : { duration: HANDOFF.in, delay: HANDOFF.delay },
            scale: reduceMotion
              ? { duration: 0 }
              : { type: "tween", duration: 0.28, ease: [0.32, 0.72, 0, 1] },
          }}
        >
          <motion.span
            aria-hidden
            className={cn(
              "absolute z-0 ring-1 ring-foreground/10",
              solid
                ? "bg-[color-mix(in_oklab,var(--foreground)_12%,var(--glass-base))]"
                : "bg-glass-strong"
            )}
            style={{
              borderRadius: STAMP_RADIUS,
              left: 0,
              top: 0,
              x,
              y,
              width,
              height,
              scaleX: stretch,
              opacity: stampOpacity,
              ...(solid
                ? { backdropFilter: "none", WebkitBackdropFilter: "none" }
                : null),
            }}
          />
          {TABS.map((tab, i) => {
            const selected = lit === i;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                aria-selected={routeIndex === i}
                aria-label={t(locale, tab.labelKey)}
                onClick={() => handleTab(i)}
                className={cn(
                  "relative z-10 flex h-11 w-14 items-center justify-center",
                  "outline-none transition-colors duration-150",
                  selected
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
                style={{ borderRadius: STAMP_RADIUS }}
              >
                {tab.icon}
              </button>
            );
          })}
        </motion.div>
      </div>

      <AnimatePresence>
        {holdRing && (
          <motion.span
            aria-hidden
            data-hold-ring
            initial={{ scale: 1.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.08, opacity: 0, transition: { duration: 0.18 } }}
            transition={{
              duration: (DEVTOOL_HOLD_MS - DEVTOOL_HOLD_REVEAL_MS) / 1000,
              ease: "linear",
            }}
            style={{
              position: "fixed",
              left: holdRing.x - HOLD_RING_OUTSET,
              top: holdRing.y - HOLD_RING_OUTSET,
              width: holdRing.width + HOLD_RING_OUTSET * 2,
              height: holdRing.height + HOLD_RING_OUTSET * 2,
              borderRadius: BAR_RADIUS + HOLD_RING_OUTSET,
              zIndex: 9998,
            }}
            className="pointer-events-none border-2 border-foreground/35"
          />
        )}
      </AnimatePresence>
    </>
  );
}
