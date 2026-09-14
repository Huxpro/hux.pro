"use client";

import { useLayoutEffect } from "react";
import {
  applyBezelVars,
  clearBezelVars,
  BEZEL_BAND_BOTTOM,
  BEZEL_BAND_LEFT,
  BEZEL_BAND_RIGHT,
  BEZEL_BAND_TOP,
  DEFAULT_BEZEL_BAND,
  DEFAULT_BEZEL_RADIUS,
} from "./metrics";

// ---------------------------------------------------------------------------
// Bezel — the frame the page sits in.
//
// Four bands and four quarter-circles, drawn above everything, so the page
// stops on a clean line inside a bezel instead of running under the notch, the
// home indicator or a browser's chrome. After ryOS's DesktopCornerMask, with
// bands it does not have.
//
// The bands are also what colours the browser's own chrome. On iOS 26 that
// chrome is glass and samples the page's top and bottom edge pixels, so a band
// of the frame colour there makes the status bar and the toolbar the same
// surface, live, in either theme, with `theme-color` ignored. On iOS 18 the
// reverse holds and `theme-color` is what does it, from the same colour. See
// `BEZEL_BAND_MIN` in ./metrics for why the band has a floor.
//
// Above everything on purpose (docks, sheets, palettes): the frame clips
// whatever is inside it.
//
// The top and bottom bands OVERSHOOT the viewport by half a screen. iOS Safari
// relays out `position: fixed` a beat after the toolbar collapses or expands,
// and in that beat the strip the toolbar just uncovered is painted by whatever
// the old layout put there. A band anchored at the old edge and extending well
// past it covers that strip; the overshoot is clipped the rest of the time and
// costs nothing. The side bands overshoot vertically for the same reason, so
// the corners stay covered while the viewport is resizing.
// ---------------------------------------------------------------------------

const OVERSHOOT = "50vh";
const OUTSIDE = `calc(-1 * ${OVERSHOOT})`;

const CORNERS = [
  { className: "left-0 top-0", at: "100% 100%" },
  { className: "right-0 top-0", at: "0 100%" },
  { className: "bottom-0 left-0", at: "100% 0" },
  { className: "bottom-0 right-0", at: "0 0" },
] as const;

export interface BezelProps {
  /**
   * Whether the frame is up. `null` means "not decided yet": the component
   * leaves the root element exactly as it found it, which is what lets a boot
   * script paint the frame before React can tell whether it wants one. Only
   * an explicit `false` takes an existing frame back off.
   */
  enabled?: boolean | null;
  /** The frame's colour. Any CSS colour; resolve a tint with `resolveBezelTint`. */
  color?: string;
  /** Band thickness where the safe area is thinner, px. */
  band?: number;
  /** Corner radius at the frame's inner edge, px. 0 for square corners. */
  radius?: number;
  /** Root element to carry the frame's custom properties. Defaults to `<html>`. */
  rootElement?: HTMLElement | null;
}

export function Bezel({
  enabled = true,
  color,
  band = DEFAULT_BEZEL_BAND,
  radius = DEFAULT_BEZEL_RADIUS,
  rootElement,
}: BezelProps) {
  // A layout effect, not an effect: the bands paint from these two properties,
  // so writing them after the browser has already painted would show a frame
  // in the wrong colour for a frame.
  useLayoutEffect(() => {
    if (enabled === null) return;
    const root = rootElement ?? document.documentElement;
    if (enabled && color) applyBezelVars(root, { color, band });
    else if (!enabled) clearBezelVars(root);
  }, [enabled, color, band, rootElement]);

  if (!enabled) return null;

  const r = Math.max(0, radius);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[9999]">
      {/* The bands. Top and bottom span the full width; the sides fill in the
          notch's margins in landscape, where the safe area is 62px wide. */}
      <div
        className="absolute inset-x-0 bg-[var(--bezel)]"
        style={{ top: OUTSIDE, height: `calc(${OVERSHOOT} + ${BEZEL_BAND_TOP})` }}
      />
      <div
        className="absolute inset-x-0 bg-[var(--bezel)]"
        style={{
          bottom: OUTSIDE,
          height: `calc(${OVERSHOOT} + ${BEZEL_BAND_BOTTOM})`,
        }}
      />
      <div
        className="absolute left-0 bg-[var(--bezel)]"
        style={{ top: OUTSIDE, bottom: OUTSIDE, width: BEZEL_BAND_LEFT }}
      />
      <div
        className="absolute right-0 bg-[var(--bezel)]"
        style={{ top: OUTSIDE, bottom: OUTSIDE, width: BEZEL_BAND_RIGHT }}
      />
      {/* The corners, pinned to the frame's inner edge. */}
      {r > 0 && (
        <div
          className="absolute"
          style={{
            top: BEZEL_BAND_TOP,
            bottom: BEZEL_BAND_BOTTOM,
            left: BEZEL_BAND_LEFT,
            right: BEZEL_BAND_RIGHT,
          }}
        >
          {CORNERS.map(({ className, at }) => (
            <span
              key={className}
              className={`absolute block ${className}`}
              style={{
                width: r,
                height: r,
                background: `radial-gradient(circle at ${at}, transparent 0 ${r - 0.5}px, var(--bezel) ${r}px)`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
