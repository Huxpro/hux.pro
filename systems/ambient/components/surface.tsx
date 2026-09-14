"use client";

import { cn } from "@/lib/utils";
import { LETTERBOX_INSET } from "../lib/platform";
import { useWallpaper } from "../provider";
import { LetterboxFrame } from "./letterbox-frame";
import { WallpaperBackground } from "./wallpaper-background";

export function AmbientSurface({ children }: { children: React.ReactNode }) {
  const { fullEnabled, letterbox } = useWallpaper();

  return (
    // `isolate`: a stacking context of its own, so the negative-z ground and
    // wallpaper layers paint above the body's background (letterboxed, the
    // body paints the frame colour — Safari samples html/body for its chrome
    // tint — and without this it would cover them).
    <div className="isolate">
      {/* Letterboxed, the body paints the frame and this paints the page
          ground inside the safe area. Same colour today; kept separate so
          the frame can differ from the page again. */}
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
    </div>
  );
}
