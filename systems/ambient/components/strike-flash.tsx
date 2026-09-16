"use client";

import { useEffect, useRef } from "react";
import { STRIKE_MS } from "../lib/strike";

// ---------------------------------------------------------------------------
// StrikeFlash — the CSS engine's half of the thunder-day easter egg.
//
// The Gradient and Classic styles are a wash: there is no geometry in them to
// draw a channel on, and a bolt painted over a flat gradient would read as a
// sticker. So they answer a click the way the sky does from indoors — the room
// lights up, from the direction it came from. Same second, same flicker as the
// shader's envelope (lib/strike.ts owns the duration); no bolt.
//
// It runs on the Web Animations API rather than React state: a strike must not
// re-render the page it is decorating, and the element is back at opacity 0 the
// moment the animation is spent.
// ---------------------------------------------------------------------------

interface StrikeFlashProps {
  /** Handed a function that flashes at (x, y) in screen space, 0..1 bottom → top. */
  strikeRef: React.MutableRefObject<((x: number, y: number) => void) | null>;
}

export function StrikeFlash({ strikeRef }: StrikeFlashProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    strikeRef.current = (x, y) => {
      const el = ref.current;
      if (!el) return;
      el.style.setProperty("--strike-x", `${(x * 100).toFixed(2)}%`);
      el.style.setProperty("--strike-y", `${((1 - y) * 100).toFixed(2)}%`);
      el.getAnimations().forEach((animation) => animation.cancel());
      el.animate(
        [
          { opacity: 0, offset: 0 },
          { opacity: 1, offset: 0.03 },
          { opacity: 0.1, offset: 0.14 },
          { opacity: 0.72, offset: 0.2 },
          { opacity: 0.06, offset: 0.35 },
          { opacity: 0.34, offset: 0.42 },
          { opacity: 0, offset: 1 },
        ],
        { duration: STRIKE_MS, easing: "linear" }
      );
    };
    return () => {
      strikeRef.current = null;
    };
  }, [strikeRef]);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-0"
      style={{
        backgroundImage:
          "radial-gradient(75% 65% at var(--strike-x, 50%) var(--strike-y, 50%), " +
          "rgba(234,241,255,1) 0%, rgba(222,233,255,0.62) 38%, rgba(206,220,255,0) 82%)",
      }}
    />
  );
}
