/**
 * Build-time app-icon snapshot generator.
 *
 *   node scripts/app-icon-snapshot.ts          # crawl + write icons + snapshot
 *   node scripts/app-icon-snapshot.ts --check  # CI: validate coverage, no network
 *
 * Targets: every entry in `content/apps.json` (the home-screen app shelf).
 * For each app URL we resolve the icon the site itself declares for
 * home-screen use (manifest icons → apple-touch-icon → favicon; see
 * lib/app-icon-core.ts), download the winning file into `public/app-icons/`,
 * and record what happened in `content/app-icons.json`.
 *
 * Design goals (mirroring og-snapshot):
 *  - Committed artifacts, zero runtime crawling — static-export friendly.
 *  - On crawl failure: never delete a good prior icon; if there's no prior
 *    icon and no manual `icon` override, FAIL loudly so the author adds one.
 *  - Deterministic snapshot serialization → no flaky churn.
 *  - `--check` is filesystem-only: icons rarely change and binary drift from
 *    server re-encoding would make a re-crawl check flaky. Refreshing icons
 *    is an explicit `pnpm apps:snapshot` run.
 */

import fs from "fs";
import path from "path";
import {
  discoverAppIcon,
  fetchIcon,
  sniffImage,
  type AppIconSnapshot,
  type AppIconSnapshotEntry,
  type AppLink,
} from "../lib/app-icon-core.ts";

const ROOT = process.cwd();
const APPS_PATH = path.join(ROOT, "content", "apps.json");
const SNAPSHOT_PATH = path.join(ROOT, "content", "app-icons.json");
const ICONS_DIR = path.join(ROOT, "public", "app-icons");

const CHECK = process.argv.includes("--check");

function readApps(): AppLink[] {
  const raw = JSON.parse(fs.readFileSync(APPS_PATH, "utf8")) as {
    apps?: AppLink[];
  };
  const apps = raw.apps ?? [];
  const ids = new Set<string>();
  for (const app of apps) {
    if (!app.id || !app.title || !app.url)
      throw new Error(`apps.json entry missing id/title/url: ${JSON.stringify(app)}`);
    if (!/^[a-z0-9-]+$/.test(app.id))
      throw new Error(`app id must be [a-z0-9-]: "${app.id}" (it names the icon file)`);
    if (ids.has(app.id)) throw new Error(`duplicate app id: "${app.id}"`);
    ids.add(app.id);
  }
  return apps;
}

function readSnapshot(): { snapshot: AppIconSnapshot; raw: string } {
  try {
    const raw = fs.readFileSync(SNAPSHOT_PATH, "utf8");
    return { snapshot: JSON.parse(raw) as AppIconSnapshot, raw };
  } catch {
    return { snapshot: {}, raw: "" };
  }
}

/** Stable field order per entry + sorted ids → byte-stable output. */
function serialize(snapshot: AppIconSnapshot): string {
  const ordered: AppIconSnapshot = {};
  for (const id of Object.keys(snapshot).sort()) {
    const e = snapshot[id];
    const out: AppIconSnapshotEntry = { url: e.url, file: e.file, source: e.source };
    if (e.iconUrl) out.iconUrl = e.iconUrl;
    if (e.width) out.width = e.width;
    if (e.height) out.height = e.height;
    ordered[id] = out;
  }
  return JSON.stringify(ordered, null, 2) + "\n";
}

