"use client";

import { ExternalImage } from "@/components/log/media/external-image";
import { ARTWORK_CHIP_REST, COVER_WASH } from "@/lib/glass";
import { VIDEO_PLATFORM_LABEL } from "@/lib/log";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import type { Track, TrackLanguage } from "../lib/types";

// ---------------------------------------------------------------------------
// TrackThumb — a track's cover in a rail. Bilibili/Vimeo tracks often lack a
// public cover, so we fall back to a branded placeholder rather than an empty
// box, keeping the album rails visually consistent. No chip: the rail's title
// already says what the track is (media-mark.tsx).
//
// The one chip it does wear is language, and only when language is news:
// every version when there are several ("EN · 中文" — this one can be heard
// either way), or the one it has when that is not the viewer's.
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
  youtube: "text-red-500/40 bg-red-500/5",
  bilibili: "text-[#00a1d6]/50 bg-[#00a1d6]/8",
  vimeo: "text-sky-500/40 bg-sky-500/5",
  slides: "text-muted-foreground bg-muted/30",
};

const LANGUAGE_LABEL: Record<TrackLanguage, string> = {
  en: "EN",
  zh: "中文",
};

/** The languages worth saying on the cover, or null. */
export function trackLanguageChip(
  track: Track,
  locale: TrackLanguage,
): string | null {
  const langs = Array.from(
    new Set(
      (track.versions ?? [])
        .map((v) => v.language)
        .filter((l): l is TrackLanguage => !!l),
    ),
  );
  if (langs.length > 1) return langs.map((l) => LANGUAGE_LABEL[l]).join(" · ");
  const only = langs[0] ?? track.language;
  return only && only !== locale ? LANGUAGE_LABEL[only] : null;
}

export function TrackThumb({
  track,
  active = false,
  className,
}: {
  track: Track;
  active?: boolean;
  className?: string;
}) {
  const { locale } = useLocale();
  const chip = trackLanguageChip(track, locale);
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
          <span className="text-[10px] font-mono select-none">
            {PLATFORM_LABEL[sourceOf(track)]}
          </span>
        </div>
      )}
      {chip && (
        <span
          className={cn(
            "absolute bottom-1.5 right-1.5 rounded px-1 py-px font-mono text-[9px] leading-tight backdrop-blur-sm",
            ARTWORK_CHIP_REST,
          )}
        >
          {chip}
        </span>
      )}
      {/* iOS cover press: dim the art, don't scale the card. */}
      <span className={COVER_WASH} />
    </div>
  );
}
