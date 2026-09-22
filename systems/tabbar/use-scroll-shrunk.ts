"use client";

import { useEffect, useState } from "react";
import { onPageScroll, pageScrollTop } from "vitre";

// =============================================================================
// Scroll-shrunk — temporary compact state for the liquid tab bar.
//
// Scroll down past a small hysteresis and the bar scales down; scroll up (or
// return near the top) and it restores. Reads page scroll through vitre so
// both window and bezel-container scroll modes stay correct.
// =============================================================================

/** Ignore tiny jitter so a finger resting on the page does not flicker. */
const DELTA_PX = 6;
/** Near the top the bar is always full size — nothing to clear. */
const TOP_PX = 24;

/**
 * True while the page is being scrolled down away from the top. Restores on
 * scroll-up or when the page is near its start.
 */
export function useScrollShrunk(): boolean {
  const [shrunk, setShrunk] = useState(false);

  useEffect(() => {
    let lastY = pageScrollTop();
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = pageScrollTop();
        const dy = y - lastY;
        if (y < TOP_PX) setShrunk(false);
        else if (dy > DELTA_PX) setShrunk(true);
        else if (dy < -DELTA_PX) setShrunk(false);
        lastY = y;
        ticking = false;
      });
    };

    return onPageScroll(onScroll);
  }, []);

  return shrunk;
}
