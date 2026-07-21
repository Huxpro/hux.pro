"use client";

import { ExternalImage } from "@/components/log/media/external-image";
import { PlayBadge } from "@/components/log/media/play-badge";
import { cn } from "@/lib/utils";
import type { Track } from "../lib/types";

// ---------------------------------------------------------------------------
// TrackThumb — a video cover with a play affordance. Bilibili/Vimeo tracks
// often lack a public cover, so we fall back to a branded placeholder rather
// than an empty box, keeping the album rails visually consistent.
// ---------------------------------------------------------------------------

const PLATFORM_LABEL: Record<Track["platform"], string> = {
  youtube: "YouTube",
  bilibili: "bilibili",
  vimeo: "Vimeo",
};

const PLATFORM_TINT: Record<Track["platform"], string> = {
  youtube: "text-red-500/40 bg-red-500/5",
  bilibili: "text-[#00a1d6]/50 bg-[#00a1d6]/8",
  vimeo: "text-sky-500/40 bg-sky-500/5",
};

export function TrackThumb({
  track,
  active = false,
  showBadge = true,
  className,
}: {
  track: Track;
  active?: boolean;
  showBadge?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-lg bg-muted/20",
        "border transition-colors",
        active ? "border-foreground/70 ring-1 ring-foreground/40" : "border-border/50",
        className,
      )}
    >
      {track.thumbnail ? (
        <ExternalImage
          src={track.thumbnail}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-1",
            PLATFORM_TINT[track.platform],
          )}
        >
          <span className="text-[10px] font-mono uppercase tracking-widest select-none">
            {PLATFORM_LABEL[track.platform]}
          </span>
        </div>
      )}
      {showBadge && (
        <div className="absolute inset-0 bg-black/10 transition-colors group-hover/thumb:bg-black/25">
          <PlayBadge size="compact" />
        </div>
      )}
    </div>
  );
}
