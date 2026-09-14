"use client";

import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";
import {
  GLASS_ON_DARK_PILL,
  GLASS_ON_DARK_TRACK,
  GLASS_PILL,
  GLASS_PILL_FLAT,
  GLASS_TRACK,
  GLASS_TRACK_FLAT,
} from "../lib/chrome";
import type { Album } from "../lib/types";

// ---------------------------------------------------------------------------
// AlbumTabs — segmented control for switching playlists (React / Lynx / …).
// Shared by the home widget and the theater overlay so the "album switcher"
// reads identically wherever it appears — and by the wallpaper picker's
// categories, which are the same kind of choice: one group of things at a time.
//
// Apple camera-mode capsule: tight outer shell, roomy label padding, and a
// single sliding glass pill (layoutId) that travels between options — selection
// is motion, not a hard cut. Material tokens live in lib/chrome.ts so theater
// window controls share the same frosted language.
//
// `tone="onDark"` is the dim dark-stamp language, forced for editor mocks
// and any stage that cannot follow the site theme.
// ---------------------------------------------------------------------------

const EASE = [0.32, 0.72, 0, 1] as const;

interface AlbumTabsProps {
  /** Only the id and label are read, so any named group can be a tab. */
  albums: Pick<Album, "id" | "title">[];
  activeIndex: number;
  onSelect: (index: number) => void;
  className?: string;
  size?: "sm" | "md";
  /** Force light-on-dark glass (theater). Default is theme-aware (homepage). */
  tone?: "default" | "onDark";
  /**
   * Homepage widgets use a light frame that deepens on hover.
   * Theater / Live Activity keep the raised track.
   */
  raised?: boolean;
}

export function AlbumTabs({
  albums,
  activeIndex,
  onSelect,
  className,
  size = "sm",
  tone = "default",
  raised = true,
}: AlbumTabsProps) {
  const reduceMotion = useReducedMotion();
  // Unique per mount so homepage + theater don't fight over one layoutId.
  const pillId = useId();
  const onDark = tone === "onDark";

  if (albums.length <= 1) return null;

  return (
    <div
      role="tablist"
      className={cn(
        // Tight outer shell — little track padding, no inter-item gap.
        // Labels carry the breathing room instead (Apple camera picker).
        "inline-flex items-center rounded-full p-0.5",
        onDark ? GLASS_ON_DARK_TRACK : raised ? GLASS_TRACK : GLASS_TRACK_FLAT,
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
              // `pressable`: the label brightens on the touch-down frame, not
              // only on hover, and eases back on release.
              "pressable outline-none transition-colors duration-200",
              // Roomy label padding inside the capsule.
              size === "sm" ? "px-3.5 py-1.5 text-[10px]" : "px-4 py-2 text-xs",
              onDark
                ? active
                  ? "text-white"
                  : "text-white/45 hover:text-white/70 focus-visible:text-white/80 active:text-white"
                : active
                  ? "text-foreground"
                  : "text-muted-foreground/70 hover:text-muted-foreground focus-visible:text-foreground active:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={pillId}
                className={cn(
                  "absolute inset-0 -z-10 rounded-full",
                  onDark
                    ? GLASS_ON_DARK_PILL
                    : raised
                      ? GLASS_PILL
                      : GLASS_PILL_FLAT,
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
