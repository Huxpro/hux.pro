/**
 * Build-time Open Graph snapshot generator.
 *
 *   node scripts/og-snapshot.ts          # crawl + write content/og-snapshot.json
 *   node scripts/og-snapshot.ts --check  # CI: re-crawl, diff, exit 1 on drift
 *
 * Reuses the exact crawl/parse core the runtime Server Action uses
 * (lib/og-core.ts), so the snapshot equals what the server would fetch.
 *
 * Design goals (per request):
 *  - Same data as the live server crawl.
 *  - On crawl failure: never overwrite good data; if there's no prior entry
 *    and no manual `preview`, FAIL loudly so the link gets a manual preview
 *    (the recovery path for crawl-blocked sites like Medium).
 *  - Deterministic, timestamp-free output → no flaky churn.
 *  - Report exactly what changed.
 */

import fs from "fs";
import path from "path";
import {
  fetchOG,
  mediaIsOGPreviewTarget,
  mediaNeedsLiveCrawl,
  type PreviewableMedia,
} from "../lib/og-core.ts";

interface SnapshotEntry {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}
type Snapshot = Record<string, SnapshotEntry>;

const ROOT = process.cwd();
const LOG_PATH = path.join(ROOT, "content", "log.json");
const SNAPSHOT_PATH = path.join(ROOT, "content", "og-snapshot.json");

const CHECK = process.argv.includes("--check");

// --- Collect every URL that renders as a link-preview card -------------------

interface Target {
  url: string;
  needsCrawl: boolean; // false when a complete manual preview covers it
}

function collectTargets(): Target[] {
  const log = JSON.parse(fs.readFileSync(LOG_PATH, "utf8"));
  const byUrl = new Map<string, Target>();
  for (const commit of log.commits ?? []) {
    for (const media of (commit.media ?? []) as PreviewableMedia[]) {
      if (!mediaIsOGPreviewTarget(media)) continue;
      const existing = byUrl.get(media.url);
      const needsCrawl = mediaNeedsLiveCrawl(media);
      // If any occurrence needs a crawl, the URL needs a crawl.
      if (!existing) byUrl.set(media.url, { url: media.url, needsCrawl });
      else existing.needsCrawl = existing.needsCrawl || needsCrawl;
    }
  }
  return [...byUrl.values()];
}

// --- Serialization (deterministic) -------------------------------------------

function pickEntry(d: {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}): SnapshotEntry {
  const e: SnapshotEntry = {};
  if (d.title) e.title = d.title;
  if (d.description) e.description = d.description;
  if (d.image) e.image = d.image;
  if (d.siteName) e.siteName = d.siteName;
  return e;
}

function serialize(snap: Snapshot): string {
  const sortedKeys = Object.keys(snap).sort();
  const ordered: Snapshot = {};
  for (const k of sortedKeys) {
    const e = snap[k];
    // Order fields stably too.
    const stable: SnapshotEntry = {};
    if (e.title) stable.title = e.title;
    if (e.description) stable.description = e.description;
    if (e.image) stable.image = e.image;
    if (e.siteName) stable.siteName = e.siteName;
    ordered[k] = stable;
  }
  return JSON.stringify(ordered, null, 2) + "\n";
}

function entryUsable(e: SnapshotEntry): boolean {
  return !!(e.title || e.image);
}

// --- Main --------------------------------------------------------------------

async function main() {
  const targets = collectTargets();
  const existing: Snapshot = fs.existsSync(SNAPSHOT_PATH)
    ? JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"))
    : {};

  const next: Snapshot = {};
  const added: string[] = [];
  const updated: string[] = [];
  const unchanged: string[] = [];
  const keptOnFailure: string[] = [];
  const manualSkipped: string[] = [];
  const missing: { url: string; reason: string }[] = [];

  for (const t of targets) {
    if (!t.needsCrawl) {
      // Fully covered by a manual preview; not stored (manual wins at runtime).
      manualSkipped.push(t.url);
      continue;
    }

    const res = await fetchOG(t.url);
    const prev = existing[t.url];

    if (res.ok && entryUsable(pickEntry(res.data))) {
      const entry = pickEntry(res.data);
      next[t.url] = entry;
      if (!prev) added.push(t.url);
      else if (JSON.stringify(pickEntry(prev)) !== JSON.stringify(entry))
        updated.push(t.url);
      else unchanged.push(t.url);
    } else {
      // Couldn't get usable OG data.
      const reason = res.ok ? "no OG tags on page" : res.error || "fetch failed";
      if (prev && entryUsable(prev)) {
        next[t.url] = pickEntry(prev); // preserve good prior data
        keptOnFailure.push(`${t.url} (${reason})`);
      } else {
        missing.push({ url: t.url, reason });
      }
    }
  }

  const nextStr = serialize(next);
  const prevStr = fs.existsSync(SNAPSHOT_PATH)
    ? fs.readFileSync(SNAPSHOT_PATH, "utf8")
    : "";
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
      `✗ ${missing.length} embed(s) can't be crawled and have no manual preview.`,
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
