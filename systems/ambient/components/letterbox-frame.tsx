"use client";

import {
  LETTERBOX_BAND_BOTTOM,
  LETTERBOX_BAND_LEFT,
  LETTERBOX_BAND_RIGHT,
  LETTERBOX_BAND_TOP,
} from "../lib/platform";
import { useWallpaper } from "../provider";

// ---------------------------------------------------------------------------
// LetterboxFrame — what makes the bands read as chrome.
//
// Painting `<html>` in the frame colour is half of the ryOS look. The other
// half is that it is a FRAME the page sits in, not a page that ran out: the
// bands under the notch and the home indicator are drawn above everything,
// so content scrolling under them is hidden the way a bezel hides it, and
// four quarter-circles round the page off inside the bands, the way iOS
// rounds every app's window. After ryOS's DesktopCornerMask.
//
// The frame colour is `--letterbox` (globals.css): the dark ground, in both
// themes.
//
// The bands are also what colours the browser's own chrome. On iOS 26 Safari's
// chrome is glass and samples the page's top and bottom edge pixels — a band
// of the frame colour there and the status bar and the toolbar become the same
// surface, live, in either theme, with `theme-color` ignored. On iOS 18 that
// job falls to theme-color and the `<html>` background instead; both are set,
// so both generations land in the same place. See `LETTERBOX_BAND_MIN_PX`.
//
// Above everything on purpose (the dock, sheets, the palette): the frame
// clips whatever is inside it.
//
// The top and bottom bands OVERSHOOT the viewport by half a screen. iOS Safari
// relays out `position: fixed` a beat after the toolbar collapses or expands,
// and in that beat the strip the toolbar just uncovered is painted by whatever
// the old layout put there — the wallpaper, the scrolling page. A band anchored
// at the old edge and extending well past it is what covers that strip; the
// overshoot is clipped the rest of the time and costs nothing. The side bands
// overshoot vertically for the same reason, so the corners stay covered while
// the viewport is resizing.
// ---------------------------------------------------------------------------

const OVERSHOOT = "50vh";
const OUTSIDE = `calc(-1 * ${OVERSHOOT})`;

const CORNERS = [
  { className: "left-0 top-0", at: "100% 100%" },
  { className: "right-0 top-0", at: "0 100%" },
  { className: "bottom-0 left-0", at: "100% 0" },
  { className: "bottom-0 right-0", at: "0 0" },
] as const;

export function LetterboxFrame() {
  const { letterboxRadius: r } = useWallpaper();

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[9999]">
      {/* The bands. Top and bottom span the full width; the sides fill in the
          notch's margins in landscape, where the safe area is 62px wide. */}
      <div
        className="absolute inset-x-0 bg-[var(--letterbox)]"
        style={{
          top: OUTSIDE,
          height: `calc(${OVERSHOOT} + ${LETTERBOX_BAND_TOP})`,
        }}
      />
      <div
        className="absolute inset-x-0 bg-[var(--letterbox)]"
        style={{
          bottom: OUTSIDE,
          height: `calc(${OVERSHOOT} + ${LETTERBOX_BAND_BOTTOM})`,
        }}
      />
      <div
        className="absolute left-0 bg-[var(--letterbox)]"
        style={{ top: OUTSIDE, bottom: OUTSIDE, width: LETTERBOX_BAND_LEFT }}
      />
      <div
        className="absolute right-0 bg-[var(--letterbox)]"
        style={{ top: OUTSIDE, bottom: OUTSIDE, width: LETTERBOX_BAND_RIGHT }}
      />
      {/* The corners, pinned to the frame's inner edge. */}
      {r > 0 && (
        <div
          className="absolute"
          style={{
            top: LETTERBOX_BAND_TOP,
            bottom: LETTERBOX_BAND_BOTTOM,
            left: LETTERBOX_BAND_LEFT,
            right: LETTERBOX_BAND_RIGHT,
          }}
        >
          {CORNERS.map(({ className, at }) => (
            <span
              key={className}
              className={`absolute block ${className}`}
              style={{
                width: r,
                height: r,
                background: `radial-gradient(circle at ${at}, transparent 0 ${r - 0.5}px, var(--letterbox) ${r}px)`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
