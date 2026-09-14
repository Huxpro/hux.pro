"use client";

import { cn } from "@/lib/utils";
import {
  Bezel,
  BEZEL_INSET,
  BEZEL_SCROLL_ROOT_ID,
  getPageScrollRoot,
  scrollPageTo,
} from "@/systems/bezel";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useWallpaper } from "../provider";
import { WallpaperBackground } from "./wallpaper-background";

export function AmbientSurface({ children }: { children: React.ReactNode }) {
  const {
    fullEnabled,
    letterbox,
    letterboxState,
    letterboxBand,
    letterboxRadius,
  } = useWallpaper();

  // Next scrolls the WINDOW to the top on navigation. With the document locked
  // the window cannot scroll and the page lives in #scroll-root, which would
  // otherwise keep the previous page's offset. A hash is left to the browser,
  // which scrolls the nearest scroll container to it on its own.
  const pathname = usePathname();
  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    if (!getPageScrollRoot() || window.location.hash) return;
    scrollPageTo(0);
  }, [pathname]);

  return (
    // `isolate`: a stacking context of its own, so the negative-z ground and
    // wallpaper layers paint above the body's background (framed, the body
    // paints the frame colour and without this it would cover them).
    <div className="isolate">
      {/* Framed, the body paints the frame and this paints the page's own
          ground inside it — white in light. `data-bezel-layer`: on a locked
          phone it must not be `position: fixed`, or Safari copies it into its
          chrome instead of the frame colour; see globals.css. */}
      {letterbox && (
        <div
          aria-hidden="true"
          data-bezel-layer
          className="pointer-events-none fixed -z-20 bg-background"
          style={BEZEL_INSET}
        />
      )}
      {/* Live: turns on and off with the wallpaper kind and the override, in
          the colour the boot script fixed for this page load. */}
      <Bezel
        enabled={letterboxState}
        band={letterboxBand}
        radius={letterboxRadius}
      />
      <WallpaperBackground enabled={fullEnabled} />
      {/* The page. Where it scrolls depends on the lock the boot script chose:
          unlocked it is an ordinary block and the window scrolls; locked, the
          stylesheet turns it into the one scroll container on the page,
          inside the frame. Its id and inset are always rendered, so the
          server markup is the same in both and nothing hydrates differently —
          `top`/`bottom` do nothing to a static element. */}
      <div
        id={BEZEL_SCROLL_ROOT_ID}
        style={BEZEL_INSET}
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
