"use client";

import { HANDOFF, useHomeEditing } from "@/components/ui/home-edit-store";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { useCommand } from "@/systems/command";
import { useCompactViewport } from "@/systems/command/use-compact-viewport";
import { useDevtool } from "@/systems/devtool";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FileText, GitCommit, Home, Search, Sparkles } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useScrollShrunk } from "./use-scroll-shrunk";

// =============================================================================
// LiquidTabBar — phone-only five-tab glass dock behind a DevTool switch.
//
// Replaces the Search FAB on compact viewports when `liquidTabBar` is on.
// Order is fixed: Home · Writing · Search · Works · Prompts. Search still
// opens the command drawer; the other four navigate. The active stamp is a
// single layoutId pill (same pattern as AlbumTabs) so the morph stays stable
// across route changes. Scroll-down temporarily scales the whole dock —
// transform on an outer wrapper, never a layout resize of the tabs — so the
// pill's layout projection does not fight the shrink.
// =============================================================================

/** Matches AlbumTabs — a soft settle, not a spring that overshoots. */
const EASE = [0.32, 0.72, 0, 1] as const;

/** Hold the bar this long and the DevTool opens (same as the Search FAB). */
const DEVTOOL_HOLD_MS = 1200;
const DEVTOOL_HOLD_REVEAL_MS = 700;
const HOLD_SLOP_PX = 10;
const HOLD_RING_OUTSET = 10;

/** Outer capsule radius — fully pill; the hold ring sits outside it. */
const BAR_RADIUS = 28;

/** Full size vs scroll-down temporary shrink. Applied as transform only. */
const SCALE_FULL = 1;
const SCALE_SHRUNK = 0.86;

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
  // progress, and morphing there then back is the liquid read.
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
  const pillId = useId();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration gate
    setMounted(true);
  }, []);

  // Hold-to-summon DevTool — same hidden gesture as the Search FAB, so phones
  // without a D key keep a way in once the FAB is gone.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdOrigin = useRef<{ x: number; y: number } | null>(null);
  const heldRef = useRef(false);
  const barRef = useRef<HTMLDivElement>(null);
  const [holdRing, setHoldRing] = useState<DOMRect | null>(null);

  const cancelHold = useCallback(() => {
    clearTimeout(holdTimer.current ?? undefined);
    clearTimeout(revealTimer.current ?? undefined);
    holdOrigin.current = null;
    setHoldRing(null);
  }, []);

  const startHold = useCallback(
    (e: React.PointerEvent) => {
      heldRef.current = false;
      holdOrigin.current = { x: e.clientX, y: e.clientY };
      revealTimer.current = setTimeout(() => {
        setHoldRing(barRef.current?.getBoundingClientRect() ?? null);
      }, DEVTOOL_HOLD_REVEAL_MS);
      holdTimer.current = setTimeout(() => {
        heldRef.current = true;
        setHoldRing(null);
        summonDevtool();
      }, DEVTOOL_HOLD_MS);
    },
    [summonDevtool]
  );

  const trackHold = useCallback(
    (e: React.PointerEvent) => {
      const origin = holdOrigin.current;
      if (!origin) return;
      if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > HOLD_SLOP_PX) {
        cancelHold();
      }
    },
    [cancelHold]
  );

  useEffect(() => cancelHold, [cancelHold]);

  const handleTab = useCallback(
    (tab: TabDef) => {
      if (heldRef.current) {
        heldRef.current = false;
        return;
      }
      if (tab.id === "search") {
        toggle();
        return;
      }
      if (searchOpen) close();
      if (tab.href && !tab.match?.(pathname)) {
        router.push(tab.href);
      }
    },
    [toggle, close, searchOpen, pathname, router]
  );

  if (!mounted || !liquidTabBar || !compact) return null;

  const yielding = homeEditing;
  const active = activeTabId(pathname, searchOpen);

  return (
    <>
      <div
        className={cn(
          "system-chrome fixed bottom-6 left-0 right-0 z-50 px-6",
          "flex justify-center pointer-events-none"
        )}
      >
        <motion.div
          ref={barRef}
          role="tablist"
          aria-label={locale === "zh" ? "导航" : "Navigation"}
          onPointerDown={startHold}
          onPointerMove={trackHold}
          onPointerUp={cancelHold}
          onPointerCancel={cancelHold}
          onPointerLeave={cancelHold}
          className={cn(
            "pointer-events-auto select-none",
            "flex items-center gap-0.5 p-1",
            "rounded-full",
            "bg-glass backdrop-blur-xl",
            "border border-border/50",
            "shadow-raised",
            yielding && "pointer-events-none"
          )}
          style={{
            borderRadius: BAR_RADIUS,
            // Shrink from the bottom centre so the dock stays planted.
            transformOrigin: "50% 100%",
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
              : { type: "tween", duration: 0.28, ease: EASE },
          }}
        >
          {TABS.map((tab) => {
            const selected = active === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={t(locale, tab.labelKey)}
                onClick={() => handleTab(tab)}
                className={cn(
                  "relative isolate flex h-11 w-11 items-center justify-center",
                  "pressable rounded-full outline-none",
                  "transition-colors duration-200",
                  selected
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground active:text-foreground"
                )}
              >
                {selected && (
                  <motion.span
                    layoutId={pillId}
                    className={cn(
                      "absolute inset-0.5 -z-10 rounded-full",
                      // Lifted stamp inside the glass track — lighter than the
                      // capsule, same language as AlbumTabs' selected pill.
                      "bg-glass-strong shadow-sm ring-1 ring-border/40",
                      "backdrop-blur-xl"
                    )}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "tween", duration: 0.32, ease: EASE }
                    }
                  />
                )}
                <span className="relative z-10">{tab.icon}</span>
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
