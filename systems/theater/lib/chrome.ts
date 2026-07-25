import { cn } from "@/lib/utils";

// =============================================================================
// Theater / talks glass chrome — one material system
//
// Matches AlbumTabs (Featured Talks widget): frosted track + lifted pill, not
// inverted black stamps or four lonely discs. Theater surfaces sit on an
// always-dark backdrop, so on-dark tokens force light glass there; theme-aware
// tokens keep the homepage widget looking correct in light/dark.
// =============================================================================

/** Theme-aware track (homepage widget + AlbumTabs). */
export const GLASS_TRACK = cn(
  "border border-border/50 bg-foreground/[0.06] dark:bg-white/[0.08]",
  "backdrop-blur-xl",
);

/** Theme-aware selected / control pill. */
export const GLASS_PILL = cn(
  "bg-card/90 shadow-sm ring-1 ring-border/50 backdrop-blur-xl",
);

/** Always-dark theater: clustered control capsule (iPadOS toolbar). */
export const GLASS_ON_DARK_CLUSTER = cn(
  "inline-flex items-center gap-0.5 rounded-full p-1",
  "bg-white/[0.08] ring-1 ring-white/15 backdrop-blur-xl",
);

/** Always-dark theater: icon button inside a cluster (or standalone orb). */
export const GLASS_ON_DARK_BTN = cn(
  "inline-flex items-center justify-center rounded-full",
  "text-white/80 transition-colors",
  "hover:bg-white/10 hover:text-white active:scale-95",
);

/** Always-dark theater: freestanding prev/next orb. */
export const GLASS_ON_DARK_ORB = cn(
  GLASS_ON_DARK_BTN,
  "bg-white/[0.08] ring-1 ring-white/15 backdrop-blur-xl",
);
