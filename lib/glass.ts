import { cn } from "@/lib/utils";

// =============================================================================
// Glass recipes — the class strings that make a surface System glass.
//
// A surface only follows the Glass material setting (Tinted / Clear, see
// docs/system-glass.md) if it paints with the `--glass*` tokens. A surface that
// hardcodes its own `bg-card/NN` simply will not respond — it stays an opaque
// slab beside washed-out neighbours, which is the bug the tokens exist to
// prevent. `no-restricted-syntax` in eslint.config.mjs enforces that.
//
// This is the one module for those recipes. They started life in
// `systems/theater/lib/chrome.ts` because playback chrome was the first thing
// to need them, but the same capsule now switches wallpaper categories in the
// picker and the same cluster carries the music Live Activity — a shared
// material is not theater's to own. A new recipe belongs here.
//
// Only recipes used by more than one surface belong here. A one-off surface
// should just write `bg-glass…` inline.
//
// The tokens are for a fill that *is* the surface. An ink wash is not: a
// recessed track, a hover deepening, a press — those are drawn relative to the
// content in front of them (`bg-foreground/[0.06]`, `bg-white/[0.05]`), so they
// read on any card under any material, and a card-coloured fill at the same
// alpha would simply disappear. That is why this file is the one place the
// eslint rule exempts, and why a raw alpha anywhere else is a surface that
// forgot the tokens.
// =============================================================================

/**
 * The lifted translucent panel — the Dock Live Activity's expanded state, and
 * anything that wants to look like it. Deliberately no shadow: the shadow
 * belongs to whatever is the *visible* surface, so callers opt into
 * `shadow-raised` themselves.
 */
export const GLASS_PANEL =
  "rounded-lg border border-border/50 bg-glass-panel backdrop-blur-xl";

// -----------------------------------------------------------------------------
// Raised capsule — frosted track + lifted pill.
//
// The segmented capsule (SegmentedCapsule) and the clustered playback toolbars
// are the same material: not inverted black stamps or four lonely discs. Shared
// by talks (widget, theater, PiP, Live Activity), music (widget + Live Activity)
// and the wallpaper picker so every "one group of things at a time" control
// reads identically. On-dark variants live at the bottom of this file, for
// stages that cannot follow the site theme.
// -----------------------------------------------------------------------------

/** Theme-aware track (homepage widget + segmented capsule). */
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
 * Widget rest vs hover — inverted per theme, opacity so gradient cards show through.
 *
 * Light: a hairline frame at rest, ink deepens on hover.
 * Dark: no visible border at rest (fill only); hover brings a whisper of
 * edge + wash, never brighter than raised `GLASS_TRACK` (`white/08`).
 *
 * Touch gets the same deepening: `active:` / `group-active:` mirror every
 * hover rule, and `pressable` makes the deepen land on the touch-down frame
 * (a finger never hovers). Pressing any control inside the track, or the
 * card around it, is what deepens it — `:active` bubbles up from the button.
 */
export const GLASS_TRACK_FLAT = cn(
  "pressable border border-border/30 bg-foreground/[0.03]",
  "dark:border-transparent dark:bg-white/[0.02]",
  "backdrop-blur-xl",
  "transition-[background-color,border-color,box-shadow] duration-200",
  // A press on the surrounding card lands instantly too (`pressable` only
  // covers the track's own `:active`).
  "group-active:duration-0",
  "hover:border-border/50 hover:bg-foreground/[0.08]",
  "group-hover:border-border/50 group-hover:bg-foreground/[0.08]",
  "active:border-border/50 active:bg-foreground/[0.08]",
  "group-active:border-border/50 group-active:bg-foreground/[0.08]",
  "dark:hover:border-white/[0.06] dark:hover:bg-white/[0.05]",
  "dark:group-hover:border-white/[0.06] dark:group-hover:bg-white/[0.05]",
  "dark:active:border-white/[0.06] dark:active:bg-white/[0.05]",
  "dark:group-active:border-white/[0.06] dark:group-active:bg-white/[0.05]",
);

export const GLASS_CLUSTER_FLAT = cn(
  "inline-flex w-fit items-center gap-0.5 rounded-full p-0.5",
  GLASS_TRACK_FLAT,
);

/**
 * Selected pill: light lift in light mode; dark stamp in dark mode — the stamp
 * is solid glass because a dark chip has to hold its own against the track.
 * Same hover → active mirroring as GLASS_TRACK_FLAT.
 */
export const GLASS_PILL_FLAT = cn(
  "pressable bg-glass-panel ring-1 ring-border/30",
  "dark:bg-glass-solid dark:ring-transparent dark:shadow-none",
  "backdrop-blur-xl",
  "transition-[background-color,box-shadow,ring-color] duration-200",
  "group-active:duration-0",
  "hover:bg-card hover:shadow-sm hover:ring-border/50",
  "group-hover:bg-card group-hover:shadow-sm group-hover:ring-border/50",
  "active:bg-card active:shadow-sm active:ring-border/50",
  "group-active:bg-card group-active:shadow-sm group-active:ring-border/50",
  "dark:hover:bg-card dark:hover:ring-white/[0.06]",
  "dark:group-hover:bg-card dark:group-hover:ring-white/[0.06]",
  "dark:active:bg-card dark:active:ring-white/[0.06]",
  "dark:group-active:bg-card dark:group-active:ring-white/[0.06]",
);

// -----------------------------------------------------------------------------
// Controls inside the capsule.
// -----------------------------------------------------------------------------

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
 * the segmented capsule and WidgetTitle.
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
  // The orb floats over video with nothing behind it to help: solid is the
  // role for a control that has to stay legible over anything.
  "bg-glass-solid text-foreground shadow-sm ring-1 ring-border/40 backdrop-blur-xl",
);

// -----------------------------------------------------------------------------
// On-dark variants — for a stage that cannot follow the site theme (the theater
// video stage stays black) and for the editor mocks that reproduce it.
// -----------------------------------------------------------------------------

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
 * Always-dark segmented track — same language as dark-mode widget tabs
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
