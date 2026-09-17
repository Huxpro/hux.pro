import type { CSSProperties } from "react";

// =============================================================================
// Scroll-stack fade — the mask WidgetScrollBody uses.
//
// Content goes transparent at the overflow edge, so whatever is behind the
// scrollport (the widget's glass, the page wallpaper) shows through. No
// overlay, no blur, no `--background` / `--glass` fill: those paint a slab
// on a transparent surface. The recipe is a two-stop linear gradient over
// 28px, the distance the stacked widgets already settled on.
// =============================================================================

export const SCROLL_STACK_FADE_PX = 28;

/**
 * CSS mask for a snap-stack scrollport.
 *
 * `fadeStart` / `fadeEnd` are the overflow edges: a vertical stack fades
 * the tail (`fadeEnd`), a horizontal rail fades the peek (`fadeEnd`) and,
 * once scrolled, the clipped start (`fadeStart`). Both off → no mask.
 */
export function scrollStackMask(
  axis: "x" | "y",
  fadeStart: boolean,
  fadeEnd: boolean,
): CSSProperties | undefined {
  if (!fadeStart && !fadeEnd) return undefined;
  const dir = axis === "x" ? "to right" : "to bottom";
  const px = `${SCROLL_STACK_FADE_PX}px`;
  const image = fadeStart && fadeEnd
    ? `linear-gradient(${dir}, transparent, black ${px}, black calc(100% - ${px}), transparent)`
    : fadeEnd
      ? `linear-gradient(${dir}, black calc(100% - ${px}), transparent)`
      : `linear-gradient(${dir}, transparent, black ${px})`;
  return { maskImage: image, WebkitMaskImage: image };
}
