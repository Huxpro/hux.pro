"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Glow, type GlowProps } from "./glow";

// =============================================================================
// <EdgeGlow> — the glow around a screen, ending where its content begins.
//
//   <EdgeGlow active={open} content={[wordsRef, footRef]} depth={1.3} />
//
// A screen-sized ring (the About's) has no natural depth: a fixed number of
// px is a sliver on a desk and a flood on a phone, and a share of the screen
// ignores what the ring is framing. So an edge glow's depth is a share of the
// **gutter** — the room between the glow's edge and the content it frames:
//
//   gutter.x   the narrower of the left and right gutters
//   gutter.y   the narrower of the top and bottom gutters
//   depth      where the light ends, as a share of a gutter: 0.5 halfway
//              in, 1 just touching the content, 1.5 its tail half a
//              gutter over it.
//
//              a number   of the narrower of the two: the light stands as
//                         high off every edge, and reaches the content
//                         first where it is nearest — a ring's usual look
//              { x, y }   per axis, x off the sides and y off the top and
//                         bottom: the light follows the content's shape
//
// The content is the union of the given elements, each as laid out at rest
// and clipped by any scrolling ancestor: a long article in a scroll
// container counts only the window it starts in, and scrolling it never
// changes the gutter. The glow's edge is the glow's own box:
// the viewport, or whatever `style` insets it to (a bezel's screen). Both
// are measured live while the glow is on and kept for its way out.
//
// Where the light ends is exact, and grounded in the light itself: the beams
// get the reach whose own visible tail (2% opacity) ends there — the same
// light as a <Glow> given that reach — and a window makes the end exact.
// See GLOW_EXTENT_PER_REACH (lib/shader.ts).
// =============================================================================

type ContentRef = RefObject<HTMLElement | null>;

export interface EdgeGlowProps
  extends Omit<GlowProps, "shape" | "edge" | "reach" | "extent" | "fixed" | "bleed" | "ref"> {
  /** The content the light frames: one element, or several (their union). */
  content: ContentRef | readonly ContentRef[];
  /** Where the light ends, as a share of the gutter; 1 touches. A number
   *  takes the narrower gutter and lights every edge alike; `{ x, y }` takes
   *  each axis's own (x off the sides, y off the top and bottom). */
  depth: number | { x: number; y: number };
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The element's rect as laid out at rest — every scrolling ancestor at its
 * top — clipped by every ancestor that clips it. Scrolling the content moves
 * the words, not the room the ring has: measured as it currently shows, a
 * long article scrolled up would touch the screen's top and take the gutter
 * (and with it the light) to nothing.
 */
function restingRect(el: HTMLElement): Box {
  const clips: HTMLElement[] = [];
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.overflowX !== "visible" || cs.overflowY !== "visible") clips.push(p);
  }
  // Undo every clip's scroll for the element; for each clip, the scroll of
  // the clips around it.
  const shift = (from: number) => {
    let x = 0;
    let y = 0;
    for (let i = from; i < clips.length; i++) {
      x += clips[i].scrollLeft;
      y += clips[i].scrollTop;
    }
    return { x, y };
  };
  const r = el.getBoundingClientRect();
  const s = shift(0);
  const box = { left: r.left + s.x, top: r.top + s.y, right: r.right + s.x, bottom: r.bottom + s.y };
  clips.forEach((p, i) => {
    const cs = getComputedStyle(p);
    const c = p.getBoundingClientRect();
    const o = shift(i + 1);
    if (cs.overflowX !== "visible") {
      box.left = Math.max(box.left, c.left + o.x);
      box.right = Math.min(box.right, c.right + o.x);
    }
    if (cs.overflowY !== "visible") {
      box.top = Math.max(box.top, c.top + o.y);
      box.bottom = Math.min(box.bottom, c.bottom + o.y);
    }
  });
  return box;
}

export function EdgeGlow({ content, depth, active, ...glow }: EdgeGlowProps) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const [gutter, setGutter] = useState<{ x: number; y: number } | null>(null);
  const refs = Array.isArray(content) ? content : [content as ContentRef];

  useLayoutEffect(() => {
    if (!active) return;
    const frame = boxRef.current;
    const els = refs.map((r) => r.current).filter((e): e is HTMLElement => !!e);
    if (!frame || els.length === 0) return;
    const measure = () => {
      const f = frame.getBoundingClientRect();
      const u = els.map(restingRect).reduce((a, b) => ({
        left: Math.min(a.left, b.left),
        top: Math.min(a.top, b.top),
        right: Math.max(a.right, b.right),
        bottom: Math.max(a.bottom, b.bottom),
      }));
      const x = Math.max(0, Math.min(u.left - f.left, f.right - u.right));
      const y = Math.max(0, Math.min(u.top - f.top, f.bottom - u.bottom));
      setGutter((g) => (g && Math.abs(g.x - x) < 0.5 && Math.abs(g.y - y) < 0.5 ? g : { x, y }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    // Resting geometry: only a change of size moves it, never a scroll.
    els.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
    // The refs' targets are read when the glow turns on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const extent =
    gutter === null
      ? undefined
      : typeof depth === "number"
        ? { x: depth * Math.min(gutter.x, gutter.y), y: depth * Math.min(gutter.x, gutter.y) }
        : { x: depth.x * gutter.x, y: depth.y * gutter.y };
  return (
    <Glow
      {...glow}
      ref={boxRef}
      active={active}
      fixed
      extent={extent}
    />
  );
}
