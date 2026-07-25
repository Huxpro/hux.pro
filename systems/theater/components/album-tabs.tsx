"use client";

import { cn } from "@/lib/utils";
import type { Album } from "../lib/types";

// ---------------------------------------------------------------------------
// AlbumTabs — segmented control for switching playlists (React / Lynx / …).
// Shared by the home widget and the theater overlay so the "album switcher"
// reads identically wherever it appears.
//
// Glass capsule: the selected album is a lifted frosted pill (same language as
// the dock / widget chrome), not an inverted black stamp — so the control
// stays secondary to the video covers.
// ---------------------------------------------------------------------------

interface AlbumTabsProps {
  albums: Album[];
  activeIndex: number;
  onSelect: (index: number) => void;
  className?: string;
  size?: "sm" | "md";
}

export function AlbumTabs({
  albums,
  activeIndex,
  onSelect,
  className,
  size = "sm",
}: AlbumTabsProps) {
  if (albums.length <= 1) return null;
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 rounded-full p-1",
        "border border-border/40 bg-black/[0.03] dark:bg-white/[0.04]",
        className,
      )}
    >
      {albums.map((album, i) => {
        const active = i === activeIndex;
        return (
          <button
            key={album.id}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(i)}
            className={cn(
              "rounded-full font-mono uppercase tracking-wider transition-all",
              size === "sm" ? "px-2.5 py-1 text-[10px]" : "px-3.5 py-1.5 text-xs",
              active
                ? "bg-card/90 text-foreground shadow-sm ring-1 ring-border/50 backdrop-blur-xl"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {album.title}
          </button>
        );
      })}
    </div>
  );
}
