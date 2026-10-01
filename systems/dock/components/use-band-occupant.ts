"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { CAPSULE, useBandSelect } from "../band";

/** The transition an occupant's glass takes between a pill and a ball. */
export const OCCUPANT_TRANSITION =
  "transition-[width,background-color,border-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";

/**
 * What an occupant of the Dock's row takes from the band (../band.ts): its
 * shape and whether it is out of sight behind a count — and, for the band
 * to lay itself out by, its own width as a pill, measured.
 *
 * A ball is the same pill at the band's height, its content clipped, so
 * going from one to the other is the pill's real width changing between two
 * numbers. The pill's width is its content's (it changes: EQ bars come and
 * go) plus the glass's own padding and border, read off the glass rather
 * than restated here.
 *
 * The occupant puts `glassRef` and `data-band-glass` on its glass (where the
 * Dock fades a sliver), `contentRef` on what is inside it, `natural` as
 * `data-natural` on its row child, and `width` on its glass.
 */
export function useBandOccupant() {
  const ball = useBandSelect((g) => g.form === "ball");
  const counted = useBandSelect((g) => g.mode === "count");
  const glassRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const [natural, setNatural] = useState<number | null>(null);
  useLayoutEffect(() => {
    const glass = glassRef.current;
    const content = contentRef.current;
    if (!glass || !content) return;
    const measure = () => {
      const cs = getComputedStyle(glass);
      const chrome =
        parseFloat(cs.paddingLeft) +
        parseFloat(cs.paddingRight) +
        parseFloat(cs.borderLeftWidth) +
        parseFloat(cs.borderRightWidth);
      setNatural(Math.round(content.offsetWidth + chrome));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(content);
    return () => ro.disconnect();
  }, []);
  return {
    glassRef,
    contentRef,
    natural,
    ball,
    counted,
    width: natural === null ? undefined : ball ? CAPSULE : natural,
  };
}
