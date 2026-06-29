import fs from "fs";
import path from "path";
import type { LogData } from "@/lib/log";
import { type SnapshotEntry } from "@/lib/og-core";
import {
  enrichLogDataWithPreviews as enrichPure,
  type OGSnapshot,
} from "@/lib/og-enrich";

export type { SnapshotEntry, OGSnapshot };

/**
 * Build-time card snapshot — Node-only loader.
 *
 * A committed JSON cache of crawled OG metadata, keyed by URL. Link cards
 * (media with `kind:"link", present:"card"`) render from this (or a manual
 * `preview`) instead of crawling at request time, so production has no
 * runtime dependency on third-party sites being up or crawlable. Regenerate
 * with `pnpm og:snapshot`; CI guards drift with `pnpm og:check`. The file is
 * intentionally timestamp-free and key-sorted so it only changes when the
 * *content* changes (no flaky churn).
 *
 * This file owns the fs-based loader. The pure merging logic lives in
 * `lib/og-enrich.ts` so the same code can run client-side in the editor
 * preview without dragging Node imports into the browser bundle.
 */

const SNAPSHOT_PATH = path.join(process.cwd(), "content", "og-snapshot.json");

/** Load the committed snapshot. Returns {} when absent or unreadable. */
export function loadOGSnapshot(): OGSnapshot {
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8")) as OGSnapshot;
  } catch {
    return {};
  }
}

/**
 * Server-side enrichment — convenience wrapper that loads the snapshot from
 * disk by default. Client-side callers should import the pure enrichment
 * from `@/lib/og-enrich` and supply the snapshot themselves.
 */
export function enrichLogDataWithPreviews(
  logData: LogData,
  snapshot: OGSnapshot = loadOGSnapshot(),
): LogData {
  return enrichPure(logData, snapshot);
}
