"use client";

import { TheaterOverlay } from "./theater-overlay";
import { PipOverlay } from "./pip-overlay";
import { TheaterSidecar } from "./sidecar";
import { NativeWindowPlayer } from "./native-window";

// ---------------------------------------------------------------------------
// TheaterSurfaces: the always-mounted overlay chrome (theater modal, PiP,
// the docked sidecar) and the native window's contents when one is open. Mounted once at the app root; each surface self-gates on the
// provider's mode. The minimized Live Activity lives in <Dock> separately.
// ---------------------------------------------------------------------------

export function TheaterSurfaces() {
  return (
    <>
      <TheaterOverlay />
      <PipOverlay />
      <TheaterSidecar />
      <NativeWindowPlayer />
    </>
  );
}
