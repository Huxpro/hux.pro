/**
 * Build-time card snapshot generator.
 *
 *   node scripts/og-snapshot.ts             # crawl + write content/og-snapshot.json
 *   node scripts/og-snapshot.ts --complete  # CI: no network; every cover-bearing
 *                                           # attachment has a runtime image
 *   node scripts/og-snapshot.ts --check     # completeness, then re-crawl + diff
 *   node scripts/og-snapshot.ts --sizes     # record cover sizes only, no page crawl
 *
 * Reuses the exact crawl/parse core the runtime route uses (/api/og,
 * lib/og-core.ts), so the snapshot equals what the server would fetch.
 *
 * Targets: every `kind:"link"` media item (all cards) in log.json, and every
 * external `href` a magic link or a badge names in the site's MDX (content/,
 * docs/), since its peek is the page's card. Social embeds, videos, and images do
 * not pass through this pipeline.
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
 *  - Every cover that can be shown whole (a card's picture, a post's first
 *    image, a still) has its size recorded in content/image-sizes.json, read
 *    from the file's header, so its slot holds its height before the image
 *    loads (lib/image-sizes.ts). `--complete` fails on a cover missing from
 *    it, or a local file whose size has changed since.
 */

import fs from "fs";
import path from "path";
import { detectMediaKind } from "../lib/media-kind.ts";
import { inlineHrefs } from "../lib/inline-links.ts";
import { collectMagicLinkTags } from "./magic-link-tags.ts";
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
  generatedImageSize,
  parseImageDimensions,
  type ImageDimensions,
} from "../lib/image-dimensions.ts";
import { getAllBlogPosts } from "../lib/mdx.ts";
import {
  getAttachmentImage,
  isImageMedia,
  isLinkMedia,
  isSocialEmbedMedia,
  normalizeLogData,
  type Media,
  type RawLogData,
} from "../lib/log.ts";
import type { Locale } from "../lib/i18n.ts";
import { enrichLogDataWithPreviews } from "../lib/og-enrich.ts";
import { isSiteCardUrl, siteCardOf } from "../lib/site-card.ts";

type Snapshot = Record<string, SnapshotEntry>;

/** Stable field order for the serialized artifact. `frame` is only ever
 *  `"deny"`. A page that may be framed stores nothing, so the field reads
 *  as the exception it is (see `FramePolicy` in lib/og-core). */
const FIELDS = ["title", "description", "image", "siteName", "frame"] as const;

const ROOT = process.cwd();
const LOG_PATH = path.join(ROOT, "content", "log.json");
const SNAPSHOT_PATH = path.join(ROOT, "content", "og-snapshot.json");
const SIZES_PATH = path.join(ROOT, "content", "image-sizes.json");

const CHECK = process.argv.includes("--check");
const COMPLETE = process.argv.includes("--complete");
const SIZES = process.argv.includes("--sizes");

// --- Collect every URL that renders as a card or needs a video cover --------

type TargetKind = "card" | "video-cover";

interface Target {
  url: string;
  kind: TargetKind;
  needsCrawl: boolean; // false when a manual override covers it
  /** Snapshot of the media item itself, used by the video-cover fetcher
   *  to pick the right per-platform API. Carries no runtime state beyond
   *  what `og-core` reads. */
  media: PreviewableMedia;
}

function collectTargets(): Target[] {
  // Normalize the nested `identities[*].ranges` authoring shape into the
  // flat runtime `commits[]` before scanning. Otherwise media attached
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
  // A magic link's page peeks as its card (components/magic-link): the
  // ones prose names, a /works venue's page (a talk's conference), and the
  // pages a commit's own text links inline, which the timeline renders as
  // magic links too.
  for (const url of [...magicLinkHrefs(), ...logHrefs(log.commits ?? [])]) {
    upsert({
      url,
      kind: "card",
      needsCrawl: true,
      media: { kind: "link", url, present: "card" } as PreviewableMedia,
    });
  }
  return [...byUrl.values()];
}

/** Every page /works renders as a magic link from a commit itself: a talk's
 *  conference (TimelineCommit's `venueLink`), and every page its
 *  description, commentary or details link inline (lib/inline-links.ts), in
 *  either locale. */
function logHrefs(commits: RawLogData["commits"]): string[] {
  const urls = new Set<string>();
  const add = (url: string | undefined) => {
    if (url && /^https?:/.test(url) && detectMediaKind(url) === "link") urls.add(url);
  };
  for (const c of commits ?? []) {
    if (c.type === "talk") add(c.conference.url);
    for (const text of [c.description, c.commentary, c.details]) {
      for (const locale of ["en", "zh"] as const) {
        for (const url of inlineHrefs(text?.[locale])) add(url);
      }
    }
  }
  return [...urls];
}

