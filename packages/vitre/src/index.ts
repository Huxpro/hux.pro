// Vitre — implementation entry. The contract is ../vitre.d.ts.

export { Vitre, BEZEL_INSET, useVitre } from "./vitre";
export { vitreBootScript, readVitreBoot } from "./boot";
export { syncChrome } from "./chrome";
export {
  BEZEL_BAND_MAX,
  BEZEL_BAND_MIN,
  BEZEL_RADIUS_MAX,
  BEZEL_RADIUS_MIN,
  CHROME_MORPH_PX,
  CHROME_SAMPLE_PX,
  clampBezelBand,
  clampBezelRadius,
  DEFAULT_BEZEL_BAND,
  DEFAULT_BEZEL_RADIUS,
  PAGE_SCROLL_TIMELINE,
  VITRE_LAYER_ATTRIBUTE,
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
} from "./scroll";
export type {
  VitreBootState,
  VitreProps,
  VitreScroll,
  VitreState,
  ChromeSyncOptions,
  ScrollPageOptions,
} from "../vitre";
