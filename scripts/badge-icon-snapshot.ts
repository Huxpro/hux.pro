/**
 * Build-time badge-icon snapshot.
 *
 *   node scripts/badge-icon-snapshot.ts          # crawl + write icons + snapshot
 *   node scripts/badge-icon-snapshot.ts --check  # CI: every badge has an icon, no network
 *
 * Targets: every `<Badge>` / `<BadgeLink>` written in the site's MDX
 * (content/**, docs/**). Each resolves to a site (lib/badge-site.ts — the same
 * rule the component uses); for each site we take the icon the site declares
 * for a home screen (manifest → apple-touch-icon → favicon, lib/app-icon-core),
 * or the one content/badges.json names, download it into public/badge-icons/,
 * and record it in content/badge-icons.json.
 *
 * Same contract as the app-icon snapshot: committed artifacts, no runtime
 * crawling; a crawl failure never deletes a good prior icon; a badge whose
 * site has no icon at all fails the run, so a badge never ships wearing a
 * placeholder. `--check` is filesystem-only.
 */

import fs from "fs";
import path from "path";
import {
  discoverAppIcon,
  fetchIcon,
  sniffImage,
  type AppIconSnapshot,
  type AppIconSnapshotEntry,
} from "../lib/app-icon-core.ts";
import {
  badgeSiteUrl,
  siteKey,
  siteOrigin,
  type BadgeConfig,
  type BadgeSiteSpec,
} from "../lib/badge-site.ts";
import { normalizeLogData, type RawLogData } from "../lib/log.ts";

const ROOT = process.cwd();
const SNAPSHOT_PATH = path.join(ROOT, "content", "badge-icons.json");
const CONFIG_PATH = path.join(ROOT, "content", "badges.json");
const LOG_PATH = path.join(ROOT, "content", "log.json");
const ICONS_DIR = path.join(ROOT, "public", "badge-icons");
const SOURCES = [path.join(ROOT, "content"), path.join(ROOT, "docs")];

const CHECK = process.argv.includes("--check");

// --- Collecting the badges ---------------------------------------------------

function mdxFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return mdxFiles(p);
    return /\.mdx?$/.test(e.name) ? [p] : [];
  });
}

interface Usage {
  spec: BadgeSiteSpec;
  where: string;
}

/** Every `<Badge …>` in the MDX, with the attributes that pick its icon. */
function collectUsages(): Usage[] {
  const usages: Usage[] = [];
  const tag = /<Badge(?:Link)?\b([^>]*?)\/?>/g;
  const attr = /(\w+)=(?:"([^"]*)"|\{"([^"]*)"\})/g;
  for (const file of SOURCES.flatMap(mdxFiles)) {
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(tag)) {
      const spec: Record<string, string> = {};
      for (const a of m[1].matchAll(attr)) spec[a[1]] = a[2] ?? a[3];
      // A code sample documenting the syntax is not a badge.
      if (Object.values(spec).some((v) => v.includes("…"))) continue;
      const line = text.slice(0, m.index).split("\n").length;
      usages.push({ spec, where: `${path.relative(ROOT, file)}:${line}` });
    }
  }
  return usages;
}

interface Site {
  key: string;
  /** What discovery crawls: the site's origin. */
  url: string;
  /** Named by content/badges.json instead of discovered. */
  icon?: string;
  where: string[];
}

function collectSites(config: BadgeConfig): { sites: Site[]; unresolved: string[] } {
  const raw = JSON.parse(fs.readFileSync(LOG_PATH, "utf8")) as RawLogData;
  const { commits } = normalizeLogData(raw);
  const bySite = new Map<string, Site>();
  const unresolved: string[] = [];
  for (const { spec, where } of collectUsages()) {
    if (spec.commit && !commits.some((c) => c.id === spec.commit)) {
      unresolved.push(`${where}: no commit "${spec.commit}"`);
      continue;
    }
    const url = badgeSiteUrl(spec, commits, config);
    if (!url) continue;
    const key = siteKey(url);
    const origin = siteOrigin(url);
    if (!key || !origin) {
      unresolved.push(`${where}: cannot read a site from ${url}`);
      continue;
    }
    const site = bySite.get(key) ?? {
      key,
      url: origin,
      icon: config.icons?.[key],
      where: [],
    };
    site.where.push(where);
    bySite.set(key, site);
  }
  const sites = [...bySite.values()].sort((a, b) => a.key.localeCompare(b.key));
  return { sites, unresolved };
}

// --- Snapshot I/O --------------------------------------------------------------

function readSnapshot(): { snapshot: AppIconSnapshot; raw: string } {
  try {
    const raw = fs.readFileSync(SNAPSHOT_PATH, "utf8");
    return { snapshot: JSON.parse(raw) as AppIconSnapshot, raw };
  } catch {
    return { snapshot: {}, raw: "" };
  }
}

function serialize(snapshot: AppIconSnapshot): string {
  const ordered: AppIconSnapshot = {};
  for (const key of Object.keys(snapshot).sort()) {
    const e = snapshot[key];
    const out: AppIconSnapshotEntry = { url: e.url, file: e.file, source: e.source };
    if (e.iconUrl) out.iconUrl = e.iconUrl;
    if (e.width) out.width = e.width;
    if (e.height) out.height = e.height;
    ordered[key] = out;
  }
  return JSON.stringify(ordered, null, 2) + "\n";
}

