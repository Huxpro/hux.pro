"use client";

import { ExternalImage } from "@/components/log/media/external-image";
import { COVER_WASH } from "@/lib/glass";
import { VIDEO_PLATFORM_LABEL } from "@/lib/log";
import { cn } from "@/lib/utils";
import type { Track } from "../lib/types";

// ---------------------------------------------------------------------------
// TrackThumb — a track's cover in a rail. Bilibili/Vimeo tracks often lack a
// public cover, so we fall back to a branded placeholder rather than an empty
// box, keeping the album rails visually consistent. No chip: the rail's title
// already says what the track is (media-mark.tsx).
//
// A hairline active edge (not a heavy ring) so selection is readable without
// stealing focus from the cover.
// ---------------------------------------------------------------------------

/** What the placeholder names, and the tint it takes — by platform, or by
 *  kind for a deck, which has no platform. */
type Source = NonNullable<Track["platform"]> | "slides";

function sourceOf(track: Track): Source {
  return track.kind === "slides" ? "slides" : track.platform;
}

const PLATFORM_LABEL: Record<Source, string> = {
  ...VIDEO_PLATFORM_LABEL,
  slides: "Slides",
};

const PLATFORM_TINT: Record<Source, string> = {
  youtube: "text-brand-youtube/40 bg-brand-youtube/5",
  bilibili: "text-brand-bilibili/50 bg-brand-bilibili/8",
  vimeo: "text-brand-vimeo/40 bg-brand-vimeo/5",
  slides: "text-muted-foreground bg-muted/30",
};

export function TrackThumb({
  track,
  active = false,
  className,
}: {
  track: Track;
  active?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-lg bg-muted/20 m3:rounded-2xl",
        "border transition-colors",
        // Hairline selection — readable for the playlist rail without the
        // old double ring fighting the cover art.
        active
          ? "border-foreground/35 dark:border-foreground/40"
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
          <span className="text-[10px] font-mono select-none">
            {PLATFORM_LABEL[sourceOf(track)]}
          </span>
        </div>
      )}
      {/* iOS cover press: dim the art, don't scale the card. */}
      <span className={COVER_WASH} />
    </div>
  );
}
