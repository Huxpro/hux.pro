"use client";

import { useLayoutEffect, useRef } from "react";
import { keepBezelFrame, readBezelBoot, removeBezelFrame } from "./boot";
import {
  applyBezelBand,
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
// The bands are painted in `var(--bezel)`, the colour the boot script put on
// the root background. That matters because iOS 26 Safari tints its chrome from
// `position: fixed` content at the viewport edge — these bands are such
// content — and otherwise from the root background. Same colour either way, so
// the chrome copies the boot colour whatever the band's thickness, including
// zero. On iOS 18 `theme-color` does that job, from the same colour.
//
// Above everything on purpose (docks, sheets, palettes): the frame clips
// whatever is inside it.
//
// The top and bottom bands OVERSHOOT the viewport by half a screen. That was
// for iOS Safari relaying out `position: fixed` a beat after its toolbar
// collapses or expands. With the document locked the toolbar no longer does,
// so on a phone the overshoot is now insurance rather than a fix; it is kept
// because it is free while clipped, and a desktop window can still resize.
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
   * Whether the frame is up. Live: turning it on puts the frame on <html> —
   * class, colour, band, lock and theme-color — and turning it off takes it
   * off again. `null` means "not known yet" and leaves <html> exactly as the
   * boot script left it, so a page that loaded framed stays framed until the
   * host has decided.
   */
  enabled?: boolean | null;
  /** Band thickness where the frame is drawn, px. Live. */
  band?: number;
  /** Corner radius at the frame's inner edge, px. 0 for square corners. Live. */
  radius?: number;
  /** Root element carrying the frame. Defaults to `<html>`. */
  rootElement?: HTMLElement | null;
}

export function Bezel({
  enabled = true,
  band = DEFAULT_BEZEL_BAND,
  radius = DEFAULT_BEZEL_RADIUS,
  rootElement,
}: BezelProps) {
  // The band is read through a ref so a band change does not tear the frame
  // down and put it back; it only rewrites the property.
  const bandRef = useRef(band);
  useLayoutEffect(() => {
    bandRef.current = band;
    if (enabled) applyBezelBand(rootElement ?? document.documentElement, band);
  }, [enabled, band, rootElement]);

  // On and off. The colour and whether the frame locks the document come from
  // the boot script's record: one colour per page load (see ./tint), and the
  // lock is a property of the platform. While on, the frame is kept on <html>
  // against anything that strips it — see ./boot.
  useLayoutEffect(() => {
    const root = rootElement ?? document.documentElement;
    const boot = readBezelBoot();
    // Not decided yet: hold whatever the boot script put on, band included,
    // even through a failed hydration stripping <html> in the meantime.
    if (enabled === null) {
      if (!boot?.framed) return;
      return keepBezelFrame(root, () => ({
        color: boot.color,
        band: boot.band,
        lock: boot.lock,
      }));
    }
    if (!enabled || !boot) {
      removeBezelFrame(root);
      return;
    }
    return keepBezelFrame(root, () => ({
      color: boot.color,
      band: bandRef.current,
      lock: boot.lock,
    }));
  }, [enabled, rootElement]);

  if (!enabled) return null;

  const r = Math.max(0, radius);

  return (
    // `data-bezel-layer`: on a locked phone the frame is absolute in the fixed
    // body, like every other full-screen layer — a fixed one spanning the
    // edge makes Safari copy whatever is beneath it. See globals.css.
    <div
      aria-hidden="true"
      data-bezel-layer
      className="pointer-events-none fixed inset-0 z-[9999]"
    >
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