function entryUsable(e: AppIconSnapshotEntry): boolean {
  return fs.existsSync(path.join(ROOT, "public", e.file.replace(/^\//, "")));
}

function writeIfChanged(file: string, bytes: Uint8Array): boolean {
  try {
    const prev = fs.readFileSync(file);
    if (prev.length === bytes.length && prev.equals(Buffer.from(bytes))) return false;
  } catch {
    // first write
  }
  fs.writeFileSync(file, bytes);
  return true;
}

// --- Resolving one site --------------------------------------------------------

interface Resolved {
  entry?: AppIconSnapshotEntry;
  bytes?: Uint8Array;
  error?: string;
}

async function resolve(site: Site): Promise<Resolved> {
  // A named icon under public/ is vendored: used as it is, never crawled.
  // For a site whose own icon is gone (hermesengine.dev now redirects to
  // GitHub; its logo survives in the Wayback Machine).
  if (site.icon?.startsWith("/")) {
    try {
      const bytes = new Uint8Array(fs.readFileSync(path.join(ROOT, "public", site.icon.slice(1))));
      const sniffed = sniffImage(bytes, null);
      if (!sniffed) return { error: `not an image: ${site.icon}` };
      return {
        entry: {
          url: site.url,
          file: site.icon,
          source: "manual",
          width: sniffed.width,
          height: sniffed.height,
        },
      };
    } catch {
      return { error: `named icon not found under public/: ${site.icon}` };
    }
  }
  const named = site.icon ? [{ url: site.icon, source: "manual" as const }] : [];
  const discovered = site.icon ? [] : (await discoverAppIcon(site.url)).candidates;
  for (const candidate of [...named, ...discovered]) {
    // Archives and CDNs drop the odd connection; a named icon is worth a retry.
    let icon = await fetchIcon(candidate.url);
    for (let attempt = 1; !icon && candidate.source === "manual" && attempt < 4; attempt++) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      icon = await fetchIcon(candidate.url);
    }
    if (!icon) continue;
    return {
      bytes: icon.bytes,
      entry: {
        url: site.url,
        file: `/badge-icons/${site.key}.${icon.ext}`,
        source: candidate.source,
        iconUrl: candidate.url,
        width: icon.width,
        height: icon.height,
      },
    };
  }
  return { error: site.icon ? `named icon failed: ${site.icon}` : "no fetchable icon" };
}

async function mapWithLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

// --- Main ----------------------------------------------------------------------

const log = (s: string) => process.stdout.write(s + "\n");

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as BadgeConfig;
  const { sites, unresolved } = collectSites(config);
  const { snapshot: existing, raw: prevStr } = readSnapshot();

  if (CHECK) {
    const problems = [...unresolved];
    for (const site of sites) {
      const e = existing[site.key];
      if (!e) problems.push(`${site.key} has no icon (${site.where[0]})`);
      else if (!entryUsable(e)) problems.push(`${site.key} icon file missing: ${e.file}`);
    }
    const keys = new Set(sites.map((s) => s.key));
    for (const key of Object.keys(existing)) {
      if (!keys.has(key)) problems.push(`stale entry "${key}" (no badge uses it)`);
    }
    log("");
    log("Badge-icon snapshot (check)");
    log("─".repeat(48));
    if (problems.length) {
      for (const p of problems) log(`  ✗ ${p}`);
      log("✗ Run `pnpm badges:snapshot` and commit.");
      process.exit(1);
    }
    log(`  ✓ ${sites.length} site(s) covered.`);
    return;
  }

  fs.mkdirSync(ICONS_DIR, { recursive: true });
  const results = await mapWithLimit(sites, 5, resolve);
  const next: AppIconSnapshot = {};
  const missing: string[] = [...unresolved];
  const report: string[] = [];

  sites.forEach((site, i) => {
    const { entry, bytes, error } = results[i];
    if (!entry) {
      const prev = existing[site.key];
      if (prev && entryUsable(prev)) {
        next[site.key] = prev;
        report.push(`kept ${site.key} (${error})`);
      } else {
        missing.push(`${site.key} — ${error} (${site.where.join(", ")})`);
      }
      return;
    }
    if (bytes) {
      writeIfChanged(path.join(ROOT, "public", entry.file.replace(/^\//, "")), bytes);
    }
    next[site.key] = entry;
    report.push(`${site.key} ← ${entry.iconUrl ?? entry.file} (${entry.source}, ${entry.width ?? "?"}×${entry.height ?? "?"})`);
  });

  // Prune files no entry points at (generated, safe to remove).
  const keep = new Set(Object.values(next).map((e) => path.basename(e.file)));
  for (const f of fs.readdirSync(ICONS_DIR)) {
    if (!keep.has(f)) fs.unlinkSync(path.join(ICONS_DIR, f));
  }

  log("");
  log("Badge-icon snapshot (write)");
  log("─".repeat(48));
  for (const r of report) log(`  • ${r}`);
  const nextStr = serialize(next);
  if (nextStr !== prevStr) {
    fs.writeFileSync(SNAPSHOT_PATH, nextStr);
    log(`✓ Wrote ${path.relative(ROOT, SNAPSHOT_PATH)}.`);
  } else {
    log("✓ No changes.");
  }
  if (missing.length) {
    log(`✗ ${missing.length} badge site(s) have no icon — name one in content/badges.json "icons":`);
    for (const m of missing) log(`    • ${m}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("badge-icon-snapshot failed:", err);
  process.exit(1);
});
