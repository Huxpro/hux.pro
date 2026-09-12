"use client";

import { cn } from "@/lib/utils";
import { useOptionalWeather } from "@/systems/ambient/provider";
import { motion } from "framer-motion";
import { WALLPAPER_CROSSFADE_MS, useOptionalWallpaper } from "../provider";

// =============================================================================
// WallpaperBackground — full-page image surface.
//
// Mutually exclusive with the weather gradient: AmbientSurface only mounts
// this when wallpaper.kind === "image". Layers crossfade the way the weather
// gradient stack does, so theme / pair changes morph instead of snapping.
// =============================================================================

export function WallpaperBackground({ enabled }: { enabled: boolean }) {
  const wallpaper = useOptionalWallpaper();
  const weather = useOptionalWeather();
  const layers = wallpaper?.layers ?? [];
  const edgeFadeMask = weather?.edgeFadeMask ?? null;

  if (layers.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 -z-10",
        "transition-opacity duration-700 ease-in-out",
        enabled ? "opacity-90 dark:opacity-95" : "opacity-0"
      )}
    >
      {layers.map((layer, index) => {
        const isTop = index === layers.length - 1;
        return (
          <motion.div
            key={layer.id}
            initial={isTop && layers.length > 1 ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={{ duration: WALLPAPER_CROSSFADE_MS / 1000, ease: "easeInOut" }}
            className="absolute inset-0"
            style={edgeFadeMask ? { maskImage: edgeFadeMask, WebkitMaskImage: edgeFadeMask } : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static built-in assets; object-fit cover is the wallpaper */}
            <img
              src={layer.src}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          </motion.div>
        );
      })}
      {/* Soft scrim so page text stays readable on busy photos. */}
      <div className="absolute inset-0 bg-background/25 dark:bg-background/35" />
    </div>
  );
}
