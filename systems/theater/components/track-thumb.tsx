"use client";

import { ExternalImage } from "@/components/log/media/external-image";
import {
  MediaMark,
  PLATFORM_LABEL as VIDEO_LABEL,
  SLIDES_MARK,
  videoMark,
} from "@/components/log/media/media-mark";
import { cn } from "@/lib/utils";
import type { Track } from "../lib/types";

// ---------------------------------------------------------------------------
// TrackThumb — a video cover with a play affordance. Bilibili/Vimeo tracks
// often lack a public cover, so we fall back to a branded placeholder rather
// than an empty box, keeping the album rails visually consistent.
//
// Glass capsule chrome: translucent white play (not a black stamp), hairline
// active edge (not a heavy ring) so selection is readable without stealing
// focus from the cover.
// ---------------------------------------------------------------------------

/** What the placeholder names, and the tint it takes — by platform, or by
 *  kind for a deck, which has no platform. */
type Source = NonNullable<Track["platform"]> | "slides";

function sourceOf(track: Track): Source {
  return track.kind === "slides" ? "slides" : track.platform;
}

const PLATFORM_LABEL: Record<Source, string> = {
  ...VIDEO_LABEL,
  slides: "Slides",
};

const PLATFORM_TINT: Record<Source, string> = {
  youtube: "text-red-500/40 bg-red-500/5",
  bilibili: "text-[#00a1d6]/50 bg-[#00a1d6]/8",
  vimeo: "text-sky-500/40 bg-sky-500/5",
  slides: "text-muted-foreground bg-muted/30",
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
        // Hairline selection — readable for the playlist rail without the
        // old double ring fighting the cover art.
        active
          ? "border-foreground/35 dark:border-white/40"
          : "border-border/40",
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
            PLATFORM_TINT[sourceOf(track)],
          )}
        >
          <span className="text-[10px] font-mono uppercase tracking-widest select-none">
            {PLATFORM_LABEL[sourceOf(track)]}
          </span>
        </div>
      )}
      {/* The chip every cover on the site wears (media-mark.tsx): the
          platform on a recording, `Slides` on a deck, so a deck reads as a
          deck beside the videos in a rail. */}
      {showBadge && (
        <MediaMark
          mark={track.kind === "slides" ? SLIDES_MARK : videoMark(track.platform)}
          size="compact"
        />
      )}
    </div>
  );
}
