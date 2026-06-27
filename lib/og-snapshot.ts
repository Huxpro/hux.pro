import fs from "fs";
import path from "path";
import type { LogData, Media, MediaPreview } from "@/lib/log";
import { mediaIsOGPreviewTarget } from "@/lib/og-core";

/**
 * Build-time OG snapshot.
 *
 * A committed JSON cache of crawled link-preview metadata, keyed by URL. Cards
 * render from this (or a manual `preview`) instead of crawling at request time,
 * so production has no runtime dependency on third-party sites being up or
 * crawlable. Regenerate with `pnpm og:snapshot`; CI guards drift with
 * `pnpm og:check`. The file is intentionally timestamp-free and key-sorted so
 * it only changes when the *content* changes (no flaky churn).
 */

export interface SnapshotEntry {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

export type OGSnapshot = Record<string, SnapshotEntry>;

const SNAPSHOT_PATH = path.join(process.cwd(), "content", "og-snapshot.json");

/** Load the committed snapshot. Returns {} when absent or unreadable. */
export function loadOGSnapshot(): OGSnapshot {
  try {
    if (!fs.existsSync(SNAPSHOT_PATH)) return {};
    return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8")) as OGSnapshot;
  } catch {
    return {};
  }
}

/**
 * Resolve a media item's effective preview by layering, highest priority last:
 *   snapshot entry  →  manual `preview` (author override wins per-field)
 * Returns undefined when there's nothing to show (the runtime will then live-
 * fetch as a fallback — typically only a brand-new, not-yet-snapshotted link).
 */
function resolvePreview(
  media: Media,
  snapshot: OGSnapshot,
): MediaPreview | undefined {
  if (!mediaIsOGPreviewTarget(media)) return undefined;

  const snap = snapshot[media.url];
  // Only embed media reach here (mediaIsOGPreviewTarget), and embeds carry
  // `preview`; TS can't narrow the union from the predicate, hence the cast.
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
 * Return a copy of `logData` with each preview-bearing media item's `preview`
 * populated from the snapshot (+ manual overrides). Call this server-side
 * before handing data to the client so cards render synchronously.
 */
export function enrichLogDataWithPreviews(
  logData: LogData,
  snapshot: OGSnapshot = loadOGSnapshot(),
): LogData {
  return {
    ...logData,
    commits: logData.commits.map((commit) => {
      if (!commit.media || commit.media.length === 0) return commit;
      return {
        ...commit,
        media: commit.media.map((m) => {
          const preview = resolvePreview(m, snapshot);
          // Cast: preview is only produced for link/embed media (which carry
          // `preview`), but TS can't narrow that from the predicate.
          return preview ? ({ ...m, preview } as Media) : m;
        }),
      };
    }),
  };
}
