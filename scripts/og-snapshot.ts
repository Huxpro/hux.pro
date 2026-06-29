/**
 * Build-time card snapshot generator.
 *
 *   node scripts/og-snapshot.ts          # crawl + write content/og-snapshot.json
 *   node scripts/og-snapshot.ts --check  # CI: re-crawl, diff, exit 1 on drift
 *
 * Reuses the exact crawl/parse core the runtime Server Action uses
 * (lib/og-core.ts), so the snapshot equals what the server would fetch.
 *
 * Targets: every `kind:"link", present:"card"` media item in log.json. Pills,
 * social embeds, videos, and images do not pass through this pipeline.
 *
 * Design goals (per request):
 *  - Same data as the live server crawl.
 *  - On crawl failure: never overwrite good data; if there's no prior entry
 *    and no manual `preview`, FAIL loudly so the card gets a manual preview
 *    (the recovery path for crawl-blocked sites like Medium).
 *  - Deterministic, timestamp-free output → no flaky churn.
 *  - Report exactly what changed.
 */

import fs from "fs";
import path from "path";
import {
  fetchOG,
  fetchVideoCover,
  mediaIsCardTarget,
  mediaIsVideoCoverTarget,
  mediaNeedsCoverCrawl,
  mediaNeedsLiveCrawl,
  type PreviewableMedia,
  type SnapshotEntry,
} from "../lib/og-core.ts";

type Snapshot = Record<string, SnapshotEntry>;

/** Stable field order for the serialized artifact. */
const FIELDS = ["title", "description", "image", "siteName"] as const;

const ROOT = process.cwd();
const LOG_PATH = path.join(ROOT, "content", "log.json");
const SNAPSHOT_PATH = path.join(ROOT, "content", "og-snapshot.json");

const CHECK = process.argv.includes("--check");

// --- Collect every URL that renders as a card or needs a video cover --------

type TargetKind = "card" | "video-cover";

interface Target {
  url: string;
  kind: TargetKind;
  needsCrawl: boolean; // false when a manual override covers it
  /** Snapshot of the media item itself — used by the video-cover fetcher
   *  to pick the right per-platform API. Carries no runtime state beyond
   *  what `og-core` reads. */
  media: PreviewableMedia;
}

function collectTargets(): Target[] {
  const log = JSON.parse(fs.readFileSync(LOG_PATH, "utf8"));
  const byUrl = new Map<string, Target>();
  const upsert = (t: Target) => {
    const existing = byUrl.get(t.url);
    if (!existing) byUrl.set(t.url, t);
    else existing.needsCrawl = existing.needsCrawl || t.needsCrawl;
  };
  for (const commit of log.commits ?? []) {
    for (const media of (commit.media ?? []) as PreviewableMedia[]) {
      if (mediaIsCardTarget(media)) {
        upsert({
          url: media.url,
          kind: "card",
          needsCrawl: mediaNeedsLiveCrawl(media),
          media,
        });
      } else if (mediaIsVideoCoverTarget(media)) {
        upsert({
          url: media.url,
          kind: "video-cover",
          needsCrawl: mediaNeedsCoverCrawl(media),
          media,
        });
      }
    }
  }
  return [...byUrl.values()];
}

// --- Serialization (deterministic) -------------------------------------------

/** Keep only truthy known fields, in a fixed order. */
function pickEntry(d: Partial<SnapshotEntry>): SnapshotEntry {
  const e: SnapshotEntry = {};
  for (const f of FIELDS) if (d[f]) e[f] = d[f];
  return e;
}

/** Sorted keys + per-entry field order → byte-stable, no-churn output. */
function serialize(snap: Snapshot): string {
  const ordered: Snapshot = {};
  for (const k of Object.keys(snap).sort()) ordered[k] = pickEntry(snap[k]);
  return JSON.stringify(ordered, null, 2) + "\n";
}

function entryUsable(e: SnapshotEntry): boolean {
  return !!(e.title || e.image);
}

// --- Main --------------------------------------------------------------------

