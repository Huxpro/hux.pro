import { cn } from "@/lib/utils";

// =============================================================================
// Theater / talks glass chrome — one material system
//
// Matches AlbumTabs (Featured Talks widget): frosted track + lifted pill, not
// inverted black stamps or four lonely discs. Shared by talks (widget, theater,
// PiP, Live Activity) and music (widget + Live Activity) so playback chrome
// is one system. Theater chrome follows the site theme (same as PiP); the
// video stage stays black. On-dark tokens remain for forced-dark contexts
// (editor mocks, optional `tone="onDark"`).
// =============================================================================

/** Page veil under the theater stage — a clean dim, no blur (blur kills chroma). */
export const THEATER_BACKDROP = cn(
  "bg-black/20",
  "dark:bg-black/15",
);

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
 * Widget rest vs hover — inverted per theme, opacity so gradient cards show through.
 *
 * Light: a hairline frame at rest, ink deepens on hover.
 * Dark: no visible border at rest (fill only); hover brings a whisper of
 * edge + wash, never brighter than raised `GLASS_TRACK` (`white/08`).
 */
export const GLASS_TRACK_FLAT = cn(
  "border border-border/30 bg-foreground/[0.03]",
  "dark:border-transparent dark:bg-white/[0.02]",
  "backdrop-blur-xl",
  "transition-[background-color,border-color,box-shadow] duration-200",
  "hover:border-border/50 hover:bg-foreground/[0.08]",
  "group-hover:border-border/50 group-hover:bg-foreground/[0.08]",
  "dark:hover:border-white/[0.06] dark:hover:bg-white/[0.05]",
  "dark:group-hover:border-white/[0.06] dark:group-hover:bg-white/[0.05]",
);

export const GLASS_CLUSTER_FLAT = cn(
  "inline-flex w-fit items-center gap-0.5 rounded-full p-0.5",
  GLASS_TRACK_FLAT,
);

/** Selected pill: light lift in light mode; dark stamp in dark mode. */
export const GLASS_PILL_FLAT = cn(
  "bg-card/70 ring-1 ring-border/30",
  "dark:bg-card/80 dark:ring-transparent dark:shadow-none",
  "backdrop-blur-xl",
  "transition-[background-color,box-shadow,ring-color] duration-200",
  "hover:bg-card hover:shadow-sm hover:ring-border/50",
  "group-hover:bg-card group-hover:shadow-sm group-hover:ring-border/50",
  "dark:hover:bg-card dark:hover:ring-white/[0.06]",
  "dark:group-hover:bg-card dark:group-hover:ring-white/[0.06]",
);

/** Theme-aware icon button inside a cluster (or standalone orb). */
export const GLASS_BTN = cn(
  "inline-flex items-center justify-center rounded-full",
  "text-muted-foreground transition-colors",
  "outline-none focus-visible:bg-foreground/[0.08] focus-visible:text-foreground",
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
  "outline-none focus-visible:bg-foreground/[0.08] focus-visible:text-foreground",
  "hover:text-foreground active:scale-[0.98]",
);

/** Theme-aware freestanding prev/next orb. */
export const GLASS_ORB = cn(
  GLASS_BTN,
  "bg-card/75 text-foreground shadow-sm ring-1 ring-border/40 backdrop-blur-xl",
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
  "outline-none focus-visible:bg-white/10 focus-visible:text-white",
  "hover:bg-white/10 hover:text-white active:scale-95",
);

/** Always-dark theater: freestanding prev/next orb. */
export const GLASS_ON_DARK_ORB = cn(
  GLASS_ON_DARK_BTN,
  "bg-white/[0.08] ring-1 ring-white/15 backdrop-blur-xl",
);

/**
 * Always-dark theater album tabs — same language as dark-mode widget tabs
 * (dim / frameless track + dark stamp). Not the brighter window-toolbar glass.
 */
export const GLASS_ON_DARK_TRACK = cn(
  "border border-transparent bg-white/[0.02] backdrop-blur-xl",
  "hover:border-white/[0.06] hover:bg-white/[0.05]",
);

/** Always-dark theater: dark selected stamp, not a white chip. */
export const GLASS_ON_DARK_PILL = cn(
  "bg-black/55 shadow-sm ring-1 ring-transparent backdrop-blur-xl",
);
