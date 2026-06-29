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

  const snap = snapshot[media.url];
  // Only link-cards reach here, and they carry `preview`; TS can't narrow the
  // union from the structural predicate, hence the cast.
  const manual = (media as { preview?: MediaPreview }).preview;
  if (!snap && !manual) return undefined;

  const merged = {
    title: manual?.title ?? snap?.title,
    description: manual?.description ?? snap?.description,
    image: manual?.image ?? snap?.image,
  };
  // Drop entirely-empty results so the runtime knows to fall back.
  if (!merged.title && !merged.description && !merged.image) return undefined;
  return merged;
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
