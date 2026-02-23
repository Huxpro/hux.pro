export function isIOSSafariBrowser(): boolean {
  if (typeof window === "undefined") return false;

  const ua = navigator.userAgent;
  const isIOSDevice =
    /iP(hone|ad|od)/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isWebKit = /WebKit/i.test(ua);
  const isOtherIOSBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);

  return isIOSDevice && isWebKit && !isOtherIOSBrowser;
}

/** @deprecated Use isIOSSafariBrowser instead */
export const isIPhoneSafariBrowser = isIOSSafariBrowser;

export const IOS_EDGE_FADE_DISTANCE_PX = 128;

export const EDGE_FADE_MASK = `linear-gradient(180deg, transparent 0%, black calc(env(safe-area-inset-top) + ${IOS_EDGE_FADE_DISTANCE_PX}px), black calc(100% - env(safe-area-inset-bottom) - ${IOS_EDGE_FADE_DISTANCE_PX}px), transparent 100%)`;
