"use client";

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
// The frame is the page ground, not black — see globals.css: Safari refused
// a black tint for its chrome and kept its own grey, and the ground is what
// it honours, so ground-coloured bands are what meet the chrome seamlessly.
//
// Above everything on purpose (the dock, sheets, the palette): the frame
// clips whatever is inside it.
//
// The bands OVERSHOOT the viewport by half a screen. iOS Safari relays out
// `position: fixed` a beat after the toolbar collapses or expands, and in
// that beat the strip the toolbar just uncovered is painted by whatever the
// old layout put there — the wallpaper, the scrolling page. A band anchored
// at the old edge and extending well past it is what covers that strip; the
// overshoot is clipped the rest of the time and costs nothing.
// ---------------------------------------------------------------------------

const OVERSHOOT = "50vh";

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
      {/* The bands. */}
      <div
        className="absolute inset-x-0 bg-background"
        style={{
          top: `calc(-1 * ${OVERSHOOT})`,
          height: `calc(${OVERSHOOT} + env(safe-area-inset-top, 0px))`,
        }}
      />
      <div
        className="absolute inset-x-0 bg-background"
        style={{
          bottom: `calc(-1 * ${OVERSHOOT})`,
          height: `calc(${OVERSHOOT} + env(safe-area-inset-bottom, 0px))`,
        }}
      />
      {/* The corners, pinned to the frame's inner edge. */}
      {r > 0 && (
        <div
          className="absolute inset-x-0"
          style={{
            top: "env(safe-area-inset-top, 0px)",
            bottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          {CORNERS.map(({ className, at }) => (
            <span
              key={className}
              className={`absolute block ${className}`}
              style={{
                width: r,
                height: r,
                background: `radial-gradient(circle at ${at}, transparent 0 ${r - 0.5}px, var(--background) ${r}px)`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
