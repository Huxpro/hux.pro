// =============================================================================
// Theater System — Album derivation
//
// Builds the home widget's three "albums" (React / Lynx / Personal) from the
// same log data the rest of the site renders. Each album is a curated group of
// talk/social commits; each track is that commit's first video plus display
// metadata. Groups are the single source of truth (see content/log.json), so
// re-ordering or re-tagging talks there updates the albums automatically.
// =============================================================================

import logData from "@/content/log.json";
import ogSnapshotJson from "@/content/og-snapshot.json";
import type { Locale } from "@/lib/i18n";
import {
  type Commit,
  type RawLogData,
  type VideoMedia,
  getCommitThumbnail,
  getMediaThumbnail,
  isVideoMedia,
  localize,
  normalizeLogData,
  resolveGroupCommits,
} from "@/lib/log";
import { enrichLogDataWithPreviews, type OGSnapshot } from "@/lib/og-enrich";
import type { SegmentedItem } from "@/components/ui/segmented-capsule";
import { resolveVideoId } from "./player";
import type { Album, Track } from "./types";

/** Group ids (from content/log.json) that back the three home albums. */
export const ALBUM_GROUP_IDS = [
  "featured-react-talks",
  "featured-lynx-talks",
  "featured-personal-talks",
] as const;

/**
 * Short, tab-friendly album names. The underlying group titles ("Featured
 * React talks", …) are too long for a segmented switcher, so each album gets a
 * concise label — the three albums the spec names: React / Lynx / Personal.
 */
const ALBUM_LABELS: Record<string, { en: string; zh: string }> = {
  "featured-react-talks": { en: "React", zh: "React" },
  "featured-lynx-talks": { en: "Lynx", zh: "Lynx" },
  "featured-personal-talks": { en: "Personal", zh: "个人" },
};

const log = enrichLogDataWithPreviews(
  normalizeLogData(logData as unknown as RawLogData),
  ogSnapshotJson as OGSnapshot,
);

function firstVideo(commit: Commit): VideoMedia | null {
  for (const m of commit.media ?? []) {
    if (isVideoMedia(m)) return m;
  }
  return null;
}

function commitSubtitle(commit: Commit): string | undefined {
  if (commit.type === "talk") return commit.conference.name;
  if (commit.type === "social") return commit.platform;
  return undefined;
}

function commitToTrack(commit: Commit, locale: Locale): Track | null {
  const video = firstVideo(commit);
  if (!video) return null;
  return {
    id: commit.id,
    platform: video.platform,
    url: video.url,
    videoId: resolveVideoId(video.url, video.platform),
    title: localize(commit.title, locale),
    subtitle: commitSubtitle(commit),
    thumbnail: getMediaThumbnail(video) ?? getCommitThumbnail(commit),
    href: "/works",
  };
}

/** Build the three home albums for the given locale, dropping empty ones. */
export function buildTalkAlbums(locale: Locale): Album[] {
  const groups = log.groups ?? [];
  const albums: Album[] = [];
  for (const groupId of ALBUM_GROUP_IDS) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) continue;
    const commits = resolveGroupCommits(
      group,
      log.commits as Commit[],
      undefined,
      locale,
    );
    const tracks = commits
      .map((c) => commitToTrack(c, locale))
      .filter((t): t is Track => t !== null);
    if (tracks.length === 0) continue;
    const label = ALBUM_LABELS[group.id];
    const title = label ? label[locale] : localize(group.title, locale);
    albums.push({ id: group.id, title, tracks });
  }
  return albums;
}

/** Build a one-off album for a video that isn't part of the curated set. */
export function adHocAlbum(track: Track, title: string): Album {
  return { id: `adhoc-${track.id}`, title, tracks: [track] };
}

/**
 * Albums as SegmentedCapsule options. The capsule speaks `{ id, label }` — any
 * named group can be a tab — so the one place that knows an album's tab name is
 * its `title` is here.
 */
export function albumSegments(
  albums: Pick<Album, "id" | "title">[],
): SegmentedItem[] {
  return albums.map((album) => ({ id: album.id, label: album.title }));
}
