/**
 * Detect any iOS browser.  All iOS browsers (Safari, Chrome, Firefox, Edge…)
 * use the WebKit engine and share the same limitations — most notably
 * `background-attachment: fixed` is unsupported.
 */
export function isIOSBrowser(): boolean {
  if (typeof window === "undefined") return false;

  const ua = navigator.userAgent;
  const isIOSDevice =
    /iP(hone|ad|od)/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  return isIOSDevice;
}

/** @deprecated Use isIOSBrowser instead */
export const isIOSSafariBrowser = isIOSBrowser;
/** @deprecated Use isIOSBrowser instead */
export const isIPhoneSafariBrowser = isIOSBrowser;

export const IOS_EDGE_FADE_DISTANCE_PX = 128;

/**
 * Larger fade distance for high-contrast scenarios (dark mode + sunrise/sunset).
 * The warm/vivid sun-event gradients against the dark background create a stark
 * edge — pushing the transparent zone further inward softens the transition.
 */
export const IOS_EDGE_FADE_DISTANCE_HIGH_CONTRAST_PX = 256;

function buildEdgeFadeMask(distance: number): string {
  return `linear-gradient(180deg, transparent 0%, black calc(env(safe-area-inset-top) + ${distance}px), black calc(100% - env(safe-area-inset-bottom) - ${distance}px), transparent 100%)`;
}

export const EDGE_FADE_MASK = buildEdgeFadeMask(IOS_EDGE_FADE_DISTANCE_PX);

/**
 * Special-case mask for mobile dark-mode sunrise/sunset.
 * See {@link IOS_EDGE_FADE_DISTANCE_HIGH_CONTRAST_PX}.
 */
export const EDGE_FADE_MASK_HIGH_CONTRAST = buildEdgeFadeMask(
  IOS_EDGE_FADE_DISTANCE_HIGH_CONTRAST_PX
);

/**
 * The radial soft edge — the picture sitting ON the page and falling off on
 * every side, rather than being tinted toward it.
 *
 * Taken from #96, which is where the "centre bright, edges dark" look actually
 * comes from: not an overlay but a MASK. That distinction is the whole effect.
 * An overlay paints the page colour on top at some alpha, so the wallpaper is
 * still there underneath, muddied — 0.40 alpha is the most it can ever remove.
 * A mask deletes the layer outright and lets the page show through clean, all
 * the way to 100%. On a photograph the difference is not subtle.
 *
 * It is also the reason a radial edge suits a photo where the vertical strip
 * does not. The strip cuts a band off the top and bottom, which reads as a
 * printing error; falling off on every side reads as a vignette.
 *
 * @param spread   scales the ellipse. Below 1 pulls the falloff inside the
 *                 viewport, where the eye actually reads it.
 * @param strength how much of the picture is gone at the farthest corner.
 *                 1 removes it entirely, which is what #96 does.
 */
export function buildRadialEdgeMask(spread: number, strength: number): string {
  const rx = (92 * spread).toFixed(1);
  const ry = (84 * spread).toFixed(1);
  const remaining = Math.max(0, 1 - strength).toFixed(3);
  return (
    `radial-gradient(ellipse ${rx}% ${ry}% at 50% 42%, ` +
    `black 28%, black 55%, rgb(0 0 0 / ${remaining}) 100%)`
  );
}
