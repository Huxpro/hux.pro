"use client";

import { TextScramble } from "@/components/motion-primitives/text-scramble";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

/** Pause after engage before the OS name exposes around the stable λHUX mark. */
const WING_DWELL_MS = 780;
/** Finger travel that means "this is a scroll", not a long-press. */
const TOUCH_CANCEL_PX = 12;
/** Ignore compatibility mouse pointer events after a touch. */
const HOVER_SUPPRESS_MS = 900;

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
 * Homepage system identifier.
 *
 * Desktop (mouse / pen): hover scrambles `λhux` → `λHUX`; dwelling exposes
 * "The" / "操作" and "OS" / "系统" from the void. Leave reverses.
 *
 * Touch: the same two beats, but on press-and-hold. Releasing after the
 * dwell *latches* the expanded name so the phrase is readable (the finger
 * was covering it). Tap the mark or anywhere else to dismiss. A flick or
 * quick tap cancels — we never use mouseenter, which iOS would stick.
 */
export function ScrambleIdentifier() {
  const { locale } = useLocale();
  const reduced = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLSpanElement>(null);
  const latchedRef = useRef(false);
  const revealedRef = useRef(false);
  const suppressHoverUntilRef = useRef(0);
  const touchTeardownRef = useRef<(() => void) | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [wingsVisible, setWingsVisible] = useState(false);
  const [latched, setLatched] = useState(false);

  const collapse = useCallback(() => {
    setEngaged(false);
    setWingsVisible(false);
    setLatched(false);
    latchedRef.current = false;
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
    latchedRef.current = latched;
  }, [latched]);

  useEffect(() => {
    revealedRef.current = wingsVisible;
  }, [wingsVisible]);

  useEffect(() => () => touchTeardownRef.current?.(), []);

  // Latched touch reveal: dismiss on a press outside the mark.
  useEffect(() => {
    if (!latched) return;

    const onDocPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      collapse();
    };

    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [latched, collapse]);

  const onPointerEnter = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (!isHoverPointer(e)) return;
    if (performance.now() < suppressHoverUntilRef.current) return;
    setEngaged(true);
  };

  const onPointerLeave = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (!isHoverPointer(e)) return;
    if (latchedRef.current) return;
    if (performance.now() < suppressHoverUntilRef.current) return;
    collapse();
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (e.pointerType !== "touch") return;

    // Second tap on the mark dismisses a latched reveal.
    if (latchedRef.current) {
      collapse();
      suppressHoverUntilRef.current = performance.now() + HOVER_SUPPRESS_MS;
      return;
    }

    const start = {
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
      id: e.pointerId,
    };
    setEngaged(true);

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== start.id) return;
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (dx * dx + dy * dy <= TOUCH_CANCEL_PX * TOUCH_CANCEL_PX) return;
      teardown();
      collapse();
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== start.id) return;
      teardown();
      suppressHoverUntilRef.current = performance.now() + HOVER_SUPPRESS_MS;
      const held = performance.now() - start.t;
      // Hold duration is the source of truth. The dwell timer may lag a
      // frame; still latch so the phrase stays after the finger lifts.
      if (held >= WING_DWELL_MS) {
        setWingsVisible(true);
        revealedRef.current = true;
        setLatched(true);
        latchedRef.current = true;
      } else {
        collapse();
      }
    };

    const onCancel = (ev: PointerEvent) => {
      if (ev.pointerId !== start.id) return;
      teardown();
      suppressHoverUntilRef.current = performance.now() + HOVER_SUPPRESS_MS;
      collapse();
    };

    const teardown = () => {
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

  const core = engaged ? "λHUX" : "λhux";
  const left = t(locale, "identifierWingLeft");
  const right = t(locale, "identifierWingRight");

  return (
    <div className="flex justify-center">
      <span
        ref={rootRef}
        className={cn(
          "inline-flex items-center justify-center",
          "font-mono text-xs tracking-wider cursor-default select-none",
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
        onContextMenu={(e) => e.preventDefault()}
        aria-label={wingsVisible ? t(locale, "identifierExpanded") : "λhux"}
      >
        <span className="relative inline-flex items-center">
          <IdentifierWing side="left" visible={wingsVisible} reduced={reduced}>
            {left}
          </IdentifierWing>
          <span
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
    </div>
  );
}
