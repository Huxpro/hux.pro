"use client";

import {
  WidgetHeader,
  WidgetLink,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import { WidgetScrollRow } from "@/components/ui/widget-scroll-row";
import { t, useLocale } from "@/services";
import { AlbumTabs, TrackThumb, useTheater } from "@/systems/theater";
import { buildTalkAlbums } from "@/systems/theater/lib/albums";
import { useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// FeaturedTalksWidget — the combined "Featured Talks" home card.
//
// Replaces the three separate React / Lynx / Personal talk widgets with one
// album-switching card: pick an album (segmented control), scroll its videos
// horizontally, tap one to open the immersive theater / PiP player. The albums
// are the same curated groups used everywhere else, so content stays in sync.
// ---------------------------------------------------------------------------

export function FeaturedTalksWidget() {
  const { locale } = useLocale();
  const { open } = useTheater();
  const albums = useMemo(() => buildTalkAlbums(locale), [locale]);
  const [activeAlbum, setActiveAlbum] = useState(0);

  const album = albums[activeAlbum] ?? null;

  if (albums.length === 0 || !album) return null;

  return (
    <WidgetShell>
      <WidgetHeader className="pb-3">
        <WidgetTitle>{t(locale, "widgetFeaturedTalks")}</WidgetTitle>
        <WidgetLink href="/works" />
      </WidgetHeader>

      <div className="px-5 pb-3">
        <AlbumTabs
          albums={albums}
          activeIndex={activeAlbum}
          onSelect={setActiveAlbum}
        />
      </div>

      <WidgetScrollRow count={album.tracks.length} resetKey={activeAlbum}>
        {album.tracks.map((track, i) => (
          <button
            key={track.id}
            data-carousel-card
            onClick={() =>
              open({ albums, albumIndex: activeAlbum, trackIndex: i })
            }
            className="group/thumb w-[86%] max-w-[200px] shrink-0 snap-start text-left"
          >
            <TrackThumb track={track} />
            <div className="mt-2 truncate text-sm text-foreground">
              {track.title}
            </div>
            {track.subtitle && (
              <div className="mt-0.5 truncate text-xs font-mono uppercase tracking-wide text-muted-foreground">
                {track.subtitle}
              </div>
            )}
          </button>
        ))}
      </WidgetScrollRow>
    </WidgetShell>
  );
}
