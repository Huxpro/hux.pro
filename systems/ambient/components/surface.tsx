"use client";

import { cn } from "@/lib/utils";
import { Bezel, BEZEL_INSET } from "@/systems/bezel";
import { useWallpaper } from "../provider";
import { WallpaperBackground } from "./wallpaper-background";

export function AmbientSurface({ children }: { children: React.ReactNode }) {
  const {
    fullEnabled,
    letterbox,
    letterboxState,
    letterboxColor,
    letterboxBand,
    letterboxRadius,
  } = useWallpaper();

  return (
    // `isolate`: a stacking context of its own, so the negative-z ground and
    // wallpaper layers paint above the body's background (framed, the body
    // paints the frame colour — Safari samples html/body for its chrome tint —
    // and without this it would cover them).
    <div className="isolate">
      {/* Framed, the body paints the frame and this paints the page's own
          ground inside it — white in light. */}
      {letterbox && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed -z-20 bg-background"
          style={BEZEL_INSET}
        />
      )}
      {/* Always mounted so it can also take a frame back off — except while
          `letterboxState` is null, where it leaves the boot script's alone. */}
      <Bezel
        enabled={letterboxState}
        color={letterboxColor}
        band={letterboxBand}
        radius={letterboxRadius}
      />
      <WallpaperBackground enabled={fullEnabled} />
      <div
        className={cn(
          "min-h-screen transition-colors duration-500",
          fullEnabled || letterbox ? "bg-transparent" : "bg-background"
        )}
      >
        {children}
      </div>
    </div>
  );
}
