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
//
// In a home widget under the Android theme (`m3:`) the control is Material 3
// Expressive's *connected button group* instead: separate buttons 2dp apart,
// small inner corners and round outer ends, the selected one a tonal
// `secondary-container` whose corners open all the way round — the shape is
// the selection, so the sliding pill is not drawn. Elsewhere (the theater,
// the pickers) nothing changes.
// ---------------------------------------------------------------------------

const EASE = [0.32, 0.72, 0, 1] as const;

// `!`: the glass track's `dark:` / `hover:` / `active:` classes would
// otherwise win in one theme or on one state.
const M3_GROUP = cn(
  "m3:gap-0.5 m3:bg-transparent! m3:border-0! m3:p-0 m3:ring-0! m3:shadow-none! m3:backdrop-blur-none!",
);

const M3_BUTTON = cn(
  "m3:h-8 m3:px-3.5 m3:py-0 m3:text-xs m3:font-medium m3:tracking-[0.5px]",
  "m3:bg-(--md-surface-container-highest) m3:text-(--md-on-surface-variant)",
  "m3:rounded-[8px] m3:first:rounded-l-full m3:last:rounded-r-full",
  "m3:hover:bg-[color-mix(in_srgb,var(--md-surface-container-highest),var(--md-on-surface)_8%)] m3:hover:text-(--md-on-surface)",
  "m3:transition-[border-radius,background-color,color] m3:duration-(--md-spring-fast-spatial-duration) m3:ease-(--md-spring-fast-spatial)",
);

const M3_SELECTED = cn(
  "m3:rounded-full m3:first:rounded-full m3:last:rounded-full",
  "m3:bg-(--md-secondary-container) m3:text-(--md-on-secondary-container)",
  "m3:hover:bg-[color-mix(in_srgb,var(--md-secondary-container),var(--md-on-secondary-container)_8%)] m3:hover:text-(--md-on-secondary-container)",
);

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
   * Homepage widgets use a light frame that deepens when *this*
   * control is hovered or pressed — not when the surrounding card is.
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
        M3_GROUP,
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
              "relative isolate font-mono",
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
                  : "text-tertiary-foreground hover:text-muted-foreground focus-visible:text-foreground active:text-foreground",
              M3_BUTTON,
              active && M3_SELECTED,
            )}
          >
            {active && (
              <motion.span
                layoutId={pillId}
                className={cn(
                  "absolute inset-0 -z-10 rounded-full m3:hidden",
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
