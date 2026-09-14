"use client";

// ---------------------------------------------------------------------------
// LetterboxFrame — what makes the black read as chrome.
//
// Painting `<html>` black is half of the ryOS look. The other half is that
// the black is a FRAME the page sits in, not a page that ran out: the bands
// under the notch and the home indicator are drawn above everything, so
// content scrolling under them is hidden the way a bezel hides it, and four
// small black quarter-circles round the page off inside the bands, the way
// iOS rounds every app's window. After ryOS's DesktopCornerMask.
//
// Above everything on purpose (the dock, sheets, the palette): the frame
// clips whatever is inside it. Chromium reports zero safe-area insets, so the
// bands are invisible there; on a phone they are the status-bar and
// home-indicator strips.
// ---------------------------------------------------------------------------

const RADIUS = 12;

const CORNERS = [
  { className: "left-0 top-0", at: "100% 100%" },
  { className: "right-0 top-0", at: "0 100%" },
  { className: "bottom-0 left-0", at: "100% 0" },
  { className: "bottom-0 right-0", at: "0 0" },
] as const;

export function LetterboxFrame() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[9999]">
      {/* The bands. */}
      <div
        className="absolute inset-x-0 top-0 bg-black"
        style={{ height: "env(safe-area-inset-top, 0px)" }}
      />
      <div
        className="absolute inset-x-0 bottom-0 bg-black"
        style={{ height: "env(safe-area-inset-bottom, 0px)" }}
      />
      {/* The corners, pinned to the frame's inner edge. */}
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
              width: RADIUS,
              height: RADIUS,
              background: `radial-gradient(circle at ${at}, transparent 0 ${RADIUS - 0.5}px, #000 ${RADIUS}px)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
