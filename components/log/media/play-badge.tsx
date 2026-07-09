import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Centered play affordance overlaid on a cover, marking it as playable —
 * real videos and talk-recording link cards (e.g. GitNation) alike. Absolute
 * inset-0, so the parent must be `relative`. `className` merges into the inner
 * circle (e.g. to add a hover scale).
 */
export function PlayBadge({
  size = "default",
  className,
}: {
  size?: "compact" | "default";
  className?: string;
}) {
  const compact = size === "compact";
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm ring-1 ring-white/25",
          compact ? "h-9 w-9" : "h-12 w-12",
          className,
        )}
      >
        <Play
          className={cn("translate-x-px", compact ? "h-4 w-4" : "h-5 w-5")}
          fill="currentColor"
        />
      </span>
    </span>
  );
}
