export function isIPhoneSafariBrowser(): boolean {
  if (typeof window === "undefined") return false;

  const ua = navigator.userAgent;
  const isIPhone = /iPhone/i.test(ua);
  const isWebKit = /WebKit/i.test(ua);
  const isOtherIOSBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);

  return isIPhone && isWebKit && !isOtherIOSBrowser;
}
