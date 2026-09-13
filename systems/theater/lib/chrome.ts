import { cn } from "@/lib/utils";

// =============================================================================
// Theater / talks glass chrome — one material system
//
// Matches AlbumTabs (Featured Talks widget): frosted track + lifted pill, not
// inverted black stamps or four lonely discs. Shared by talks (widget, theater,
// PiP, Live Activity) and music (widget + Live Activity) so playback chrome
// is one system. Theater (always-dark) uses on-dark tokens; the others stay
// theme-aware.
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

/** Theme-aware clustered toolbar (PiP + Live Activity). Same capsule as theater. */
export const GLASS_CLUSTER = cn(
  "inline-flex w-fit items-center gap-0.5 rounded-full p-0.5",
  GLASS_TRACK,
);

/**
 * Widget-desktop rest: a hairline track. Hovering the control or the parent
 * `group` card deepens the same frame — it does not appear from nothing.
 * Live Activity stays fully raised (`GLASS_TRACK`).
 */
export const GLASS_TRACK_FLAT = cn(
  "border border-border/30 bg-foreground/[0.03]",
  "dark:border-white/12 dark:bg-white/[0.04]",
  "transition-[background-color,border-color,box-shadow] duration-200",
  "hover:border-border/50 hover:bg-foreground/[0.08]",
  "group-hover:border-border/50 group-hover:bg-foreground/[0.08]",
  "dark:hover:border-white/20 dark:hover:bg-white/[0.10]",
  "dark:group-hover:border-white/20 dark:group-hover:bg-white/[0.10]",
);

export const GLASS_CLUSTER_FLAT = cn(
  "inline-flex w-fit items-center gap-0.5 rounded-full p-0.5",
  GLASS_TRACK_FLAT,
);

/** Selected pill: faint at rest, lifts when the control or widget is hovered. */
export const GLASS_PILL_FLAT = cn(
  "bg-card/70 ring-1 ring-border/30",
  "dark:bg-white/10 dark:ring-white/15",
  "transition-[background-color,box-shadow,ring-color] duration-200",
  "hover:bg-card hover:shadow-sm hover:ring-border/50",
  "group-hover:bg-card group-hover:shadow-sm group-hover:ring-border/50",
);

/** Theme-aware icon button inside a cluster (or standalone orb). */
export const GLASS_BTN = cn(
  "inline-flex items-center justify-center rounded-full",
  "text-muted-foreground transition-colors",
  "hover:bg-foreground/[0.06] hover:text-foreground active:scale-95",
  "disabled:opacity-30 disabled:pointer-events-none",
);

/** Shared icon-button size for music + watching Live Activity clusters. */
export const GLASS_CLUSTER_BTN = cn(GLASS_BTN, "h-7 w-7");

/**
 * Theme-aware text action (PiP / Theater chips). Mono + tracking match
 * AlbumTabs and WidgetTitle.
 */
export const GLASS_ACTION = cn(
  "inline-flex items-center justify-center gap-1.5 rounded-full",
  "text-xs font-mono uppercase tracking-wider",
  "text-muted-foreground transition-colors",
  "hover:text-foreground active:scale-[0.98]",
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

/** Always-dark theater: album-tab track (same material as the control cluster). */
export const GLASS_ON_DARK_TRACK = cn(
  "bg-white/[0.08] ring-1 ring-white/15 backdrop-blur-xl",
);

/** Always-dark theater: selected album pill — soft glass, not theme `bg-card`. */
export const GLASS_ON_DARK_PILL = cn(
  "bg-white/20 shadow-sm ring-1 ring-white/25 backdrop-blur-xl",
);