/** An entry is usable only if its icon file still exists on disk. */
function entryUsable(e: AppIconSnapshotEntry): boolean {
  return fs.existsSync(path.join(ROOT, "public", e.file.replace(/^\//, "")));
}

/** Write bytes only when they differ — keeps `git status` quiet across runs. */
function writeIfChanged(file: string, bytes: Uint8Array): boolean {
  try {
    const prev = fs.readFileSync(file);
    if (prev.length === bytes.length && prev.equals(Buffer.from(bytes))) return false;
  } catch {
    // Missing file — first write.
  }
  fs.writeFileSync(file, bytes);
  return true;
}

interface ResolveResult {
  entry?: AppIconSnapshotEntry;
  /** Bytes to write (absent for site-local manual icons). */
  bytes?: Uint8Array;
  error?: string;
}

/** Resolve one app to its icon entry (+ bytes when downloaded). */
async function resolve(app: AppLink): Promise<ResolveResult> {
  // Manual site-local override: point at an existing file under /public.
  if (app.icon?.startsWith("/")) {
    const local = path.join(ROOT, "public", app.icon.replace(/^\//, ""));
    let sniffed;
    try {
      sniffed = sniffImage(new Uint8Array(fs.readFileSync(local)), null);
    } catch {
      return { error: `manual icon not found under public/: ${app.icon}` };
    }
    return {
      entry: {
        url: app.url,
        file: app.icon,
        source: "manual",
        width: sniffed?.width,
        height: sniffed?.height,
      },
    };
  }

  // Manual remote override: fetch exactly that URL, skip discovery.
  if (app.icon) {
    const icon = await fetchIcon(app.icon);
    if (!icon) return { error: `manual icon failed to download: ${app.icon}` };
    return {
      bytes: icon.bytes,
      entry: {
        url: app.url,
        file: `/app-icons/${app.id}.${icon.ext}`,
        source: "manual",
        iconUrl: app.icon,
        width: icon.width,
        height: icon.height,
      },
    };
  }

  // Discovery: try candidates in declared-preference order, first image wins.
  const discovery = await discoverAppIcon(app.url);
  const failures: string[] = [];
  for (const candidate of discovery.candidates) {
    const icon = await fetchIcon(candidate.url);
    if (!icon) {
      failures.push(candidate.url);
      continue;
    }
    return {
      bytes: icon.bytes,
      entry: {
        url: app.url,
        file: `/app-icons/${app.id}.${icon.ext}`,
        source: candidate.source,
        iconUrl: candidate.url,
        width: icon.width,
        height: icon.height,
      },
    };
  }
  const page = discovery.ok ? "page reachable" : `page: ${discovery.error}`;
  return { error: `no fetchable icon (${page}; tried ${failures.length} candidate(s))` };
}

/** Concurrency cap — same rationale as og-snapshot. */
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

// --- Check mode: filesystem-only validation ----------------------------------

function check(apps: AppLink[], snapshot: AppIconSnapshot): void {
  const log = (s: string) => process.stdout.write(s + "\n");
  const problems: string[] = [];

  for (const app of apps) {
    const entry = snapshot[app.id];
    if (!entry) {
      problems.push(`"${app.id}" has no snapshot entry`);
      continue;
    }
    if (entry.url !== app.url)
      problems.push(`"${app.id}" URL changed (snapshot has ${entry.url})`);
    if (!entryUsable(entry))
      problems.push(`"${app.id}" icon file missing: ${entry.file}`);
  }
  const ids = new Set(apps.map((a) => a.id));
  for (const id of Object.keys(snapshot)) {
    if (!ids.has(id)) problems.push(`stale snapshot entry "${id}" (not in apps.json)`);
  }

  log("");
  log("App-icon snapshot (check)");
  log("─".repeat(48));
  if (problems.length) {
    for (const p of problems) log(`  ✗ ${p}`);
    log("✗ Snapshot is out of date. Run `pnpm apps:snapshot` and commit.");
    process.exit(1);
  }
  log(`  ✓ ${apps.length} app(s) covered.`);
  log("✓ Snapshot is up to date.");
}

// --- Main --------------------------------------------------------------------

async function main() {
  const apps = readApps();
  const { snapshot: existing, raw: prevStr } = readSnapshot();

  if (CHECK) {
    check(apps, existing);
    return;
  }

  fs.mkdirSync(ICONS_DIR, { recursive: true });

  const results = await mapWithLimit(apps, CRAWL_CONCURRENCY, resolve);

  const next: AppIconSnapshot = {};
  const added: string[] = [];
  const updated: string[] = [];
  const unchanged: string[] = [];
  const keptOnFailure: string[] = [];
  const missing: { id: string; reason: string }[] = [];

  for (let i = 0; i < apps.length; i++) {
    const app = apps[i];
    const { entry, bytes, error } = results[i];

    if (!entry) {
      const prev = existing[app.id];
      if (prev && entryUsable(prev)) {
        next[app.id] = prev; // preserve good prior icon
        keptOnFailure.push(`${app.id} (${error})`);
      } else {
        missing.push({ id: app.id, reason: error ?? "unknown" });
      }
      continue;
    }

    let fileChanged = false;
    if (bytes) {
      const target = path.join(ROOT, "public", entry.file.replace(/^\//, ""));
      fileChanged = writeIfChanged(target, bytes);
      // A format change (e.g. png → svg) leaves the old extension behind.
      const stale = fs
        .readdirSync(ICONS_DIR)
        .filter((f) => f.startsWith(`${app.id}.`) && `/app-icons/${f}` !== entry.file);
      for (const f of stale) fs.unlinkSync(path.join(ICONS_DIR, f));
    }

    next[app.id] = entry;
    const prev = existing[app.id];
    if (!prev) added.push(`${app.id} ← ${entry.iconUrl ?? entry.file} (${entry.source})`);
    else if (fileChanged || JSON.stringify(prev) !== JSON.stringify(next[app.id]))
      updated.push(`${app.id} ← ${entry.iconUrl ?? entry.file} (${entry.source})`);
    else unchanged.push(app.id);
  }

  // Prune icons for apps that left the config (generated artifacts, safe).
  const keepFiles = new Set(
    Object.values(next)
      .map((e) => path.basename(e.file))
      .filter((f) => fs.existsSync(path.join(ICONS_DIR, f))),
  );
  const pruned: string[] = [];
  for (const f of fs.readdirSync(ICONS_DIR)) {
    if (!keepFiles.has(f)) {
      fs.unlinkSync(path.join(ICONS_DIR, f));
      pruned.push(f);
    }
  }

  const nextStr = serialize(next);

  // --- Report ---------------------------------------------------------------
  const log = (s: string) => process.stdout.write(s + "\n");
  log("");
  log("App-icon snapshot (write)");
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
  line("pruned files", pruned);
  if (unchanged.length) log(`  unchanged: ${unchanged.length}`);
  if (missing.length) {
    log(`  ✗ MISSING (${missing.length}) — add a manual \`icon\` in apps.json:`);
    for (const m of missing) log(`    • ${m.id} — ${m.reason}`);
  }
  log("");

  if (nextStr !== prevStr) {
    fs.writeFileSync(SNAPSHOT_PATH, nextStr);
    log(`✓ Wrote ${path.relative(ROOT, SNAPSHOT_PATH)}.`);
  } else {
    log("✓ No changes — snapshot already current.");
  }

  // An app with no fetchable icon and no manual override is a hard error:
  // the shelf would render a blank tile. Same loudness as og-snapshot.
  if (missing.length) {
    log(`✗ ${missing.length} app(s) have no icon.`);
    log(`  Add "icon": "/img/…" or "icon": "https://…" to that app in content/apps.json.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("app-icon-snapshot failed:", err);
  process.exit(1);
});
