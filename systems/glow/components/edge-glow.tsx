"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Glow, type GlowProps } from "./glow";

// =============================================================================
// <EdgeGlow> — the glow around a screen, ending where its content begins.
//
//   <EdgeGlow active={open} content={[wordsRef, footRef]} depth={{ x: 0.33, y: 1.3 }} />
//
// A screen-sized ring (the About's) has no natural depth: a fixed number of
// px is a sliver on a desk and a flood on a phone, and a share of the screen
// ignores what the ring is framing. So an edge glow's depth is a share of the
// **gutter** — the room between the glow's edge and the content it frames:
//
//   gutter.x   the narrower of the left and right gutters
//   gutter.y   the narrower of the top and bottom gutters
//   depth      where the light ends, as a share of the gutter, per axis:
//              0.5 halfway in, 1 just touching the content, 1.5 its tail
//              half a gutter over it
//
// The content is the union of the given elements, each as far as it is
// visible (clipped by any scrolling ancestor, so a long article in a scroll
// container counts only its window). The glow's edge is the glow's own box:
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
  /** Where the light ends, as a share of the gutter: one for both axes, or
   *  `x` (off the sides) and `y` (off the top and bottom). 1 touches. */
  depth: number | { x: number; y: number };
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The element's rect, clipped by every ancestor that clips it. */
function visibleRect(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  const box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
    const c = p.getBoundingClientRect();
    if (cs.overflowX !== "visible") {
      box.left = Math.max(box.left, c.left);
      box.right = Math.min(box.right, c.right);
    }
    if (cs.overflowY !== "visible") {
      box.top = Math.max(box.top, c.top);
      box.bottom = Math.min(box.bottom, c.bottom);
    }
  }
  return box;
}

function scrollers(el: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.overflowX !== "visible" || cs.overflowY !== "visible") out.push(p);
  }
  return out;
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
      const u = els.map(visibleRect).reduce((a, b) => ({
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
    const scrolls = new Set<HTMLElement>();
    for (const el of els) {
      ro.observe(el);
      scrollers(el).forEach((s) => scrolls.add(s));
    }
    scrolls.forEach((s) => s.addEventListener("scroll", measure, { passive: true }));
    return () => {
      ro.disconnect();
      scrolls.forEach((s) => s.removeEventListener("scroll", measure));
    };
    // The refs' targets are read when the glow turns on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const d = typeof depth === "number" ? { x: depth, y: depth } : depth;
  return (
    <Glow
      {...glow}
      ref={boxRef}
      active={active}
      fixed
      extent={gutter ? { x: d.x * gutter.x, y: d.y * gutter.y } : undefined}
    />
  );
}
