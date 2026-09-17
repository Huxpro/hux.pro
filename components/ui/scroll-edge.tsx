import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// Scroll edge — frost a clipped edge without painting page colour.
//
// Pre-glass, a scroll fade was `from-background`: an opaque slab of page
// colour over the cutoff. `from-glass` is the same bug in nicer clothes —
// `--glass` is card colour at an alpha, so on a wallpaper it is a white (or
// near-black) wash. The pocket has to sit ON the transparent surface:
//
//   1. `scrollEdgeMask` — the clipped content itself goes transparent, so
//      whatever is behind (wallpaper, Clear glass, the page) shows through.
//   2. `ScrollEdgeFade` — a short backdrop blur + whisper of ink, masked
//      to a falloff. The cutoff frosts; it does not get card colour painted
//      on it (`--glass` is that colour at an alpha, i.e. the old bug).
// =============================================================================

export type ScrollEdge = "left" | "right" | "top" | "bottom";

const BLUR_MASK: Record<ScrollEdge, string> = {
  left: "linear-gradient(to right, black, transparent)",
  right: "linear-gradient(to left, black, transparent)",
  top: "linear-gradient(to bottom, black, transparent)",
  bottom: "linear-gradient(to top, black, transparent)",
};

const POS: Record<ScrollEdge, string> = {
  left: "inset-y-0 left-0 w-6",
  right: "inset-y-0 right-0 w-6",
  top: "inset-x-0 top-0 h-7",
  bottom: "inset-x-0 bottom-0 h-7",
};

/** CSS mask that fades a scrollport's start/end into transparency. */
export function scrollEdgeMask(
  atStart: boolean,
  atEnd: boolean,
  axis: "x" | "y" = "x",
  sizePx = 24,
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
        // Blur + a whisper of ink, never card colour. `--glass` is a white
        // (or near-black) wash on a wallpaper; `--ink` at a few percent is
        // the same dimming-on-transparency the rest of the page uses.
        "bg-ink/5 backdrop-blur-md",
        "transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
        className,
      )}
      style={{ maskImage: blurMask, WebkitMaskImage: blurMask }}
    />
  );
}