/** Crawl a single target; cards use OG, video covers use the platform API. */
async function crawl(t: Target): Promise<{
  entry: SnapshotEntry;
  ok: boolean;
  reason: string;
}> {
  if (t.kind === "card") {
    const res = await fetchOG(t.url);
    const entry = pickEntry(res.data);
    const ok = res.ok && entryUsable(entry);
    const reason = ok
      ? ""
      : res.ok
        ? "no OG tags on page"
        : res.error || "fetch failed";
    return { entry, ok, reason };
  }
  const res = await fetchVideoCover(t.media);
  const entry = pickEntry({ image: res.image });
  const ok = res.ok && entryUsable(entry);
  const reason = ok ? "" : res.error || "cover fetch failed";
  return { entry, ok, reason };
}

/** Concurrency cap — keep us well under any per-host rate limits and CPU. */
const CRAWL_CONCURRENCY = 5;

async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function main() {
  const targets = collectTargets();
  // Read the existing artifact once: parsed for lookups, raw kept for the diff.
  let prevStr = "";
  try {
    prevStr = fs.readFileSync(SNAPSHOT_PATH, "utf8");
  } catch {
    // Missing file is fine — first run.
  }
  const existing: Snapshot = prevStr ? JSON.parse(prevStr) : {};

  const next: Snapshot = {};
  const added: string[] = [];
  const updated: string[] = [];
  const unchanged: string[] = [];
  const keptOnFailure: string[] = [];
  const manualSkipped: string[] = [];
  const missing: { url: string; reason: string }[] = [];

  // Split out the manual-covered targets — they need no network and shouldn't
  // burn a concurrency slot.
  const toCrawl: Target[] = [];
  for (const t of targets) {
    if (t.needsCrawl) toCrawl.push(t);
    else manualSkipped.push(t.url);
  }

  const results = await mapWithLimit(toCrawl, CRAWL_CONCURRENCY, crawl);

  for (let i = 0; i < toCrawl.length; i++) {
    const t = toCrawl[i];
    const { entry, ok, reason } = results[i];
    const prev = existing[t.url];

    if (ok) {
      next[t.url] = entry;
      if (!prev) added.push(t.url);
      else if (JSON.stringify(pickEntry(prev)) !== JSON.stringify(entry))
        updated.push(t.url);
      else unchanged.push(t.url);
    } else {
      if (prev && entryUsable(prev)) {
        next[t.url] = pickEntry(prev); // preserve good prior data
        keptOnFailure.push(`${t.url} (${reason})`);
      } else {
        missing.push({ url: t.url, reason });
      }
    }
  }

  const nextStr = serialize(next);
  const drifted = nextStr !== prevStr;

  // --- Report ---------------------------------------------------------------
  const log = (s: string) => process.stdout.write(s + "\n");
  log("");
  log("OG snapshot " + (CHECK ? "(check)" : "(write)"));
  log("─".repeat(48));
  const line = (label: string, items: string[]) => {
    if (items.length) {
      log(`  ${label} (${items.length}):`);
      for (const i of items) log(`    • ${i}`);
    }
  };
  line("added", added);
  line("updated", updated);
  line("kept on crawl failure", keptOnFailure);
  line("skipped — manual preview", manualSkipped);
  if (unchanged.length) log(`  unchanged: ${unchanged.length}`);
  if (missing.length) {
    log(`  ✗ MISSING (${missing.length}) — add a manual \`preview\` in log.json:`);
    for (const m of missing) log(`    • ${m.url} — ${m.reason}`);
  }
  log("");

  // --- Write (good entries are persisted even if others are missing) --------
  if (!CHECK && drifted) {
    fs.writeFileSync(SNAPSHOT_PATH, nextStr);
    log(
      `✓ Wrote ${path.relative(ROOT, SNAPSHOT_PATH)} (${added.length} added, ${updated.length} updated).`,
    );
  } else if (!CHECK) {
    log("✓ No changes — snapshot already current.");
  }

  // --- Decide exit code -----------------------------------------------------
  // A target that can't be crawled and has no manual preview is a hard error:
  // the author must add a `preview` to recover. Surfaced loudly, non-zero.
  if (missing.length) {
    log(
      `✗ ${missing.length} card(s) can't be crawled and have no manual preview.`,
    );
    log(
      `  Add "preview": { "title", "image", … } to that media item in content/log.json.`,
    );
    process.exit(1);
  }

  if (CHECK && drifted) {
    log("✗ Snapshot is out of date. Run `pnpm og:snapshot` and commit.");
    process.exit(1);
  }

  if (CHECK) log("✓ Snapshot is up to date.");
}

main().catch((err) => {
  console.error("og-snapshot failed:", err);
  process.exit(1);
});
