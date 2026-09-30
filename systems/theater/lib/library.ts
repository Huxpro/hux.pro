// =============================================================================
// Theater System — the library
//
// The theater is the site's one place for everything of mine that plays: every
// recording and every deck, wherever on the site it is listed. It is built from
// the media, not from the commits that carry them. A commit is where a piece of
// media is listed, which it links back to, and nothing more; its type (talk,
// press) never decides where the media sits in the library.
//
// Three facts belong to the media itself and are all the library reads:
//
//  - its identity: a YouTube id, a BV number, a deck's address. The same media
//    listed in two places is one entry, and anything that opens it (a /works
//    cover, a prompt's deck, a URL) lands on that entry.
//  - its kind: a recording or a deck.
//  - its language, and whether it is the same piece as another media told in
//    another language (`translationOf`). A pair is one entry with two
//    versions, and the viewer's locale picks which one plays first.
//
// Curation lives beside the library, not in the log: content/theater.json
// lists the featured media by URL, in order. It decides what the home card
// leads with; it never decides what is in the library.
// =============================================================================

import theaterJson from "@/content/theater.json";
import { LOG as log } from "@/lib/log-client";
import type { Locale } from "@/lib/i18n";
import {
  type Commit,
  type SlidesMedia,
  type VideoMedia,
  type VideoPlatform,
  computeCommitHash,
  getCommitThumbnail,
  getMediaThumbnail,
  isCommitVisibleIn,
  isSlidesMedia,
  isVideoMedia,
  localize,
} from "@/lib/log";
import { resolveSlidesEmbedUrl } from "@/lib/slides";
import { resolveVideoId } from "./player";
import type { Track, TrackLanguage, TrackVersion } from "./types";

type PlayableMedia = VideoMedia | SlidesMedia;

// -----------------------------------------------------------------------------
// Identity
// -----------------------------------------------------------------------------

/** The video platform a bare URL belongs to, or null for anything else. */
function platformOfUrl(url: string): VideoPlatform | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "youtu.be" || host.endsWith("youtube.com")) return "youtube";
    if (host.endsWith("bilibili.com") || host === "b23.tv") return "bilibili";
    if (host.endsWith("vimeo.com")) return "vimeo";
  } catch {
    /* not a URL */
  }
  return null;
}

/**
 * One key per piece of media, however its URL is spelled: `youtu.be/x` and
 * `youtube.com/watch?v=x` are the same recording, a legacy deck address and
 * its live one the same deck.
 */
