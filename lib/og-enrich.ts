/**
 * Card snapshot enrichment — pure, framework-agnostic.
 *
 * Splits the snapshot pipeline into two halves so the same merging logic can
 * run in two places:
 *   - server-side at `/works` (snapshot loaded from disk by `lib/og-snapshot`)
 *   - client-side in the `/editor` preview (snapshot statically imported)
 *
 * This file is intentionally fs-free so it survives a client bundle.
 */

import type { Locale } from "@/lib/i18n";
import type {
  InternalLinkMeta,
  LocaleUrls,
  LogData,
  Media,
  MediaPreview,
} from "@/lib/log";
import {
  mediaIsCardTarget,
  mediaIsVideoCoverTarget,
  type SnapshotEntry,
} from "@/lib/og-core";

export type OGSnapshot = Record<string, SnapshotEntry>;

/** Slug → which language versions exist on disk. Mirrors `lib/mdx.ts`. */
export type BlogLangManifest = Record<string, "en" | "zh" | "both">;

const WRITING_URL_REGEX = /^\/writing\/([^/]+)\/(en|zh)\/?$/;

function resolveInternal(
  url: string,
  manifest: BlogLangManifest,
): InternalLinkMeta | undefined {
  const match = url.match(WRITING_URL_REGEX);
  if (!match) return undefined;
  const slug = match[1];
  const langs = manifest[slug];
  if (!langs) return undefined;
  const urls: LocaleUrls = {};
  if (langs === "en" || langs === "both") urls.en = `/writing/${slug}/en`;
  if (langs === "zh" || langs === "both") urls.zh = `/writing/${slug}/zh`;
  return { kind: "writing", slug, urls };
}

/**
 * Pick the URL of an internal post that matches the viewer's locale, falling
 * back to whichever version exists. Returns the badge to flash when only the
 * non-locale version is available — single source of truth for both the
 * expanded card and the folded-rail pill so they can't drift.
 */
export function pickInternalLink(
  internal: InternalLinkMeta,
  locale: Locale,
): { url: string | undefined; badge: "EN" | "中文" | null } {
  const same = internal.urls[locale];
  if (same) return { url: same, badge: null };
  const other: Locale = locale === "en" ? "zh" : "en";
  const fallback = internal.urls[other];
  if (fallback) return { url: fallback, badge: other === "en" ? "EN" : "中文" };
  return { url: undefined, badge: null };
}

/**
 * Merge preview sources by field priority (earlier args win). Returns
 * undefined when every field ends up empty so the runtime can fall
 * back to a live crawl instead of painting an empty card.
 */
function mergePreview(
  ...sources: (Partial<MediaPreview> | undefined)[]
): MediaPreview | undefined {
  const merged: MediaPreview = {
    title: sources.find((s) => s?.title)?.title,
    description: sources.find((s) => s?.description)?.description,
    image: sources.find((s) => s?.image)?.image,
  };
  if (!merged.title && !merged.description && !merged.image) return undefined;
  return merged;
}

/**
 * Resolve a card target's effective preview by layering, highest priority last:
 *   snapshot entry  →  manual `preview` (author override wins per-field)
 * Returns undefined when there's nothing to show (the runtime will then live-
 * fetch as a fallback — typically only a brand-new, not-yet-snapshotted link).
 */
function resolvePreview(
  media: Media,
  snapshot: OGSnapshot,
): MediaPreview | undefined {
  if (!mediaIsCardTarget(media)) return undefined;
  // Only link-cards reach here, and they carry `preview`; TS can't narrow the
  // union from the structural predicate, hence the cast.
  const manual = (media as { preview?: MediaPreview }).preview;
  return mergePreview(manual, snapshot[media.url]);
}

/**
 * Resolve a video cover target's effective thumbnail from the snapshot. The
 * manual `thumbnail` on the media item is always authoritative (we never
 * overwrite it). Returns undefined when there's nothing to fill in.
 */
function resolveVideoThumbnail(
  media: Media,
  snapshot: OGSnapshot,
): string | undefined {
  if (!mediaIsVideoCoverTarget(media)) return undefined;
  if ((media as { thumbnail?: string }).thumbnail) return undefined; // manual wins
  return snapshot[media.url]?.image;
}

/**
 * For a link-card with a `urls` locale map, resolve OG previews for
 * every locale URL from the snapshot and pack them into a per-locale
 * map. The client-side card renderer picks the entry matching the
 * viewer's locale, falling back to the top-level `preview` when the
 * per-locale entry is missing.
 *
 * Returns undefined for cards without a `urls` map, or when no per-
 * locale URL yielded a usable snapshot entry.
 */
function resolvePreviewsByLocale(
  media: Media,
  snapshot: OGSnapshot,
): Partial<Record<"en" | "zh", MediaPreview>> | undefined {
  if (!mediaIsCardTarget(media)) return undefined;
  const urls = (media as { urls?: Partial<Record<"en" | "zh", string>> }).urls;
  if (!urls) return undefined;
  const out: Partial<Record<"en" | "zh", MediaPreview>> = {};
  for (const locale of ["en", "zh"] as const) {
    const u = urls[locale];
    if (!u) continue;
    const entry = mergePreview(snapshot[u]);
    if (entry) out[locale] = entry;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Return a copy of `logData` with previews/covers populated from the snapshot
 * (+ manual overrides). Call this before handing data to a renderer so cards
 * and video players render their covers synchronously.
 */
export function enrichLogDataWithPreviews(
  logData: LogData,
  snapshot: OGSnapshot,
  blogManifest: BlogLangManifest = {},
): LogData {
  return {
    ...logData,
    commits: logData.commits.map((commit) => {
      if (!commit.media || commit.media.length === 0) return commit;
      return {
        ...commit,
        media: commit.media.map((m) => {
          let next: Media = m;
          const preview = resolvePreview(next, snapshot);
          if (preview) {
            // Cast: preview is only produced for link cards, but TS can't
            // narrow that from the predicate.
            next = { ...next, preview } as Media;
          }
          const previews = resolvePreviewsByLocale(next, snapshot);
          if (previews) {
            next = { ...next, previews } as Media;
          }
          const thumbnail = resolveVideoThumbnail(next, snapshot);
          if (thumbnail) {
            next = { ...next, thumbnail } as Media;
          }
          if (next.kind === "link") {
            const internal = resolveInternal(next.url, blogManifest);
            if (internal) {
              next = { ...next, internal } as Media;
            }
          }
          return next;
        }),
      };
    }),
  };
}
