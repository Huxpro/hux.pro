"use client";

import { useArmed } from "@/lib/deferred";
import dynamic from "next/dynamic";
import { useWallpaper } from "../provider";

const TiltPrimerSheetInner = dynamic(
  () =>
    import("./tilt-primer-sheet").then((m) => ({
      default: m.TiltPrimerSheet,
    })),
  { ssr: false },
);

/** Mounts the tilt primer only after the first offer. */
export function TiltPrimerSheet() {
  const { isTiltPrimerOpen } = useWallpaper();
  const armed = useArmed(isTiltPrimerOpen);
  if (!armed) return null;
  return <TiltPrimerSheetInner />;
}
