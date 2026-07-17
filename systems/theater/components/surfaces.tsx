"use client";

import { TheaterOverlay } from "./theater-overlay";
import { PipOverlay } from "./pip-overlay";

// ---------------------------------------------------------------------------
// TheaterSurfaces — the always-mounted overlay chrome (theater modal + PiP
// window). Mounted once at the app root; each surface self-gates on the
// provider's mode. The minimized Live Activity lives in <Dock> separately.
// ---------------------------------------------------------------------------

export function TheaterSurfaces() {
  return (
    <>
      <TheaterOverlay />
      <PipOverlay />
    </>
  );
}
