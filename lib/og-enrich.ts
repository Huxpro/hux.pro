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

import type { LogData, Media, MediaPreview } from "@/lib/log";
import {
  mediaIsCardTarget,
  mediaIsVideoCoverTarget,
  type SnapshotEntry,
} from "@/lib/og-core";

export type OGSnapshot = Record<string, SnapshotEntry>;

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
): LogData {
  return {
    ...logData,
    commits: logData.commits.map((commit) => {
      if (!commit.media || commit.media.length === 0) return commit;
      return {
        ...commit,
        media: commit.media.map((m) => {
          const preview = resolvePreview(m, snapshot);
          if (preview) {
            // Cast: preview is only produced for link cards, but TS can't
            // narrow that from the predicate.
            return { ...m, preview } as Media;
          }
          const thumbnail = resolveVideoThumbnail(m, snapshot);
          if (thumbnail) {
            return { ...m, thumbnail } as Media;
          }
          return m;
        }),
      };
    }),
  };
}
