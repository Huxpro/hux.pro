"use client";

import { TextScramble } from "@/components/motion-primitives/text-scramble";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { HoldRing } from "@/components/ui/hold-ring";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTransitionRouter } from "next-view-transitions";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";

/** Pause after engage before the OS name exposes around the stable λHUX mark. */
const WING_DWELL_MS = 780;
/**
 * When, into a hold, the ring that says "keep holding" appears
 * (components/ui/hold-ring.tsx): late enough that a tap never sees it, early
 * enough to have most of the hold to close in. A finger covers the mark, so
 * the ring is the one thing a phone shows of the hold's progress.
 */
const HOLD_RING_REVEAL_MS = 200;
/** Finger travel that means "this is a scroll", not a long-press. */
const TOUCH_CANCEL_PX = 12;
/** Ignore compatibility mouse pointer events after a touch. */
const HOVER_SUPPRESS_MS = 900;
/** Where the named OS introduces itself: the home screen with the About up. */
const ABOUT_HREF = "/about";

const WING_EASE_IN = [0.22, 1, 0.36, 1] as const;
const WING_EASE_OUT = [0.4, 0, 1, 1] as const;

function isHoverPointer(e: { pointerType: string }) {
  return e.pointerType === "mouse" || e.pointerType === "pen";
}

function IdentifierWing({
  side,
  visible,
  reduced,
  children,
}: {
  side: "left" | "right";
  visible: boolean;
  reduced: boolean;
  children: string;
}) {
  // Drift out of the mark (the "void" immediately around λHUX), not in from off-canvas.
  const fromCore = side === "left" ? 10 : -10;

  return (
    <motion.span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 flex items-center whitespace-nowrap",
        "text-muted-foreground",
        side === "left" ? "right-full pr-[0.5em]" : "left-full pl-[0.5em]",
      )}
      initial={false}
      animate={
        visible
          ? { opacity: 1, x: 0, filter: "blur(0px)" }
          : {
              opacity: 0,
              x: reduced ? 0 : fromCore,
              filter: reduced ? "blur(0px)" : "blur(10px)",
            }
      }
      transition={
        reduced
          ? { duration: 0 }
          : {
              duration: visible ? 0.95 : 0.32,
              ease: visible ? WING_EASE_IN : WING_EASE_OUT,
            }
      }
    >
      {children}
    </motion.span>
  );
}

/**
 * Homepage system identifier — and the long way into the About.
 *
 * Desktop (mouse / pen): hover scrambles `λhux` → `λHUX`; dwelling exposes
 * "The" / "操作" and "OS" / "系统" from the void. Once the OS has said its
 * name, the name is a door: the mark turns clickable, and a click opens
 * `/about`, where the OS introduces itself. Leave reverses.
 *
 * Touch: the same beats on press-and-hold, and holding until the name is
 * whole opens `/about` there and then — the hold is the press. A finger
 * covers the mark, so a ring round it (HoldRing, the search button's hold's
 * own) closes as the hold goes on: the one sign on a phone that holding is
 * doing something. A flick or
 * quick tap cancels — we never use mouseenter, which iOS would stick.
 */