/** Pages given their card by hand (content/badges.json `previews`). */
function badgePreviews(): Record<string, SnapshotEntry> {
  return (
    JSON.parse(fs.readFileSync(path.join(ROOT, "content", "badges.json"), "utf8")) as {
      previews?: Record<string, SnapshotEntry>;
    }
  ).previews ?? {};
}

/** Every external page a `<MagicLink href>` or `<Badge href>` names. */
function magicLinkHrefs(): string[] {
  // A page given its card by hand is not crawled: it has no card to crawl.
  const manual = badgePreviews();
  const urls = new Set<string>();
  for (const { attrs } of collectMagicLinkTags()) {
    const href = attrs.href;
    if (!href || !/^https?:/.test(href) || href in manual) continue;
    // Recordings, decks, images and social posts have their own peeks.
    if (detectMediaKind(href) !== "link") continue;
    urls.add(href);
  }
  return [...urls];
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
 *  OG is not enough: the strip, tiles, and attachment page would paint
 *  a blank. Recover with a manual `preview.image` / `thumbnail`. */
function entryUsable(e: SnapshotEntry): boolean {
  return !!e.image;
}

// --- Cover sizes (content/image-sizes.json) -----------------------------------

type ImageSizes = Record<string, [number, number]>;

/**
 * Every image the site can show whole, at its own aspect: a card's picture
 * (log.json cards after enrichment, a magic link's page, a badge's page), a
 * still, and each post's first image (its peek cover and its card). A slot
 * showing one of these has no height of its own until the image loads, so
 * its size is recorded. Generated cards (`/…/opengraph-image`) are one known
 * size and are left out.
 */
function coverImages(snapshot: Snapshot): string[] {
  const out = new Set<string>();
  const add = (src: string | null | undefined) => {
    if (!src || src.startsWith("data:") || generatedImageSize(src)) return;
    out.add(src);
  };
  const raw = JSON.parse(fs.readFileSync(LOG_PATH, "utf8")) as RawLogData;
  const data = enrichLogDataWithPreviews(normalizeLogData(raw), snapshot);
  for (const commit of data.commits) {
    for (const media of (commit.media ?? []) as Media[]) {
      if (isLinkMedia(media)) {
        add(media.preview?.image);
        for (const p of Object.values(media.previews ?? {})) add(p?.image);
      } else if (isImageMedia(media)) {
        add(media.thumbnail ?? media.url);
      }
    }
  }
  const badges = badgePreviews();
  for (const { attrs } of collectMagicLinkTags()) {
    const href = attrs.href;
    if (!href) continue;
    const kind = detectMediaKind(href);
    if (kind === "image") add(href);
    else if (kind === "link") add((badges[href] ?? snapshot[href])?.image);
  }
  for (const p of Object.values(badges)) add(p.image);
  for (const post of getAllBlogPosts()) {
    add(post.cover);
    add(post.coverZh);
  }
  return [...out].sort();
}

/** A site-local file's size, from its header on disk. */
function localSize(src: string): ImageDimensions | null {
  const file = localPublicPath(src);
  if (!file) return null;
  try {
    return parseImageDimensions(fs.readFileSync(file));
  } catch {
    return null;
  }
}

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** Largest prefix read looking for a header (a JPEG's EXIF can be long). */
const MAX_PROBE_BYTES = 2 * 1024 * 1024;

/** A remote image's size, reading only as much of it as the header needs. */
async function remoteSize(url: string): Promise<{ size: ImageDimensions | null; reason: string }> {
  try {
    const res = await fetch(url, {
      // The browser that will load it: some image hosts refuse anything else.
      headers: { "User-Agent": BROWSER_USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok || !res.body) return { size: null, reason: `HTTP ${res.status}` };
    const reader = res.body.getReader();
    let buf = new Uint8Array(0);
    try {
      while (buf.length < MAX_PROBE_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        const joined = new Uint8Array(buf.length + value.length);
        joined.set(buf);
        joined.set(value, buf.length);
        buf = joined;
        const size = parseImageDimensions(buf);
        if (size) return { size, reason: "" };
      }
    } finally {
      reader.cancel().catch(() => {});
    }
    return { size: parseImageDimensions(buf), reason: "unrecognized image format" };
  } catch (err) {
    return { size: null, reason: err instanceof Error ? err.message : String(err) };
  }
}

function readSizes(): { str: string; sizes: ImageSizes } {
  try {
    const str = fs.readFileSync(SIZES_PATH, "utf8");
    return { str, sizes: JSON.parse(str) as ImageSizes };
  } catch {
    return { str: "", sizes: {} };
  }
}

/** Sorted keys, one `"url": [w, h]` per line → byte-stable output. */
function serializeSizes(sizes: ImageSizes): string {
  const keys = Object.keys(sizes).sort();
  if (!keys.length) return "{}\n";
  const lines = keys.map((k) => `  ${JSON.stringify(k)}: [${sizes[k][0]}, ${sizes[k][1]}]`);
  return `{\n${lines.join(",\n")}\n}\n`;
}

// --- Completeness (filesystem-only; the GitHub CI gate) ----------------------

/** The committed snapshot. Missing: every card then depends on a manual preview. */
function readSnapshot(): Snapshot {
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8")) as Snapshot;
  } catch {
    return {};
  }
}

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
 * must resolve an image. Live social widgets paint themselves and are
 * skipped. Site-local paths must exist on disk.
 *
 * Exits 1 on any gap. No network.
 */
function checkCompleteness(): void {
  const log = (s: string) => process.stdout.write(s + "\n");
  const raw = JSON.parse(fs.readFileSync(LOG_PATH, "utf8")) as RawLogData;
  const snapshot = readSnapshot();
  const data = enrichLogDataWithPreviews(normalizeLogData(raw), snapshot);

  const problems: string[] = [];
  let checked = 0;
  let skippedWidgets = 0;

  for (const commit of data.commits) {
    for (const media of (commit.media ?? []) as Media[]) {
      if (isSocialEmbedMedia(media)) {
        skippedWidgets += 1;
        continue;
      }
      for (const locale of localesFor(media)) {
        const image = getAttachmentImage(media, locale);
        // Only a link carries a per-locale `urls` map: the same guard
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

  // Our own pages: the snapshot must say what the page says now. A post's
  // title, dek or first image edited without `pnpm og:snapshot` would leave
  // its cards on this site describing an older page than a crawler sees.
  let siteCards = 0;
  for (const t of collectTargets()) {
    if (t.kind !== "card" || !isSiteCardUrl(t.url)) continue;
    const fresh = siteCardOf(t.url);
    const recorded = snapshot[t.url];
    if (!fresh) {
      problems.push(`${t.url} — no such post on this site`);
    } else if (!recorded) {
      problems.push(`${t.url} — not in the snapshot (run \`pnpm og:snapshot\`)`);
    } else if (JSON.stringify(pickEntry(fresh)) !== JSON.stringify(pickEntry(recorded))) {
      problems.push(`${t.url} — the post changed since the snapshot (run \`pnpm og:snapshot\`)`);
    } else {
      siteCards += 1;
    }
  }

  // Every cover shown whole has its size recorded, and a local one's record
  // is the file's size now. Otherwise its slot opens at nothing and jumps when
  // the image loads (lib/image-sizes.ts).
  const { sizes } = readSizes();
  let sized = 0;
  for (const src of coverImages(snapshot)) {
    const recorded = sizes[src];
    const local = localPublicPath(src);
    if (local) {
      const actual = localSize(src);
      // A format the header reader doesn't know (SVG) has no size to hold.
      if (!actual) continue;
      if (!recorded || recorded[0] !== actual.width || recorded[1] !== actual.height) {
        problems.push(`${src} — cover size not recorded or stale (run \`pnpm og:snapshot\`)`);
        continue;
      }
    } else if (!recorded) {
      problems.push(`${src} — cover size not recorded (run \`pnpm og:snapshot\`)`);
      continue;
    }
    sized += 1;
  }

  log("");
  log("OG snapshot (complete)");
  log("─".repeat(48));
  log(`  checked: ${checked} attachment cover(s), ${siteCards} card(s) of this site's pages, ${sized} cover size(s)`);
  if (skippedWidgets) log(`  skipped — social widgets: ${skippedWidgets}`);
  if (problems.length) {
    log(`  ✗ PROBLEMS (${problems.length}):`);
    for (const p of problems) log(`    • ${p}`);
    log("");
    log("✗ A media attachment would paint without an image at runtime, a card of this site's own page is stale, or a cover's size is unknown.");
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
  /** The page's framing policy, learned from the headers of any response.
   *  A refusal to be crawled still answers this. */
  frame?: SnapshotEntry["frame"];
}> {
  if (t.kind === "card" && isSiteCardUrl(t.url)) {
    // One of our own pages: its card is what the page publishes, read from
    // the function that publishes it rather than crawled.
    const card = siteCardOf(t.url);
    const entry = pickEntry(card ?? {});
    const ok = !!card && entryUsable(entry);
    return { entry, ok, reason: ok ? "" : "no such post on this site" };
  }
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

/** Concurrency cap: keep us well under any per-host rate limits and CPU. */
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

/**
 * Cover sizes for the covers `snapshot` shows. A local file is read from
 * disk; a remote one is fetched only as far as its header. A probe that fails
 * keeps the size recorded before. That is also how a host that refuses the
 * probe is given its size by hand.
 */
async function recordSizes(snapshot: Snapshot) {
  const { str: prevStr, sizes: prev } = readSizes();
  const next: ImageSizes = {};
  const unsized: { src: string; reason: string }[] = [];
  const covers = coverImages(snapshot);
  const remote = covers.filter((src) => !localPublicPath(src));
  const probed = await mapWithLimit(remote, CRAWL_CONCURRENCY, remoteSize);
  const remoteProbes = new Map(remote.map((src, i) => [src, probed[i]]));
  for (const src of covers) {
    const probe = localPublicPath(src)
      ? { size: localSize(src), reason: "" }
      : remoteProbes.get(src)!;
    if (probe.size) next[src] = [probe.size.width, probe.size.height];
    else if (prev[src]) next[src] = prev[src];
    // A local file with no size to read (unknown format) has none to hold.
    else if (probe.reason) unsized.push({ src, reason: probe.reason });
  }
  const nextSizesStr = serializeSizes(next);
  return {
    nextSizesStr,
    sizesDrifted: nextSizesStr !== prevStr,
    sizeCount: Object.keys(next).length,
    unsized,
  };
}

function logSizes(
  count: number,
  drifted: boolean,
  unsized: { src: string; reason: string }[],
): void {
  const log = (s: string) => process.stdout.write(s + "\n");
  log(`  cover sizes: ${count}${drifted ? " (changed)" : ""}`);
  if (unsized.length) {
    log(`  ✗ UNSIZED (${unsized.length}) — add \`"<url>": [width, height]\` to content/image-sizes.json:`);
    for (const u of unsized) log(`    • ${u.src} — ${u.reason}`);
  }
}

/**
 * `--sizes`: record cover sizes for the committed snapshot, without crawling
 * any page. For a cover added by hand, or a local file replaced.
 */
async function sizesOnly(): Promise<void> {
  const log = (s: string) => process.stdout.write(s + "\n");
  const { nextSizesStr, sizesDrifted, sizeCount, unsized } = await recordSizes(readSnapshot());
  log("");
  log("Cover sizes (write)");
  log("─".repeat(48));
  logSizes(sizeCount, sizesDrifted, unsized);
  log("");
  if (sizesDrifted) {
    fs.writeFileSync(SIZES_PATH, nextSizesStr);
    log(`✓ Wrote ${path.relative(ROOT, SIZES_PATH)}.`);
  } else {
    log("✓ No changes — cover sizes already current.");
  }
  if (unsized.length) process.exit(1);
}

async function main() {
  // Completeness is free of the network and is the CI gate. `--check`
  // runs it first so a missing cover fails before a long re-crawl.
  if (COMPLETE || CHECK) {
    checkCompleteness();
    if (COMPLETE) return;
  }
  if (SIZES) return sizesOnly();

  const targets = collectTargets();
  // Read the existing artifact once: parsed for lookups, raw kept for the diff.
  let prevStr = "";
  try {
    prevStr = fs.readFileSync(SNAPSHOT_PATH, "utf8");
  } catch {
    // Missing file is fine: first run.
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

  // Split out the manual-covered targets: their preview needs no network.
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
      // which `entryUsable` calls a success, and the cover we already had
      // would be dropped without warning, taking the commit's tile off /works
      // and failing `og:complete` for a picture that is still live.
      // (ticketingbusinessforum was the case: its image still 200'd, but
      // the page stopped advertising it. Its cover is now self-hosted with
      // a manual preview, which is the durable fix.) The image we recorded
      // once is kept until a crawl offers another.
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
        // Preserve good prior data, and keep the one thing a failed crawl can
        // still tell us: whether the page may be framed.
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

  const { nextSizesStr, sizesDrifted, sizeCount, unsized } = await recordSizes(next);
  const drifted = nextStr !== prevStr || sizesDrifted;

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
  logSizes(sizeCount, sizesDrifted, unsized);
  log("");

  // --- Write (good entries are persisted even if others are missing) --------
  if (!CHECK && drifted) {
    if (nextStr !== prevStr) {
      fs.writeFileSync(SNAPSHOT_PATH, nextStr);
      log(
        `✓ Wrote ${path.relative(ROOT, SNAPSHOT_PATH)} (${added.length} added, ${updated.length} updated).`,
      );
    }
    if (sizesDrifted) {
      fs.writeFileSync(SIZES_PATH, nextSizesStr);
      log(`✓ Wrote ${path.relative(ROOT, SIZES_PATH)}.`);
    }
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

  if (unsized.length) {
    log(`✗ ${unsized.length} cover(s) have no known size; their slots would jump as they load.`);
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
