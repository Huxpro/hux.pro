"use client";

import { t, useLocale } from "@/services";
import { useTheater } from "../provider";
import type { TrackLanguage } from "../lib/types";
import { AlbumTabs } from "./album-tabs";

// ---------------------------------------------------------------------------
// LanguageSwitch — EN · 中文, for a track that was given in both.
//
// The library is shelved by language, so the two tellings of a talk each
// live on their own shelf; switching language is switching shelves with the
// piece still on the stage (`selectAlbum` keeps it). The two versions are two
// recordings, not one with subtitles, so the other one starts from the top.
// Renders nothing for a track with one version.
// ---------------------------------------------------------------------------

const LABEL: Record<TrackLanguage, string> = { en: "EN", zh: "中文" };

export function LanguageSwitch({
  className,
  raised,
}: {
  className?: string;
  raised?: boolean;
}) {
  const { locale } = useLocale();
  const { track, albums, albumIndex, selectAlbum } = useTheater();
  const langs = Array.from(
    new Set(
      (track?.versions ?? [])
        .map((v) => v.language)
        .filter((l): l is TrackLanguage => !!l),
    ),
  );
  const shelfOf = (l: TrackLanguage) =>
    albums.findIndex((a) => a.id === `lang-${l}`);
  if (!track || langs.length < 2 || langs.some((l) => shelfOf(l) < 0)) {
    return null;
  }
  const active = langs.findIndex((l) => shelfOf(l) === albumIndex);

  return (
    <div aria-label={t(locale, "theaterLanguage")} className={className}>
      <AlbumTabs
        albums={langs.map((l) => ({ id: l, title: LABEL[l] }))}
        activeIndex={Math.max(0, active)}
        onSelect={(i) => selectAlbum(shelfOf(langs[i]))}
        raised={raised}
      />
    </div>
  );
}
