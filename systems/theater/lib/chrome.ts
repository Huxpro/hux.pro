import { cn } from "@/lib/utils";

// =============================================================================
// Theater glass chrome — the always-dark half of one material system
//
// The theme-aware tokens (track, pill, cluster, button) live in
// `components/ui/glass.ts` because music and the dock share them. Theater
// surfaces sit on an always-dark backdrop, so the on-dark tokens below force
// light glass there regardless of the site theme.
// =============================================================================

export {
  GLASS_ACTION,
  GLASS_BTN,
  GLASS_CLUSTER,
  GLASS_PILL,
  GLASS_TRACK,
} from "@/components/ui/glass";

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