export function ScrambleIdentifier() {
  const { locale } = useLocale();
  const reduced = useReducedMotion() ?? false;
  const router = useTransitionRouter();
  const enterAbout = useCallback(() => router.push(ABOUT_HREF), [router]);
  const rootRef = useRef<HTMLSpanElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  // The hold's ring, measured round the mark when it appears.
  const [holdRing, setHoldRing] = useState<DOMRect | null>(null);
  // The ring's layer on <body>, made on the first touch hold rather than at
  // hydration, which a portal would upset.
  const [ringLayer, setRingLayer] = useState(false);
  const revealedRef = useRef(false);
  const suppressHoverUntilRef = useRef(0);
  const touchTeardownRef = useRef<(() => void) | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [wingsVisible, setWingsVisible] = useState(false);

  const collapse = useCallback(() => {
    setEngaged(false);
    setWingsVisible(false);
    revealedRef.current = false;
  }, []);

  useEffect(() => {
    if (!engaged) return;

    const delay = reduced ? 0 : WING_DWELL_MS;
    const id = window.setTimeout(() => {
      setWingsVisible(true);
      revealedRef.current = true;
    }, delay);
    return () => window.clearTimeout(id);
  }, [engaged, reduced]);

  useEffect(() => {
    revealedRef.current = wingsVisible;
  }, [wingsVisible]);

  useEffect(() => () => touchTeardownRef.current?.(), []);

  const onPointerEnter = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (!isHoverPointer(e)) return;
    if (performance.now() < suppressHoverUntilRef.current) return;
    setEngaged(true);
  };

  const onPointerLeave = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (!isHoverPointer(e)) return;
    if (performance.now() < suppressHoverUntilRef.current) return;
    collapse();
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (e.pointerType !== "touch") return;

    const start = {
      x: e.clientX,
      y: e.clientY,
      id: e.pointerId,
    };
    setEngaged(true);
    setRingLayer(true);
    // The finger is on the mark: the ring round it, outside the finger,
    // closes as the hold goes on — the hint that holding does something.
    const reveal = reduced
      ? undefined
      : window.setTimeout(() => {
          setHoldRing(markRef.current?.getBoundingClientRect() ?? null);
        }, HOLD_RING_REVEAL_MS);
    // Held until the name is whole: that is the press. The wings arrive
    // on the same clock (the engaged effect), so the name is on screen as
    // the About rises over it.
    const held = window.setTimeout(
      () => {
        teardown();
        suppressHoverUntilRef.current = performance.now() + HOVER_SUPPRESS_MS;
        navigator.vibrate?.(8);
        enterAbout();
        // Put the mark back once the About is over it.
        window.setTimeout(collapse, 600);
      },
      reduced ? 0 : WING_DWELL_MS,
    );

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== start.id) return;
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (dx * dx + dy * dy <= TOUCH_CANCEL_PX * TOUCH_CANCEL_PX) return;
      teardown();
      collapse();
    };

    // Let go before the name was whole: a tap, not a press.
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== start.id) return;
      teardown();
      suppressHoverUntilRef.current = performance.now() + HOVER_SUPPRESS_MS;
      collapse();
    };

    const onCancel = (ev: PointerEvent) => {
      if (ev.pointerId !== start.id) return;
      teardown();
      suppressHoverUntilRef.current = performance.now() + HOVER_SUPPRESS_MS;
      collapse();
    };

    const teardown = () => {
      window.clearTimeout(reveal);
      window.clearTimeout(held);
      setHoldRing(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      touchTeardownRef.current = null;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    touchTeardownRef.current = teardown;
  };

  // With a pointer, the name once whole is a door to the About. (A touch's
  // own click, after its hold already went, is ignored.)
  const onClick = () => {
    if (!wingsVisible) return;
    if (performance.now() < suppressHoverUntilRef.current) return;
    enterAbout();
  };
  const onKeyDown = (e: ReactKeyboardEvent<HTMLSpanElement>) => {
    if (!wingsVisible || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    enterAbout();
  };

  const core = engaged ? "λHUX" : "λhux";
  const left = t(locale, "identifierWingLeft");
  const right = t(locale, "identifierWingRight");

  return (
    <div className="flex justify-center">
      <span
        ref={rootRef}
        className={cn(
          "inline-flex items-center justify-center",
          TYPE.identifier,
          "select-none",
          wingsVisible ? "cursor-pointer" : "cursor-default",
          "touch-manipulation [-webkit-touch-callout:none]",
          // Padding enlarges the hit target so the pointer can sit on the
          // wings without leaving. It must NOT be the positioning containing
          // block, or the wings would sit out at the padding edge.
          "px-[4.75rem] min-h-[44px]",
          "transition-colors duration-300",
          engaged ? "text-foreground" : "text-muted-foreground",
        )}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onClick={onClick}
        onKeyDown={onKeyDown}
        // Only a door once it has a name to open on.
        role={wingsVisible ? "link" : undefined}
        tabIndex={wingsVisible ? 0 : undefined}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={wingsVisible ? t(locale, "identifierExpanded") : "λhux"}
      >
        <span className="relative inline-flex items-center">
          <IdentifierWing side="left" visible={wingsVisible} reduced={reduced}>
            {left}
          </IdentifierWing>
          <span
            ref={markRef}
            data-view-transition="site-identifier"
            className="relative inline-block"
          >
            <TextScramble
              trigger={true}
              duration={0.6}
              speed={0.03}
              characterSet="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?"
              as="span"
              className="inline-block"
            >
              {core}
            </TextScramble>
          </span>
          <IdentifierWing side="right" visible={wingsVisible} reduced={reduced}>
            {right}
          </IdentifierWing>
        </span>
      </span>
      {/* On <body>: the home's animated ancestors would otherwise be the
          fixed ring's containing block. */}
      {ringLayer &&
        createPortal(
          <AnimatePresence>
            {holdRing && (
              <HoldRing
                rect={holdRing}
                // A pill round the word.
                radius={holdRing.height / 2}
                durationMs={WING_DWELL_MS - HOLD_RING_REVEAL_MS}
              />
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
