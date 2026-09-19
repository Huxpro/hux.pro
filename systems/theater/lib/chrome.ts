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

/**
 * Page veil under the theater stage. Same frosted glass as WidgetShell and
 * Live Activity (`bg-glass` + `backdrop-blur-xl`), a notch lighter than their
 * fill so a full-page wash doesn't black out the homepage.
 *
 * "A notch lighter" is an opacity modifier on the token rather than a literal
 * card alpha, and it is the only one of its kind: it keeps the relationship
 * that matters — 80% of whatever the widget glass is — so the veil follows the
 * Tinted/Clear setting with the cards instead of staying a Tinted-strength wash
 * over a Clear page. In Tinted that is exactly the 40% it was tuned to.
 */
export const THEATER_BACKDROP = cn("bg-glass/80 backdrop-blur-xl");

/** Theme-aware track (homepage widget + AlbumTabs). */
export const GLASS_TRACK = cn(
  "border border-border/50 bg-foreground/[0.06] dark:bg-white/[0.08]",
  "backdrop-blur-xl",
);

/** Theme-aware selected / control pill. */
export const GLASS_PILL = cn(
  "bg-glass-sheet shadow-sm ring-1 ring-border/50 backdrop-blur-xl",
);

/** Theme-aware clustered toolbar (PiP + Live Activity). Same capsule as theater. */
export const GLASS_CLUSTER = cn(
  "inline-flex w-fit items-center gap-0.5 rounded-full p-0.5",
  GLASS_TRACK,
);

/**
 * Card press: a thumbnail / cover sinks slightly under the finger and springs
 * back on release (Featured Talks thumbs, the theater playlist rail).
 */
export const PRESS_CARD = cn(
  "pressable transition-[opacity,transform] duration-200 active:scale-[0.97]",
);

/**
 * Widget rest vs hover — inverted per theme, opacity so gradient cards show through.
 *
 * Light: a hairline frame at rest, ink deepens on hover.
 * Dark: no visible border at rest (fill only); hover brings a whisper of
 * edge + wash, never brighter than raised `GLASS_TRACK` (`white/08`).
 *
 * This control is its own named group (`group/glass`). It must not follow
 * the parent widget's hover/press — WidgetShell is `:active` whenever a
 * descendant (a thumbnail, a row) is held, and an unnamed `group-active:`
 * here used to light the tabs up under the wrong finger. Hover and press
 * on *this* track still deepen it (`hover:` / `active:`); the selected
 * pill follows via `group-hover/glass` / `group-active/glass`.
 */
export const GLASS_TRACK_FLAT = cn(
  "group/glass pressable border border-border/30 bg-foreground/[0.03]",
  "dark:border-transparent dark:bg-white/[0.02]",
  "backdrop-blur-xl",
  "transition-[background-color,border-color,box-shadow] duration-200",
  "hover:border-border/50 hover:bg-foreground/[0.08]",
  "active:border-border/50 active:bg-foreground/[0.08]",
  "dark:hover:border-white/[0.06] dark:hover:bg-white/[0.05]",
  "dark:active:border-white/[0.06] dark:active:bg-white/[0.05]",
);

export const GLASS_CLUSTER_FLAT = cn(
  "inline-flex w-fit items-center gap-0.5 rounded-full p-0.5",
  GLASS_TRACK_FLAT,
);

/**
 * Selected pill: light lift in light mode; dark stamp in dark mode.
 * Follows the enclosing `group/glass` track — not the parent widget.
 */
export const GLASS_PILL_FLAT = cn(
  "pressable bg-glass-overlay ring-1 ring-border/30",
  "dark:bg-glass-strong-hover dark:ring-transparent dark:shadow-none",
  "backdrop-blur-xl",
  "transition-[background-color,box-shadow,ring-color] duration-200",
  "group-active/glass:duration-0",
  "hover:bg-card hover:shadow-sm hover:ring-border/50",
  "group-hover/glass:bg-card group-hover/glass:shadow-sm group-hover/glass:ring-border/50",
  "active:bg-card active:shadow-sm active:ring-border/50",
  "group-active/glass:bg-card group-active/glass:shadow-sm group-active/glass:ring-border/50",
  "dark:hover:bg-card dark:hover:ring-white/[0.06]",
  "dark:group-hover/glass:bg-card dark:group-hover/glass:ring-white/[0.06]",
  "dark:active:bg-card dark:active:ring-white/[0.06]",
  "dark:group-active/glass:bg-card dark:group-active/glass:ring-white/[0.06]",
);

/**
 * Touch hit extension for the small (28–32px) cluster controls: the visible
 * disc stays as drawn, the tappable area grows 6px above and below (never
 * sideways, where a neighbour sits 2px away). Brings a 28px button to ~40px
 * of finger room without loosening the cluster.
 */
export const GLASS_HIT = cn(
  "relative before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']",
);

/**
 * Theme-aware icon button inside a cluster (or standalone orb).
 * `pressable` + `active:` — the wash lands on the touch-down frame (see
 * globals.css); hover alone never reaches a finger.
 */
export const GLASS_BTN = cn(
  "inline-flex items-center justify-center rounded-full",
  "pressable text-muted-foreground",
  "transition-[color,background-color,transform] duration-200",
  "outline-none focus-visible:bg-foreground/[0.08] focus-visible:text-foreground",
  "hover:bg-foreground/[0.06] hover:text-foreground",
  "active:bg-foreground/[0.08] active:text-foreground active:scale-95",
  "disabled:opacity-30 disabled:pointer-events-none",
  GLASS_HIT,
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
  "pressable text-muted-foreground",
  "transition-[color,background-color,transform] duration-200",
  "outline-none focus-visible:bg-foreground/[0.08] focus-visible:text-foreground",
  "hover:text-foreground",
  "active:bg-foreground/[0.06] active:text-foreground active:scale-[0.98]",
  GLASS_HIT,
);

/** Theme-aware freestanding prev/next orb. */
export const GLASS_ORB = cn(
  GLASS_BTN,
  // No 75% glass token; the orb floats over video, so it takes the more
  // opaque neighbour (80) rather than the thinner one.
  "bg-glass-strong-hover text-foreground shadow-sm ring-1 ring-border/40 backdrop-blur-xl",
);

/** Always-dark theater: clustered control capsule (iPadOS toolbar). */
export const GLASS_ON_DARK_CLUSTER = cn(
  "inline-flex items-center gap-0.5 rounded-full p-1",
  "bg-white/[0.08] ring-1 ring-white/15 backdrop-blur-xl",
);

/** Always-dark theater: icon button inside a cluster (or standalone orb). */
export const GLASS_ON_DARK_BTN = cn(
  "inline-flex items-center justify-center rounded-full",
  "pressable text-white/80",
  "transition-[color,background-color,transform] duration-200",
  "outline-none focus-visible:bg-white/10 focus-visible:text-white",
  "hover:bg-white/10 hover:text-white",
  "active:bg-white/15 active:text-white active:scale-95",
  GLASS_HIT,
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
