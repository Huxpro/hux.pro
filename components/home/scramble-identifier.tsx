"use client";

import { TextScramble } from "@/components/motion-primitives/text-scramble";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

/** Pause after hover before the OS name exposes around the stable λHUX mark. */
const WING_DWELL_MS = 780;

const WING_EASE_IN = [0.22, 1, 0.36, 1] as const;
const WING_EASE_OUT = [0.4, 0, 1, 1] as const;

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
 * Two-beat hover:
 * 1. Immediate — scramble `λhux` → `λHUX` (the mark stays put).
 * 2. Dwell — "The" / "操作" and "OS" / "系统" expose from the void on either side.
 */
export function ScrambleIdentifier() {
  const { locale } = useLocale();
  const reduced = useReducedMotion() ?? false;
  const [isHovered, setIsHovered] = useState(false);
  const [wingsVisible, setWingsVisible] = useState(false);

  useEffect(() => {
    if (!isHovered) return;

    const delay = reduced ? 0 : WING_DWELL_MS;
    const id = window.setTimeout(() => setWingsVisible(true), delay);
    return () => window.clearTimeout(id);
  }, [isHovered, reduced]);

  const onEnter = () => setIsHovered(true);
  const onLeave = () => {
    setIsHovered(false);
    setWingsVisible(false);
  };

  const core = isHovered ? "λHUX" : "λhux";
  const left = t(locale, "identifierWingLeft");
  const right = t(locale, "identifierWingRight");

  return (
    <div className="flex justify-center">
      <span
        className={cn(
          "inline-flex items-center justify-center",
          "font-mono text-xs tracking-wider cursor-default select-none",
          // Padding enlarges the hover target so the pointer can sit on the
          // wings without leaving. It must NOT be the positioning containing
          // block, or the wings would sit out at the padding edge.
          "px-[4.75rem] py-2",
          "transition-colors duration-300",
          isHovered ? "text-foreground" : "text-muted-foreground",
        )}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
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
