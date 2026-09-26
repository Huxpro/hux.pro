"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState, type ReactNode } from "react";
import { SURFACE_EASING } from "./stack";

// =============================================================================
// SurfaceMorph — a surface that changes what it says without changing surfaces.
//
// A primer's sheet asks, the browser's dialog answers, and the sheet then says
// how it went. Swapping its content outright is a cut: the text jumps, and a
// content-sized sheet (`fitContent`) snaps to its new height in one frame. iOS
// does neither — the sheet re-sizes and the content cross-fades inside it — so
// this does that:
//
//   - the step that is leaving stays, absolutely placed over the top of the
//     box, and fades out; the new one fades in in flow, a beat later;
//   - the box's height eases from the old step's measured height to the new
//     one's with the sheet's own curve, so a content-sized sheet — pinned at
//     its bottom edge — grows or shrinks from the top, the way it opened.
//
// Steps are rendered from `render(step)` rather than held as elements, so the
// leaving one is drawn from current state (it is inert and fading; nothing in
// it is live) and nothing here keeps a stale tree. Height is measured with a
// ResizeObserver on the current step only, so a change inside a step (a line
// wrapping differently) eases too.
//
// Under reduced motion the swap is immediate: no fade, no height travel.
// =============================================================================

/** Height travel — the sheet's own open/close curve, a little quicker. */
const HEIGHT_MS = 420;
/** The leaving step is gone before the entering one is fully in. */
const FADE_OUT_MS = 180;
const FADE_IN_MS = 280;
const FADE_IN_DELAY_MS = 90;

export interface SurfaceMorphProps<Step extends string> {
  /** Which content is showing. A change of step is what morphs. */
  step: Step;
  /** The content for a step — called for the leaving step too, while it fades. */
  render: (step: Step) => ReactNode;
  className?: string;
}

export function SurfaceMorph<Step extends string>({
  step,
  render,
  className,
}: SurfaceMorphProps<Step>) {
  // The steps on screen, oldest first; the last is the current one. Adjusted
  // during render (React's documented pattern for state derived from a prop),
  // so the frame that shows the new step already has the old one leaving.
  const [steps, setSteps] = useState<Step[]>([step]);
  if (steps[steps.length - 1] !== step) {
    setSteps([...steps.filter((s) => s !== step), step]);
  }
  const current = steps[steps.length - 1];
  const leaving = steps.slice(0, -1);

  // Leaving steps are dropped once their fade is over.
  useEffect(() => {
    if (leaving.length === 0) return;
    const timer = window.setTimeout(
      () => setSteps((s) => s.slice(-1)),
      Math.max(FADE_OUT_MS, HEIGHT_MS)
    );
    return () => window.clearTimeout(timer);
  }, [leaving.length]);

  // The current step's height. Null until first measured, so the first paint
  // is plain auto height and nothing animates on open.
  const [currentEl, setCurrentEl] = useState<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!currentEl) return;
    const observer = new ResizeObserver(() => setHeight(currentEl.offsetHeight));
    observer.observe(currentEl);
    return () => observer.disconnect();
  }, [currentEl]);

  return (
    <div
      className={cn(
        "relative",
        // Clip only while a step is leaving: at rest a focus ring or a
        // shadow at the edge must not be cut.
        leaving.length > 0 && "overflow-hidden",
        "motion-reduce:!transition-none",
        className
      )}
      style={{
        height: height ?? undefined,
        transition: `height ${HEIGHT_MS}ms ${SURFACE_EASING}`,
      }}
    >
      {leaving.map((s) => (
        <div
          key={s}
          aria-hidden="true"
          inert
          className="pointer-events-none absolute inset-x-0 top-0 animate-out fade-out fill-mode-forwards motion-reduce:hidden"
          style={{ animationDuration: `${FADE_OUT_MS}ms` }}
        >
          {render(s)}
        </div>
      ))}
      <div
        key={current}
        ref={setCurrentEl}
        className={cn(
          leaving.length > 0 &&
            "animate-in fade-in fill-mode-both motion-reduce:animate-none"
        )}
        style={
          leaving.length > 0
            ? {
                animationDuration: `${FADE_IN_MS}ms`,
                animationDelay: `${FADE_IN_DELAY_MS}ms`,
              }
            : undefined
        }
      >
        {render(current)}
      </div>
    </div>
  );
}
