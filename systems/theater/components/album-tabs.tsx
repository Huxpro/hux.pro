"use client";

import { cn } from "@/lib/utils";
import type { Album } from "../lib/types";

// ---------------------------------------------------------------------------
// AlbumTabs — segmented control for switching playlists (React / Lynx / …).
// Shared by the home widget and the theater overlay so the "album switcher"
// reads identically wherever it appears.
// ---------------------------------------------------------------------------

interface AlbumTabsProps {
  albums: Album[];
  activeIndex: number;
  onSelect: (index: number) => void;
  className?: string;
  size?: "sm" | "md";
  /**
   * `onDark` uses the on-media dark-glass recipe (shared with PlayBadge / the
   * slide modal) for the always-dark theater backdrop; `default` stays
   * theme-aware for the light home widget.
   */
  tone?: "default" | "onDark";
}

export function AlbumTabs({
  albums,
  activeIndex,
  onSelect,
  className,
  size = "sm",
  tone = "default",
}: AlbumTabsProps) {
  if (albums.length <= 1) return null;
  const onDark = tone === "onDark";
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border p-1 backdrop-blur-xl",
        onDark ? "border-white/15 bg-black/55" : "border-border/50 bg-card/60",
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
              "rounded-full font-mono uppercase tracking-wider transition-colors",
              size === "sm" ? "px-2.5 py-1 text-[10px]" : "px-3.5 py-1.5 text-xs",
              active
                ? onDark
                  ? "bg-white text-black"
                  : "bg-foreground text-background"
                : onDark
                  ? "text-white/60 hover:text-white"
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
