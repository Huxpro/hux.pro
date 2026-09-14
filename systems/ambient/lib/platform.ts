import { DEFAULT_LETTERBOX_BAND, LETTERBOX_BAND_VAR } from "./letterbox";

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
 * How thick the frame is, top and bottom: the safe area, never thinner than
 * the configured band. The band is a custom property on <html>, written by the
 * boot script and then by the provider, so the thickness is live — see
 * `LETTERBOX_BAND_VAR` and `DEFAULT_LETTERBOX_BAND` in ./letterbox, which is
 * also where the floor is explained.
 *
 * The fallback in each `var()` matters: it is what applies for the one frame
 * before the boot script runs, and on any page that never mounts the provider.
 */
const BAND = `var(${LETTERBOX_BAND_VAR}, ${DEFAULT_LETTERBOX_BAND}px)`;

/** The top band's height. */
export const LETTERBOX_BAND_TOP = `max(env(safe-area-inset-top, 0px), ${BAND})`;
/** The bottom band's height. */
export const LETTERBOX_BAND_BOTTOM = `max(env(safe-area-inset-bottom, 0px), ${BAND})`;

/**
 * The side bands take the safe area as it comes, with no floor. In portrait it
 * is zero and the page runs edge to edge, which is the look the frame was
 * drawn for. In landscape it is the notch: 62px on an iPhone 17 Pro, on the
 * side the Dynamic Island is on and on the other side to match. Without them
 * the wallpaper runs under the island. There is no chrome to tint out there,
 * so nothing wants a floor.
 */
export const LETTERBOX_BAND_LEFT = "env(safe-area-inset-left, 0px)";
/** The right band's width. */
export const LETTERBOX_BAND_RIGHT = "env(safe-area-inset-right, 0px)";

/**
 * The box the wallpaper and the page ground paint in when letterboxed: inside
 * the bands. Everything outside them is left to the frame — `<html>` is the
 * frame colour (see `html.letterbox` in globals.css) and the bands are drawn
 * over the top of the page — so the wallpaper ends on a clean line against the
 * frame instead of running under the chrome. Applied on top of `fixed inset-0`.
 */
export const LETTERBOX_INSET = {
  top: LETTERBOX_BAND_TOP,
  bottom: LETTERBOX_BAND_BOTTOM,
  left: LETTERBOX_BAND_LEFT,
  right: LETTERBOX_BAND_RIGHT,
} as const;
