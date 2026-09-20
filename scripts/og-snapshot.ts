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
import {
  getMediaStripItems,
  isLinkPill,
  isSocialEmbedMedia,
  normalizeLogData,
  type RawLogData,
} from "../lib/log.ts";
import { enrichLogDataWithPreviews, type OGSnapshot } from "../lib/og-enrich.ts";

type Snapshot = Record<string, SnapshotEntry>;

/** Stable field order for the serialized artifact. `frame` is only ever
 *  `"deny"` — a page that may be framed stores nothing, so the field reads
 *  as the exception it is (see `FramePolicy` in lib/og-core). */
const FIELDS = ["title", "description", "image", "siteName", "frame"] as const;

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
  // Normalize the nested `identities[*].ranges` authoring shape into the
  // flat runtime `commits[]` before scanning — otherwise media attached
  // to role instances (e.g. Alibaba intern's writing cards) never enters
  // the crawl set. `normalizeLogData` is idempotent for already-flat
  // input, so this is safe even before the identity migration lands.
  const raw = JSON.parse(fs.readFileSync(LOG_PATH, "utf8")) as RawLogData;
  const log = normalizeLogData(raw);
  const byUrl = new Map<string, Target>();
  const upsert = (t: Target) => {
    const existing = byUrl.get(t.url);
    if (!existing) byUrl.set(t.url, t);
    else existing.needsCrawl = existing.needsCrawl || t.needsCrawl;
  };
  for (const commit of log.commits ?? []) {
    for (const media of (commit.media ?? []) as PreviewableMedia[]) {
      if (mediaIsCardTarget(media)) {
        // Primary URL always crawled.
        upsert({
          url: media.url,
          kind: "card",
          needsCrawl: mediaNeedsLiveCrawl(media),
          media,
        });
        // Bilingual variants: each per-locale URL is its own card
        // target so its OG data lands in the snapshot under its own
        // key. `resolvePreviewsByLocale` picks them apart at
        // enrichment time.
        const urls = (media as { urls?: Record<string, string> }).urls;
        if (urls) {
          for (const localeUrl of Object.values(urls)) {
            if (!localeUrl || localeUrl === media.url) continue;
            upsert({
              url: localeUrl,
              kind: "card",
              // Locale variants can't share the parent's manual
              // preview override, so they always need a crawl.
              needsCrawl: true,
              media,
            });
          }
        }
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
  for (const f of FIELDS) {
    if (f === "frame") {
      if (d.frame === "deny") e.frame = "deny";
    } else if (d[f]) {
      e[f] = d[f];
    }
  }
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
  /** The page's framing policy, learned from the headers of any response —
   *  a refusal to be crawled still answers this. */
  frame?: SnapshotEntry["frame"];
}> {
  if (t.kind === "card") {
    const res = await fetchOG(t.url);
    const entry = pickEntry({ ...res.data, frame: res.frame });
    const ok = res.ok && entryUsable(entry);
    const reason = ok
      ? ""
      : res.ok
        ? "no OG tags on page"
        : res.error || "fetch failed";
    return { entry, ok, reason, frame: res.frame };
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
  const keptImage: string[] = [];
  const manualSkipped: string[] = [];
  const missing: { url: string; reason: string }[] = [];

  // Split out the manual-covered targets — their preview needs no network.
  // Their framing policy still does (an author writes a title and an image
  // for a page that blocks crawlers; whether it blocks frames is the page's
  // to say), so external ones get a headers-only look below.
  const toCrawl: Target[] = [];
  const manual: Target[] = [];
  for (const t of targets) {
    if (t.needsCrawl) toCrawl.push(t);
    else {
      manualSkipped.push(t.url);
      if (t.kind === "card" && /^https?:/.test(t.url)) manual.push(t);
    }
  }

  const results = await mapWithLimit(toCrawl, CRAWL_CONCURRENCY, crawl);
  const manualFrames = await mapWithLimit(
    manual,
    CRAWL_CONCURRENCY,
    async (t) => (await fetchOG(t.url)).frame,
  );

  for (let i = 0; i < toCrawl.length; i++) {
    const t = toCrawl[i];
    const { entry, ok, reason, frame } = results[i];
    const prev = existing[t.url];

    if (ok) {
      // "Never overwrite good data" has to cover the crawl that *succeeds*
      // and comes back thinner, not just the one that fails. A site
      // redesign that drops its `og:image` still answers 200 with a title,
      // which `entryUsable` calls a success — and the cover we already had
      // would go with it, silently, taking the commit's tile off /works.
      // The image we recorded once is kept until a crawl offers another.
      const merged =
        !entry.image && prev?.image ? pickEntry({ ...entry, image: prev.image }) : entry;
      if (merged !== entry) keptImage.push(`${t.url} (page no longer advertises one)`);
      next[t.url] = merged;
      if (!prev) added.push(t.url);
      else if (JSON.stringify(pickEntry(prev)) !== JSON.stringify(merged))
        updated.push(t.url);
      else unchanged.push(t.url);
    } else {
      if (prev && entryUsable(prev)) {
        // Preserve good prior data — and the one thing a failed crawl can
        // still teach: whether the page may be framed.
        const kept = pickEntry({ ...prev, frame: frame ?? prev.frame });
        next[t.url] = kept;
        if (JSON.stringify(kept) !== JSON.stringify(pickEntry(prev)))
          updated.push(t.url);
        keptOnFailure.push(`${t.url} (${reason})`);
      } else {
        missing.push({ url: t.url, reason });
      }
    }
  }

  // A manual-preview card keeps whatever entry it had (none, usually) and
  // learns only its framing policy. `pickEntry` drops the entry again when
  // the page may be framed, so a framable page stores nothing.
  for (let i = 0; i < manual.length; i++) {
    const t = manual[i];
    const frame = manualFrames[i];
    const prev = existing[t.url];
    const entry = pickEntry({ ...(prev ?? {}), frame: frame ?? prev?.frame });
    if (Object.keys(entry).length === 0) continue;
    next[t.url] = entry;
    if (JSON.stringify(entry) !== JSON.stringify(prev ? pickEntry(prev) : {}))
      updated.push(t.url);
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
  line("kept the cover we already had", keptImage);
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

  // --- The invariant: every attachment has a cover --------------------------
  //
  // The snapshot's idea of success is "the crawl returned something"; the
  // page's requirement is "there is an image". Those two drifted apart and
  // nothing noticed, because the render layer degrades *plausibly*: an
  // attachment with no cover is dropped from `getMediaStripItems`, so it
  // vanishes from the strip (a sparse row looks deliberate) and falls to
  // the leftover `MediaRenderer` in the feed (a bordered card next to a
  // full-bleed tile looks like a variant). Nothing is ever drawn broken,
  // so only a count finds it.
  //
  // So this asks the production question, through the production function,
  // against the snapshot we just wrote: does every attachment the page will
  // try to tile actually resolve an image? Pills are exempt — they are not
  // covers and never were. A social widget is exempt too: a live embed has
  // no still to stand in for it, which is the one honest reason to have
  // none, and it is why `MediaRenderer` still exists on /works.
  const enriched = enrichLogDataWithPreviews(
    normalizeLogData(JSON.parse(fs.readFileSync(LOG_PATH, "utf8")) as RawLogData),
    next as OGSnapshot,
  );
  const uncovered: { commit: string; kind: string; url: string }[] = [];
  for (const commit of enriched.commits ?? []) {
    const tileable = (commit.media ?? []).filter(
      (m) => !isLinkPill(m) && !isSocialEmbedMedia(m),
    );
    if (tileable.length === 0) continue;
    const tiles = getMediaStripItems(tileable, "en");
    for (const m of tileable) {
      if (!tiles.some((t) => t.media === m))
        uncovered.push({ commit: commit.id, kind: m.kind, url: m.url });
    }
  }
  if (uncovered.length) {
    log(`  ✗ NO COVER (${uncovered.length}) — these draw nothing on /works:`);
    for (const u of uncovered)
      log(`    • ${u.commit} — ${u.kind} — ${u.url}`);
    log("");
  }

  // --- Decide exit code -----------------------------------------------------
  // A target that can't be crawled and has no manual preview is a hard error:
  // the author must add a `preview` to recover. Surfaced loudly, non-zero.
  // An attachment with no cover is as broken as a card that can't be
  // crawled, and for the author the recovery is the same shape: say where
  // the picture is. A deck is the common case — a reveal.js export carries
  // no OG tags at all, so its cover can only ever be authored.
  if (uncovered.length) {
    log(`✗ ${uncovered.length} attachment(s) have no cover.`);
    log(`  A deck needs "thumbnail": "…"; a card needs "preview": { "image": "…" }.`);
    log(`  Add it to that media item in content/log.json.`);
    process.exit(1);
  }

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
