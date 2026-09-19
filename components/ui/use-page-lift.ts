"use client";

import { useEffect } from "react";
import { useMotionValue, type MotionValue } from "motion/react";
import { onPageScroll, pageScrollTop } from "vitre";

/**
 * How far the page has scrolled, as 0 → 1 over its first `distance` pixels.
 * A bar pinned by PageLayout (`pinnedActions`) rests at the top of the page
 * and starts travelling with the first pixel of scroll, so this is how far
 * it has come away from where it rests — for dressing it as it leaves.
 *
 * A motion value, not state: it moves every scroll frame and nothing
 * re-renders for it. Page scroll, not window scroll — with the bezel on an
 * iPhone the page scrolls inside a container (see vitre).
 */
export function usePageLift(distance: number): MotionValue<number> {
  const lift = useMotionValue(0);

  useEffect(() => {
    const update = () =>
      lift.set(Math.min(1, Math.max(0, pageScrollTop() / distance)));
    update();
    return onPageScroll(update);
  }, [lift, distance]);

  return lift;
}
