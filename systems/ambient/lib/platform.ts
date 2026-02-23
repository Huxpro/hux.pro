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

export const EDGE_FADE_MASK = `linear-gradient(180deg, transparent 0%, black calc(env(safe-area-inset-top) + ${IOS_EDGE_FADE_DISTANCE_PX}px), black calc(100% - env(safe-area-inset-bottom) - ${IOS_EDGE_FADE_DISTANCE_PX}px), transparent 100%)`;
