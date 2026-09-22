/**
 * Build-time card snapshot generator.
 *
 *   node scripts/og-snapshot.ts             # crawl + write content/og-snapshot.json
 *   node scripts/og-snapshot.ts --complete  # CI: no network; every cover-bearing
 *                                           # attachment has a runtime image
 *   node scripts/og-snapshot.ts --check     # completeness, then re-crawl + diff
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
 *  - Completeness (`--complete`) is filesystem-only and is what GitHub CI
 *    runs: after the same enrichment production uses, every media
 *    attachment that paints a cover has an image (and site-local files
 *    exist on disk). Live social widgets are not covers.
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
  getAttachmentImage,
  isLinkMedia,
  isSocialEmbedMedia,
  isLinkPill,
  normalizeLogData,
  type Media,
  type RawLogData,
} from "../lib/log.ts";
import type { Locale } from "../lib/i18n.ts";
import { enrichLogDataWithPreviews } from "../lib/og-enrich.ts";

type Snapshot = Record<string, SnapshotEntry>;

/** Stable field order for the serialized artifact. `frame` is only ever
 *  `"deny"` — a page that may be framed stores nothing, so the field reads
 *  as the exception it is (see `FramePolicy` in lib/og-core). */
const FIELDS = ["title", "description", "image", "siteName", "frame"] as const;

const ROOT = process.cwd();
const LOG_PATH = path.join(ROOT, "content", "log.json");
const SNAPSHOT_PATH = path.join(ROOT, "content", "og-snapshot.json");

const CHECK = process.argv.includes("--check");
const COMPLETE = process.argv.includes("--complete");

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

/** A snapshot entry is only a cover if it actually has an image. Title-only
 *  OG is not enough — the strip, tiles, and attachment page would paint
 *  a blank. Recover with a manual `preview.image` / `thumbnail`. */
function entryUsable(e: SnapshotEntry): boolean {
  return !!e.image;
}

// --- Completeness (filesystem-only; the GitHub CI gate) ----------------------

/** Site-local `/img/…` (or any public path) → path under `public/`. */
function localPublicPath(url: string): string | null {
  if (!url.startsWith("/") || url.startsWith("//")) return null;
  const clean = url.split(/[?#]/)[0] ?? url;
  return path.join(ROOT, "public", clean.replace(/^\//, ""));
}

function localesFor(media: Media): Locale[] {
  if (isLinkMedia(media) && media.urls) {
    const locales = (["en", "zh"] as const).filter((l) => media.urls?.[l]);
    return locales.length ? [...locales] : ["en"];
  }
  return ["en"];
}

function recoverHint(media: Media): string {
  if (isLinkMedia(media)) {
    return 'add preview.image or run `pnpm og:snapshot`';
  }
  if (media.kind === "slides" || media.kind === "video") {
    return "add a thumbnail on the media item";
  }
  return "give the media an image URL that exists at runtime";
}

/**
 * After the same enrichment `/works` uses, every cover-bearing attachment
 * must resolve an image. Pills are not attachments; live social widgets
 * paint themselves and are skipped. Site-local paths must exist on disk.
 *
 * Exits 1 on any gap. No network.
 */
function checkCompleteness(): void {
  const log = (s: string) => process.stdout.write(s + "\n");
  const raw = JSON.parse(fs.readFileSync(LOG_PATH, "utf8")) as RawLogData;
  let snapshot: Record<string, SnapshotEntry> = {};
  try {
    snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
  } catch {
    // Missing snapshot: every card then depends on a manual preview.
  }
  const data = enrichLogDataWithPreviews(normalizeLogData(raw), snapshot);

  const problems: string[] = [];
  let checked = 0;
  let skippedWidgets = 0;

  for (const commit of data.commits) {
    for (const media of (commit.media ?? []) as Media[]) {
      if (isLinkPill(media)) continue;
      if (isSocialEmbedMedia(media)) {
        skippedWidgets += 1;
        continue;
      }
      for (const locale of localesFor(media)) {
        const image = getAttachmentImage(media, locale);
        // Only a link carries a per-locale `urls` map — the same guard
        // `localesFor` uses to decide there is more than one locale here.
        const urls = isLinkMedia(media) ? media.urls : undefined;
        const where = urls?.[locale] ?? media.url;
        const tag = urls ? ` [${locale}]` : "";
        const label = `${commit.id} · ${media.kind} · ${where}${tag}`;
        if (!image) {
          problems.push(`${label} — no runtime image (${recoverHint(media)})`);
          continue;
        }
        const local = localPublicPath(image);
        if (local && !fs.existsSync(local)) {
          problems.push(`${label} — missing file ${image}`);
          continue;
        }
        checked += 1;
      }
    }
  }

  log("");
  log("OG snapshot (complete)");
  log("─".repeat(48));
  log(`  checked: ${checked} attachment cover(s)`);
  if (skippedWidgets) log(`  skipped — social widgets: ${skippedWidgets}`);
  if (problems.length) {
    log(`  ✗ MISSING IMAGE (${problems.length}):`);
    for (const p of problems) log(`    • ${p}`);
    log("");
    log("✗ A media attachment would paint without an image at runtime.");
    process.exit(1);
  }
  log("✓ every media attachment has a runtime image.");
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
  // Completeness is free of the network and is the CI gate. `--check`
  // runs it first so a missing cover fails before a long re-crawl.
  if (COMPLETE || CHECK) {
    checkCompleteness();
    if (COMPLETE) return;
  }

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
      // and comes back thinner, not only the one that fails. A site
      // redesign that drops its `og:image` still answers 200 with a title,
      // which `entryUsable` calls a success — and the cover we already had
      // would go with it, silently, taking the commit's tile off /works and
      // failing `og:complete` for a picture that is still live.
      // ticketingbusinessforum is the one in the log today: its entry's
      // image 200s, but the page stopped advertising it, so the next crawl
      // would drop it. The image we recorded once is kept until a crawl
      // offers another.
      const merged =
        !entry.image && prev?.image
          ? pickEntry({ ...entry, image: prev.image })
          : entry;
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
