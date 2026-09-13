import { cn } from "@/lib/utils";

// =============================================================================
// Glass chrome — theme-aware control material shared across systems
//
// One frosted language for every playback / picker control that sits on a
// theme-aware surface: the Featured Talks AlbumTabs, the music widget and
// Live Activity transport, the PiP window bar. Track + lifted pill, clustered
// round buttons — not inverted black stamps or four lonely discs.
//
// Theater-only, always-dark variants live in `systems/theater/lib/chrome.ts`.
// =============================================================================

/** Frosted track (segmented control shell, clustered toolbar shell). */
export const GLASS_TRACK = cn(
  "border border-border/50 bg-foreground/[0.06] dark:bg-white/[0.08]",
  "backdrop-blur-xl",
);

/** Lifted pill: the selected segment, or the primary (play) control. */
export const GLASS_PILL = cn(
  "bg-card/90 shadow-sm ring-1 ring-border/50 backdrop-blur-xl",
);

/** Clustered round-button toolbar (transport, window controls). */
export const GLASS_CLUSTER = cn(
  "inline-flex items-center gap-0.5 rounded-full p-0.5",
  GLASS_TRACK,
);

/** Icon button inside a cluster (or standalone orb). */
export const GLASS_BTN = cn(
  "inline-flex items-center justify-center rounded-full",
  "text-muted-foreground transition-colors",
  "hover:bg-foreground/[0.06] hover:text-foreground active:scale-95",
  "disabled:opacity-30 disabled:pointer-events-none",
);

/** Text segment / action. Mono + tracking match AlbumTabs and WidgetTitle. */
export const GLASS_ACTION = cn(
  "inline-flex items-center justify-center gap-1.5 rounded-full",
  "text-xs font-mono uppercase tracking-wider",
  "text-muted-foreground transition-colors",
  "hover:text-foreground active:scale-[0.98]",
);
