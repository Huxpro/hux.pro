"use client";

import { cn } from "@/lib/utils";
import { useOptionalWeather } from "@/systems/ambient/provider";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { wallpaperDocumentClassNames } from "../lib";
import { WALLPAPER_CROSSFADE_MS, useOptionalWallpaper } from "../provider";

// =============================================================================
// WallpaperBackground — full-page image surface.
//
// Mutually exclusive with the weather gradient: AmbientSurface only mounts
// this when wallpaper.kind === "image". Layers crossfade the way the weather
// gradient stack does, so theme / pair changes morph instead of snapping.
//
// Two treatments, after Apple's lock screen vs Notification Center / Music:
//   Home (desktop)  — sharp photo, light scrim, thin glass samples the image.
//   Read (inner)    — scale + blur the photo, then a veil + vignette so prose
//                     stays the figure. No boxed article.
// =============================================================================

export function WallpaperBackground({ enabled }: { enabled: boolean }) {
  const wallpaper = useOptionalWallpaper();
  const weather = useOptionalWeather();
  const pathname = usePathname();
  const layers = wallpaper?.layers ?? [];
  const edgeFadeMask = weather?.edgeFadeMask ?? null;
  const readSurface = wallpaperDocumentClassNames(
    wallpaper?.kind ?? "weather",
    pathname
  ).read;

  if (layers.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 -z-10",
        "transition-opacity duration-700 ease-in-out",
        enabled
          ? readSurface
            ? "opacity-100"
            : "opacity-90 dark:opacity-95"
          : "opacity-0"
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
            className="absolute inset-0 overflow-hidden"
            style={edgeFadeMask ? { maskImage: edgeFadeMask, WebkitMaskImage: edgeFadeMask } : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static built-in assets; object-fit cover is the wallpaper */}
            <img
              src={layer.src}
              alt=""
              className={cn(
                "absolute inset-0 h-full w-full object-cover origin-center",
                "transition-[filter,transform] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]",
                readSurface && "scale-[1.12] blur-[40px]"
              )}
            />
          </motion.div>
        );
      })}
      <div
        className={cn(
          "absolute inset-0 transition-colors duration-700",
          readSurface
            ? "bg-background/45 dark:bg-background/55"
            : "bg-background/8 dark:bg-background/16"
        )}
      />
      {readSurface && <div className="wallpaper-read-vignette absolute inset-0" />}
    </div>
  );
}
