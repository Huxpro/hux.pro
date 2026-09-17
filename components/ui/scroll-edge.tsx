import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// Scroll edge — the Liquid Glass pocket at a clipped edge.
//
// Pre-glass, a scroll fade was `from-background`: an opaque slab of page
// colour painted over the cutoff. That assumed the page was a solid card,
// and reads as a muddy patch once the surface behind is wallpaper or Clear
// glass (see docs/system-glass.md).
//
// Two pieces, both sitting on the transparent surface rather than covering it:
//
//   1. `scrollEdgeMask` — a CSS mask so the clipped content itself goes
//      transparent (wallpaper shows through the card, the way WidgetScrollBody
//      already fades a list into glass).
//   2. `ScrollEdgeFade` — a glass-token gradient + short blur on top of that,
//      so the cutoff frosts instead of hard-cutting. Tinted / Clear / wallpaper
//      tint follow along because the fill is `--glass`, not `--background`.
// =============================================================================

export type ScrollEdge = "left" | "right" | "top" | "bottom";

const FILL: Record<ScrollEdge, string> = {
  left: "bg-gradient-to-r from-glass to-transparent",
  right: "bg-gradient-to-l from-glass to-transparent",
  top: "bg-gradient-to-b from-glass to-transparent",
  bottom: "bg-gradient-to-t from-glass to-transparent",
};

const BLUR_MASK: Record<ScrollEdge, string> = {
  left: "linear-gradient(to right, black, transparent)",
  right: "linear-gradient(to left, black, transparent)",
  top: "linear-gradient(to bottom, black, transparent)",
  bottom: "linear-gradient(to top, black, transparent)",
};

const POS: Record<ScrollEdge, string> = {
  left: "inset-y-0 left-0 w-8",
  right: "inset-y-0 right-0 w-8",
  top: "inset-x-0 top-0 h-7",
  bottom: "inset-x-0 bottom-0 h-7",
};

/** CSS mask that fades a scrollport's start/end into transparency. */
export function scrollEdgeMask(
  atStart: boolean,
  atEnd: boolean,
  axis: "x" | "y" = "x",
  sizePx = 32,
): CSSProperties | undefined {
  if (atStart && atEnd) return undefined;
  const dir = axis === "x" ? "to right" : "to bottom";
  const start = atStart ? "black" : `transparent, black ${sizePx}px`;
  const end = atEnd ? "black" : `black calc(100% - ${sizePx}px), transparent`;
  const mask = `linear-gradient(${dir}, ${start}, ${end})`;
  return { maskImage: mask, WebkitMaskImage: mask };
}

export function ScrollEdgeFade({
  edge,
  visible = true,
  className,
}: {
  edge: ScrollEdge;
  /** When false, the pocket is kept mounted and faded out (so it can
   *  transition). Defaults to visible. */
  visible?: boolean;
  className?: string;
}) {
  const blurMask = BLUR_MASK[edge];
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute",
        POS[edge],
        FILL[edge],
        "backdrop-blur-md",
        "transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
        className,
      )}
      style={{ maskImage: blurMask, WebkitMaskImage: blurMask }}
    />
  );
}
