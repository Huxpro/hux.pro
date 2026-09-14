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