export function mediaKey(url: string, platform?: VideoPlatform): string {
  const p = platform ?? platformOfUrl(url);
  if (p) {
    const id = resolveVideoId(url, p);
    if (id) return `${p}:${id}`;
  }
  const resolved = resolveSlidesEmbedUrl(url);
  try {
    const u = new URL(resolved);
    return `${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return resolved;
  }
}

function keyOfMedia(media: PlayableMedia): string {
  return mediaKey(media.url, isVideoMedia(media) ? media.platform : undefined);
}

// -----------------------------------------------------------------------------
// Collection
// -----------------------------------------------------------------------------

interface Listing {
  media: PlayableMedia;
  commit: Commit;
  key: string;
}

/** A piece of media in the library: one or more versions of the same thing. */
export interface LibraryEntry {
  /** The key of its first version — stable across locales. */
  id: string;
  kind: "video" | "slides";
  /** The original first, then its translations. */
  versions: Listing[];
  /** When the original was given — the library's order. */
  date: string;
}

function languageOf(listing: Listing): TrackLanguage | undefined {
  if (listing.media.language) return listing.media.language;
  const lang = listing.commit.language;
  return lang === "en" || lang === "zh" ? lang : undefined;
}

/**
 * Every recording and deck the log lists, as library entries, newest first.
 * Visibility follows the log's own (`listed`, `listedIn`): the library holds
 * what the site shows, in the locale it shows it in.
 */
export function buildLibrary(locale: Locale): LibraryEntry[] {
  const byKey = new Map<string, LibraryEntry>();
  const entries: LibraryEntry[] = [];
  const translations: { listing: Listing; of: string }[] = [];

  const commits = [...(log.commits as Commit[])].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  for (const commit of commits) {
    if (!isCommitVisibleIn(commit, locale)) continue;
    for (const media of commit.media ?? []) {
      if (!isVideoMedia(media) && !isSlidesMedia(media)) continue;
      const key = keyOfMedia(media);
      if (byKey.has(key)) continue; // listed twice — one entry
      const listing: Listing = { media, commit, key };
      if (media.translationOf) {
        translations.push({ listing, of: mediaKey(media.translationOf) });
        continue;
      }
      const entry: LibraryEntry = {
        id: key,
        kind: media.kind,
        versions: [listing],
        date: commit.date,
      };
      byKey.set(key, entry);
      entries.push(entry);
    }
  }

  // A translation joins its original; one whose original is not listed (or
  // not in this locale) stands on its own rather than disappearing.
  for (const { listing, of } of translations) {
    const original = byKey.get(of);
    if (original) {
      original.versions.push(listing);
      byKey.set(listing.key, original);
      continue;
    }
    const entry: LibraryEntry = {
      id: listing.key,
      kind: listing.media.kind,
      versions: [listing],
      date: listing.commit.date,
    };
    byKey.set(listing.key, entry);
    entries.push(entry);
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

// -----------------------------------------------------------------------------
// Tracks
// -----------------------------------------------------------------------------

function subtitleOf(commit: Commit): string | undefined {
  if (commit.type === "talk") return commit.conference.name;
  if (commit.type === "press") return commit.platform;
  return undefined;
}

function toVersion(listing: Listing, locale: Locale): TrackVersion {
  const { media, commit } = listing;
  const base = {
    key: listing.key,
    language: languageOf(listing),
    title: localize(commit.title, locale),
    subtitle: subtitleOf(commit),
    date: commit.date,
    // Where it is listed: the commit's permalink on /works.
    href: `/works#${computeCommitHash(commit.id)}`,
  };
  if (isVideoMedia(media)) {
    return {
      ...base,
      kind: "video",
      platform: media.platform,
      url: media.url,
      videoId: resolveVideoId(media.url, media.platform),
      thumbnail: getMediaThumbnail(media) ?? getCommitThumbnail(commit),
    };
  }
  return {
    ...base,
    kind: "slides",
    // The deck's playable address, not the page that wraps it.
    url: resolveSlidesEmbedUrl(media.url),
    thumbnail: getMediaThumbnail(media),
  };
}

/** A track wearing one of its versions. */
export function withVersion(track: Track, version: TrackVersion): Track {
  const { key: _key, language, date, ...playable } = version;
  void _key;
  return { ...track, ...playable, language, date } as Track;
}

/**
 * The entry as a track, wearing the version in the viewer's language when it
 * has one, the original otherwise. Every version rides along so the stage can
 * switch without going back to the library.
 */
export function entryToTrack(entry: LibraryEntry, locale: Locale): Track {
  const versions = entry.versions.map((v) => toVersion(v, locale));
  const preferred = versions.find((v) => v.language === locale) ?? versions[0];
  const base = { id: entry.id, versions } as unknown as Track;
  return withVersion(base, preferred);
}

/** The whole library as tracks, newest first. */
export function buildLibraryTracks(locale: Locale): Track[] {
  return buildLibrary(locale).map((e) => entryToTrack(e, locale));
}

/** The version of `track` that is this media, if it is one of them. */
export function versionOf(track: Track, key: string): TrackVersion | null {
  return track.versions?.find((v) => v.key === key) ?? null;
}

/** Whether the track holds a version in `language`. */
export function speaks(track: Track, language: Locale): boolean {
  return (track.versions ?? []).some((v) => v.language === language);
}

// -----------------------------------------------------------------------------
// Curation
// -----------------------------------------------------------------------------

/**
 * The featured keys, worked out on first use rather than at import: the id
 * extractors live in client modules, and this file is reachable from the
 * server's module graph.
 */
let featuredKeys: string[] | null = null;
function getFeaturedKeys(): string[] {
  featuredKeys ??= (
    (theaterJson as { featured?: string[] }).featured ?? []
  ).map((url) => mediaKey(url));
  return featuredKeys;
}

/**
 * The featured tracks, in the order content/theater.json lists them, with
 * the ones the viewer can hear in their own language first — a stable split,
 * so the author's order holds within each half. A featured URL may name
 * either version of a pair; the pair is featured once.
 */
export function featuredTracks(tracks: Track[], locale: Locale): Track[] {
  const out: Track[] = [];
  for (const key of getFeaturedKeys()) {
    const track = tracks.find((t) => versionOf(t, key));
    if (track && !out.includes(track)) out.push(track);
  }
  return [
    ...out.filter((t) => speaks(t, locale)),
    ...out.filter((t) => !speaks(t, locale)),
  ];
}
