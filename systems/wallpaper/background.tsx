"use client";

import { useState } from "react";
import { useWallpaper } from "@/systems/ambient/provider";

/** Only mounted for image mode: weather layers never show through, even on error. */
export function WallpaperBackground() {
  const { resolved } = useWallpaper();
  return <ImageLayer key={resolved.src} src={resolved.src} />;
}

function ImageLayer({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div
      aria-hidden="true"
      data-wallpaper-background="image"
      data-status={failed ? "error" : loaded ? "ready" : "loading"}
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
    >
      {!failed && (
        // Local WebP assets are pre-sized; no image server is required.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {/* A theme-colored veil preserves the reading contrast of the OS surface. */}
      <div className="absolute inset-0 bg-background/65 dark:bg-background/55" />
    </div>
  );
}
