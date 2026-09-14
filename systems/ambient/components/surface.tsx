"use client";

import { cn } from "@/lib/utils";
import { LETTERBOX_INSET } from "../lib/platform";
import { useWallpaper } from "../provider";
import { LetterboxFrame } from "./letterbox-frame";
import { WallpaperBackground } from "./wallpaper-background";

export function AmbientSurface({ children }: { children: React.ReactNode }) {
  const { fullEnabled, letterbox } = useWallpaper();

  return (
    <>
      {/* Letterboxed, the body is transparent and this paints the page ground
          inside the safe area instead. */}
      {letterbox && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-x-0 -z-20 bg-background"
            style={LETTERBOX_INSET}
          />
          <LetterboxFrame />
        </>
      )}
      <WallpaperBackground enabled={fullEnabled} />
      <div
        className={cn(
          "min-h-screen transition-colors duration-500",
          fullEnabled || letterbox ? "bg-transparent" : "bg-background"
        )}
      >
        {children}
      </div>
    </>
  );
}
