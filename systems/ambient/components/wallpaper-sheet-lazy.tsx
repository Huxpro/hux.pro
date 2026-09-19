"use client";

import { useArmed } from "@/lib/deferred";
import dynamic from "next/dynamic";
import { useWallpaper } from "../provider";

const WallpaperSheetInner = dynamic(
  () => import("./wallpaper-sheet").then((m) => ({ default: m.WallpaperSheet })),
  { ssr: false },
);

/** Mounts the wallpaper picker only after the first open. */
export function WallpaperSheet() {
  const { isPickerOpen } = useWallpaper();
  const armed = useArmed(isPickerOpen);
  if (!armed) return null;
  return <WallpaperSheetInner />;
}
