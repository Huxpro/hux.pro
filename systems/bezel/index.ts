// =============================================================================
// Bezel System — the frame a page sits in on a phone.
//
// Everything outside the page's safe area becomes one flat frame: the notch
// band, the home-indicator band, the overscroll, and the browser's own chrome.
// The page stops on a clean line inside it, rounded off at the corners, the
// way iOS rounds every app's window. After ryOS (os.ryo.lu), which paints the
// idea with a black `<html>` and four corner masks; this adds the bands, a
// thickness floor, and a colour that is not baked in.
//
//   <Bezel enabled={on} color={color} band={8} radius={24} />
//
// and everything the frame is meant to contain takes the same box:
//
//   <div className="fixed -z-10" style={BEZEL_INSET} />
//
// The colour and thickness travel as two custom properties on <html> rather
// than only as props, because on a phone they have to be right before React
// exists — see ./metrics. `<Bezel>` writes them; `applyBezelVars` is the same
// write for a boot script to do first, and `resolveBezelTint` is the same
// resolution for it to mirror.
//
// Two things about it that only a real WebKit will tell you, both measured on
// the simulator (iOS 26.5 and iOS 18.5) and both load-bearing:
//
//   • Safari reports EVERY safe-area inset as zero in portrait. Its chrome
//     already occupies those bands, so a frame sized from `env()` alone has no
//     thickness there at all. That is what the band floor is for.
//   • iOS 26 ignores `theme-color` and tints its chrome from the page's own
//     top and bottom edge pixels — which is to say, from the bands. iOS 18 is
//     the reverse and reads `theme-color`. Set both from the same colour and
//     both generations land in the same place.
//
// The `theme-color` half is left to the host: it is a `<meta>` and a piece of
// app metadata, not part of the frame.
// =============================================================================

export { Bezel, type BezelProps } from "./bezel";

export {
  applyBezelVars,
  clearBezelVars,
  clampBezelBand,
  clampBezelRadius,
  BEZEL_BAND_BOTTOM,
  BEZEL_BAND_LEFT,
  BEZEL_BAND_MAX,
  BEZEL_BAND_MIN,
  BEZEL_BAND_RIGHT,
  BEZEL_BAND_TOP,
  BEZEL_BAND_VAR,
  BEZEL_CHROME_SAMPLE_PX,
  BEZEL_CLASS,
  BEZEL_COLOR_VAR,
  BEZEL_INSET,
  BEZEL_RADIUS_MAX,
  BEZEL_RADIUS_MIN,
  DEFAULT_BEZEL_BAND,
  DEFAULT_BEZEL_RADIUS,
} from "./metrics";

export {
  isBezelHex,
  isBezelTint,
  resolveBezelTint,
  BEZEL_BLACK,
  BEZEL_HEX_PATTERN,
  BEZEL_TINTS,
  type BezelGround,
  type BezelTint,
} from "./tint";
