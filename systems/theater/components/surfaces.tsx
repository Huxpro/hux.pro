"use client";

import { afterFirstPaint, useArmed } from "@/lib/deferred";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useTheater } from "../provider";

// ---------------------------------------------------------------------------
// TheaterSurfaces — the always-mounted overlay chrome (theater modal + PiP
// window). Mounted once at the app root; each surface self-gates on the
// provider's mode. The minimized Live Activity lives in <Dock> separately.
//
// The overlays stay out of the initial bundle until theater is first opened
// (or idle prefetch lands). Featured talks on the home grid can open without
// a cold chunk most of the time because we warm both modules after TTI.
// ---------------------------------------------------------------------------

const TheaterOverlay = dynamic(
  () => import("./theater-overlay").then((m) => ({ default: m.TheaterOverlay })),
  { ssr: false },
);

const PipOverlay = dynamic(
  () => import("./pip-overlay").then((m) => ({ default: m.PipOverlay })),
  { ssr: false },
);

export function TheaterSurfaces() {
  const { mode } = useTheater();
  const armed = useArmed(mode !== "closed");

  useEffect(() => {
    return afterFirstPaint(() => {
      void import("./theater-overlay");
      void import("./pip-overlay");
    });
  }, []);

  if (!armed) return null;
  return (
    <>
      <TheaterOverlay />
      <PipOverlay />
    </>
  );
}
