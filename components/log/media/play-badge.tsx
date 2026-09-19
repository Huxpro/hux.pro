import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Centered play affordance overlaid on a cover, marking it as playable —
 * real videos and talk-recording link cards (e.g. GitNation) alike. Absolute
 * inset-0, so the parent must be `relative`. `className` merges into the inner
 * circle (e.g. to add a hover scale).
 *
 * `tone="dark"` (default) — stamped black disc used on log / link covers.
 * `tone="glass"` — translucent white disc for theater / Featured Talks, so the
 * cover stays the focus and the control matches dock / widget glass chrome.
 *
 * `size="mini"` is for the /works contact strip, whose covers are ~56px tall:
 * at `compact` the disc would eat half the thumbnail, so the mark shrinks to
 * a 20px disc that still reads as "this one plays" at a glance.
 */
export type PlayBadgeSize = "mini" | "compact" | "default";
export type PlayBadgeTone = "dark" | "glass";

/** Disc and glyph per stop, as a table rather than a stack of ternaries:
 *  two axes and five sizes between them is one too many to read inline.
 *  Theater thumbs (`glass compact`) are a touch smaller than log covers,
 *  which is the only cell where the tone changes the measurements. */
const BADGE_SIZE: Record<
  PlayBadgeSize,
  { disc: string; icon: string; glass?: { disc?: string; icon?: string } }
> = {
  mini: { disc: "h-5 w-5", icon: "h-2.5 w-2.5" },
  compact: {
    disc: "h-9 w-9",
    icon: "h-4 w-4",
    glass: { disc: "h-8 w-8", icon: "h-3.5 w-3.5" },
  },
  default: { disc: "h-12 w-12", icon: "h-5 w-5" },
};

const BADGE_TONE: Record<PlayBadgeTone, string> = {
  dark: "bg-black/55 text-white ring-1 ring-white/25",
  glass: "bg-white/70 text-neutral-900 shadow-sm ring-1 ring-black/5",
};

export function PlayBadge({
  size = "default",
  tone = "dark",
  className,
}: {
  size?: PlayBadgeSize;
  tone?: PlayBadgeTone;
  className?: string;
}) {
  const stop = BADGE_SIZE[size];
  const glass = tone === "glass" ? stop.glass : undefined;
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span
        className={cn(
          "flex items-center justify-center rounded-full backdrop-blur-sm",
          BADGE_TONE[tone],
          glass?.disc ?? stop.disc,
          className,
        )}
      >
        <Play
          className={cn("translate-x-px", glass?.icon ?? stop.icon)}
          fill="currentColor"
        />
      </span>
    </span>
  );
}
