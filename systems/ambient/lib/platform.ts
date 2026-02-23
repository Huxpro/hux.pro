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
