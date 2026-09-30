// =============================================================================
// Theater System — shelves
//
// The library (./library.ts) is every recording and deck on the site; this
// file decides how it is shelved into the theater's tabs. Shelving reads only
// what the media is — never the type of the commit that lists it — so every
// entry sits on exactly one shelf and nothing is left off.
//
// Shelves: one per language, the viewer's first — 中文 / EN. Language is the
// one thing about a recording a viewer cannot work around, and the split is
// the media's own. A piece given in both languages is on both shelves, each
// wearing that shelf's telling — never twice on one shelf — and switching
// shelves with it on the stage is how it switches language. Decks sit with
// the language they are written in.
// =============================================================================

import type { Locale } from "@/lib/i18n";
import {
  type Media,
  getMediaThumbnail,
  isSlidesMedia,
  isVideoMedia,
} from "@/lib/log";
import { resolveSlidesEmbedUrl } from "@/lib/slides";
import { buildLibrary, entryLanguages, entryToTrack } from "./library";
import { resolveVideoId } from "./player";
import type { Album, Track, TrackLanguage } from "./types";

const LANGUAGE_TITLE: Record<TrackLanguage, string> = { en: "EN", zh: "中文" };

/** The library, shelved for the theater's tabs. Empty shelves are dropped. */
export function buildLibraryAlbums(locale: Locale): Album[] {
  const entries = buildLibrary(locale);
  const order: TrackLanguage[] = locale === "zh" ? ["zh", "en"] : ["en", "zh"];
  const shelves: Album[] = order.map((lang) => ({
    id: `lang-${lang}`,
    title: LANGUAGE_TITLE[lang],
    tracks: entries
      .filter((e) => {
        const langs = entryLanguages(e);
        // A piece in no known language shelves with the viewer's.
        return langs.includes(lang) || (lang === locale && langs.length === 0);
      })
      .map((e) => entryToTrack(e, locale, lang)),
  }));
  return shelves.filter((s) => s.tracks.length > 0);
}

/** Build a one-off album for media the library does not hold. */
export function adHocAlbum(track: Track, title: string): Album {
  return { id: `adhoc-${track.id}`, title, tracks: [track] };
}

/**
 * One track for one piece of media, or null for media the stage cannot hold
 * (a link card, an image, a social widget). `id` must be unique within the
 * album — the caller derives it from where the media is and its position.
 */
export function mediaToTrack(
  media: Media,
  meta: { id: string; title: string; subtitle?: string; href?: string },
): Track | null {
  if (isVideoMedia(media)) {
    return {
      ...meta,
      kind: "video",
      platform: media.platform,
      url: media.url,
      videoId: resolveVideoId(media.url, media.platform),
      thumbnail: getMediaThumbnail(media),
    };
  }
  if (isSlidesMedia(media)) {
    return {
      ...meta,
      kind: "slides",
      // The deck's playable address, not the page that wraps it — legacy
      // huangxuan.me links and Wayback snapshots resolve to the live deck.
      url: resolveSlidesEmbedUrl(media.url),
      title: media.title || meta.title,
      thumbnail: getMediaThumbnail(media),
    };
  }
  return null;
}
