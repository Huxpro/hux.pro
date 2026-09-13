"use client";

import { cn } from "@/lib/utils";
import { useWallpaper } from "../provider";
import { WallpaperBackground } from "./wallpaper-background";

export function AmbientSurface({ children }: { children: React.ReactNode }) {
  const { fullEnabled } = useWallpaper();

  return (
    <>
      <WallpaperBackground enabled={fullEnabled} />
      <div
        className={cn(
          "min-h-screen transition-colors duration-500",
          fullEnabled ? "bg-transparent" : "bg-background"
        )}
      >
        {children}
      </div>
    </>
  );
}
