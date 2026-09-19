"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Whether a horizontal scroller has more to show past either edge. For
 * fading the edge it is cut at, so a row cut mid-item reads as "there is
 * more this way" rather than as a mistake — and only while it is cut: a
 * row that fits wears nothing.
 */
export function useScrollEdges(ref: RefObject<HTMLElement | null>): {
  start: boolean;
  end: boolean;
} {
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const start = el.scrollLeft > 1;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setEdges((prev) =>
        prev.start === start && prev.end === end ? prev : { start, end },
      );
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    // The row's own width (the bar around it changed) and its content's (a
    // chip came or went).
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [ref]);

  return edges;
}
