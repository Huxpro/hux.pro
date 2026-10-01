"use client";

import { t, useLocale } from "@/services";
import { useTheater } from "../provider";
import type { TrackLanguage } from "../lib/types";
import { AlbumTabs } from "./album-tabs";

// ---------------------------------------------------------------------------
// LanguageSwitch — EN · 中文, for a track that was given in both.
//
// The two versions are two recordings, not one with subtitles, so switching
// starts the other one from the top. The choice is the session's, not the
// track's (`useTheater().language`): the next track with an English version
// plays in English too. Renders nothing for a track with one version.
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
  const { track, selectLanguage } = useTheater();
  const langs = Array.from(
    new Set(
      (track?.versions ?? [])
        .map((v) => v.language)
        .filter((l): l is TrackLanguage => !!l),
    ),
  );
  if (!track || langs.length < 2) return null;

  return (
    <div aria-label={t(locale, "theaterLanguage")} className={className}>
      <AlbumTabs
        albums={langs.map((l) => ({ id: l, title: LABEL[l] }))}
        activeIndex={Math.max(0, langs.indexOf(track.language ?? langs[0]))}
        onSelect={(i) => selectLanguage(langs[i])}
        raised={raised}
      />
    </div>
  );
}
