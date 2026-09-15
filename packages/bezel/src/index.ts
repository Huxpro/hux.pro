// @hux/bezel — implementation entry. The contract is ../bezel.d.ts.

export { Bezel, BEZEL_INSET, useBezel } from "./bezel";
export { bezelBootScript, readBezelBoot } from "./boot";
export { syncChrome } from "./chrome";
export {
  BEZEL_BAND_MAX,
  BEZEL_BAND_MIN,
  BEZEL_LAYER_ATTRIBUTE,
  BEZEL_RADIUS_MAX,
  BEZEL_RADIUS_MIN,
  CHROME_SAMPLE_PX,
  clampBezelBand,
  clampBezelRadius,
  DEFAULT_BEZEL_BAND,
  DEFAULT_BEZEL_RADIUS,
} from "./constants";
export {
  emitPageScroll,
  getScrollContainer,
  onPageScroll,
  pageOffsetOf,
  pageScrollHeight,
  pageScrollTop,
  pageViewportHeight,
  scrollPageTo,
  usePageScroll,
  useScrollLock,
  useScrollLocked,
} from "./scroll";
export type { BezelBootState, BezelProps, BezelScroll, BezelState } from "../bezel";
