"use client";

import { cn } from "@/lib/utils";
import {
  Vitre,
  BEZEL_INSET,
  VITRE_LAYER_ATTRIBUTE,
  getScrollContainer,
  scrollPageTo,
} from "vitre";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useWallpaper } from "../provider";
import { WallpaperBackground } from "./wallpaper-background";

export function AmbientSurface({ children }: { children: React.ReactNode }) {
  const {
    fullEnabled,
    bezel,
    bezelState,
    bezelScroll,
    bezelChromeMorph,
    bezelColor,
    bezelBand,
    bezelRadius,
    ground,
  } = useWallpaper();

  // Next scrolls the WINDOW to the top on navigation. In container scroll the
  // window cannot scroll and the page lives in Vitre's scroll container, which
  // would otherwise keep the previous page's offset. A hash is left to the
  // browser, which scrolls the nearest scroll container to it on its own.
  const pathname = usePathname();
  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    if (!getScrollContainer() || window.location.hash) return;
    scrollPageTo(0);
  }, [pathname]);

  return (
    // `isolate`: a stacking context of its own, so the negative-z ground and
    // wallpaper layers paint above the body's background (with the bezel on,
    // the body paints the bezel colour and would otherwise cover them).
    <div className="isolate">
      <Vitre
        enabled={bezelState}
        color={bezelColor}
        band={bezelBand}
        radius={bezelRadius}
        scroll={bezelScroll}
        chromeMorph={bezelChromeMorph}
        ground={ground}
        backdrop={
          <>
            {/* The page's own ground inside the bezel — white in light. */}
            {bezel && (
              <div
                aria-hidden="true"
                {...{ [VITRE_LAYER_ATTRIBUTE]: "" }}
                className="pointer-events-none fixed -z-20 bg-background"
                style={BEZEL_INSET}
              />
            )}
            <WallpaperBackground enabled={fullEnabled} />
          </>
        }
        className={cn(
          "min-h-screen transition-colors duration-500",
          fullEnabled || bezel ? "bg-transparent" : "bg-background"
        )}
      >
        {/* What steps out of the frame when the page is pulled down for the
            sky window — every page's content, and nothing that paints the sky
            (the backdrop is Vitre's, beside this). Unstyled, and untransformed
            at rest: see "The sky pull" in globals.css. */}
        <div data-sky-exits="page">{children}</div>
      </Vitre>
    </div>
  );
}
