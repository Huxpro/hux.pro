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
 */
export function PlayBadge({
  size = "default",
  tone = "dark",
  className,
}: {
  size?: "compact" | "default";
  tone?: "dark" | "glass";
  className?: string;
}) {
  const compact = size === "compact";
  const glass = tone === "glass";
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span
        className={cn(
          "flex items-center justify-center rounded-full backdrop-blur-sm",
          glass
            ? "bg-white/70 text-neutral-900 shadow-sm ring-1 ring-black/5"
            : "bg-black/55 text-white ring-1 ring-white/25",
          compact ? "h-9 w-9" : "h-12 w-12",
          // Theater thumbs are a touch smaller than log covers.
          glass && compact && "h-8 w-8",
          className,
        )}
      >
        <Play
          className={cn(
            "translate-x-px",
            compact ? (glass ? "h-3.5 w-3.5" : "h-4 w-4") : "h-5 w-5",
          )}
          fill="currentColor"
        />
      </span>
    </span>
  );
}
