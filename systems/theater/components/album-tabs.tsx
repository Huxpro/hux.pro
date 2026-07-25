"use client";

import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";
import type { Album } from "../lib/types";

// ---------------------------------------------------------------------------
// AlbumTabs — segmented control for switching playlists (React / Lynx / …).
// Shared by the home widget and the theater overlay so the "album switcher"
// reads identically wherever it appears.
//
// Apple camera-mode capsule: tight outer shell, roomy label padding, and a
// single sliding glass pill (layoutId) that travels between options — selection
// is motion, not a hard cut.
// ---------------------------------------------------------------------------

const EASE = [0.32, 0.72, 0, 1] as const;

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
  const reduceMotion = useReducedMotion();
  // Unique per mount so homepage + theater don't fight over one layoutId.
  const pillId = useId();

  if (albums.length <= 1) return null;

  return (
    <div
      role="tablist"
      className={cn(
        // Tight outer shell — little track padding, no inter-item gap.
        // Labels carry the breathing room instead (Apple camera picker).
        "inline-flex items-center rounded-full p-0.5",
        "border border-border/40 bg-black/[0.04] dark:bg-white/[0.06]",
        className,
      )}
    >
      {albums.map((album, i) => {
        const active = i === activeIndex;
        return (
          <button
            key={album.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(i)}
            className={cn(
              "relative isolate font-mono uppercase tracking-wider",
              "transition-colors duration-200",
              // Roomy label padding inside the capsule.
              size === "sm" ? "px-3.5 py-1.5 text-[10px]" : "px-4.5 py-2 text-xs",
              active
                ? "text-foreground"
                : "text-muted-foreground/70 hover:text-muted-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={pillId}
                className={cn(
                  "absolute inset-0 -z-10 rounded-full",
                  "bg-card/90 shadow-sm ring-1 ring-border/50 backdrop-blur-xl",
                  // Soft top rim — reads slightly raised, like the camera pill.
                  "before:pointer-events-none before:absolute before:inset-x-1 before:top-px before:h-px before:rounded-full before:bg-white/35 dark:before:bg-white/20",
                )}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "tween", duration: 0.32, ease: EASE }
                }
              />
            )}
            <span className="relative z-10">{album.title}</span>
          </button>
        );
      })}
    </div>
  );
}
