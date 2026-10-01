// =============================================================================
// Theater System — shelves
//
// The library (./library.ts) is every recording and deck on the site; this
// file decides how it is shelved into the theater's tabs. Shelving reads only
// what the media is — never the type of the commit that lists it — so every
// entry sits on exactly one shelf and nothing is left off.
//
// Shelves: Recordings / Slides. The one division that is the media's own,
// and the one the stage itself draws differently: a recording has a transport
// and plays audio, a deck has neither.
// =============================================================================

import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import {
  type Media,
  getMediaThumbnail,
  isSlidesMedia,
  isVideoMedia,
} from "@/lib/log";
import { resolveSlidesEmbedUrl } from "@/lib/slides";
import { buildLibraryTracks } from "./library";
import { resolveVideoId } from "./player";
import type { Album, Track } from "./types";

/** The library, shelved for the theater's tabs. Empty shelves are dropped. */
export function buildLibraryAlbums(locale: Locale): Album[] {
  const tracks = buildLibraryTracks(locale);
  const shelves: Album[] = [
    {
      id: "recordings",
      title: t(locale, "theaterRecordings"),
      tracks: tracks.filter((tk) => tk.kind === "video"),
    },
    {
      id: "slides",
      title: t(locale, "logSlides"),
      tracks: tracks.filter((tk) => tk.kind === "slides"),
    },
  ];
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
