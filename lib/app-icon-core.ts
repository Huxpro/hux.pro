/**
 * Web-app icon discovery — framework-agnostic core.
 *
 * Given a URL, find the icon that site *itself* declares for home-screen /
 * installed-app use, the way a mobile OS would when you "Add to Home Screen":
 *
 *   1. Web-app manifest icons (`<link rel="manifest">` → `icons[]`) — the
 *      literal "web app icon" declaration, usually the largest art available.
 *   2. `<link rel="apple-touch-icon">` — designed for exactly this use.
 *   3. `<link rel="icon">` — the ordinary favicon, largest declared size.
 *   4. Undeclared-but-conventional fallbacks: `/apple-touch-icon.png` (Safari
 *      probes this path even when undeclared) and `/favicon.ico`.
 *
 * Like `lib/og-core.ts`, this module is intentionally free of Next.js/React
 * imports so the build-time snapshot script (`scripts/app-icon-snapshot.ts`)
 * can drive it from plain Node. Nothing here touches the filesystem — callers
 * decide where bytes land.
 */

// Same crawler UA as og-core: some sites gate their server-rendered HTML
// behind bot detection but serve link-unfurling crawlers the full markup.
const CRAWLER_USER_AGENT =
  "Mozilla/5.0 (compatible; Slackbot-LinkExpanding 1.0; +https://api.slack.com/robots)";

export type AppIconSource =
  | "manifest"
  | "apple-touch-icon"
  | "icon"
  | "favicon.ico"
  | "manual";

export interface AppIconCandidate {
  /** Absolute URL of the icon file. */
  url: string;
  /** Where the declaration came from — drives try-order priority. */
  source: AppIconSource;
  /** Largest declared dimension (px); 0 when the markup doesn't say. */
  declaredSize: number;
}

/** Priority of each source when picking which candidate to try first. */
const SOURCE_PRIORITY: Record<AppIconSource, number> = {
  manual: 5,
  manifest: 4,
  "apple-touch-icon": 3,
  icon: 2,
  "favicon.ico": 1,
};

// -----------------------------------------------------------------------------
// HTML parsing
// -----------------------------------------------------------------------------

/** Resolve a possibly-relative URL against a base; null when unparseable. */
function absolutize(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

/** Parse a `sizes` attribute ("180x180", "48x48 96x96", "any") → largest px. */
export function parseSizesAttr(sizes: string | undefined): number {
  if (!sizes) return 0;
  const v = sizes.trim().toLowerCase();
  // "any" is the vector case — treat as large so SVGs rank above tiny rasters.
  if (v === "any") return 512;
  let max = 0;
  for (const token of v.split(/\s+/)) {
    const m = token.match(/^(\d+)x(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10), parseInt(m[2], 10));
  }
  return max;
}

/** Extract one attribute's value out of a single HTML tag string. */
function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m ? m[1] : undefined;
}

export interface ParsedIconLinks {
  candidates: AppIconCandidate[];
  /** Absolute URL of the web-app manifest, when the page declares one. */
  manifestUrl?: string;
}

/**
 * Scan a page's `<link>` tags for icon declarations and a manifest reference.
 * Regex extraction, same trade-off as og-core: no HTML parser dependency.
 */
export function parseIconLinks(html: string, baseUrl: string): ParsedIconLinks {
  const candidates: AppIconCandidate[] = [];
  let manifestUrl: string | undefined;

  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attr(tag, "rel")?.toLowerCase();
    const href = attr(tag, "href");
    if (!rel || !href) continue;
    const tokens = rel.split(/\s+/);

    if (tokens.includes("manifest")) {
      manifestUrl ??= absolutize(href, baseUrl) ?? undefined;
      continue;
    }

    // mask-icon is a monochrome Safari pinned-tab glyph — never a tile icon.
    if (tokens.includes("mask-icon")) continue;

    const isAppleTouch = tokens.some((t) =>
      /^apple-touch-icon(-precomposed)?$/.test(t),
    );
    const isIcon = tokens.includes("icon");
    if (!isAppleTouch && !isIcon) continue;

    const url = absolutize(href, baseUrl);
    if (!url) continue;

    candidates.push({
      url,
      source: isAppleTouch ? "apple-touch-icon" : "icon",
      // Undeclared apple-touch icons are 180px by convention.
      declaredSize: parseSizesAttr(attr(tag, "sizes")) || (isAppleTouch ? 180 : 0),
    });
  }

  return { candidates, manifestUrl };
}

// -----------------------------------------------------------------------------
// Web-app manifest parsing
// -----------------------------------------------------------------------------

interface ManifestIcon {
  src?: string;
  sizes?: string;
  purpose?: string;
}

/** Turn a fetched manifest JSON into icon candidates (relative to its URL). */
export function parseManifestIcons(
  manifest: unknown,
  manifestUrl: string,
): AppIconCandidate[] {
  const icons = (manifest as { icons?: ManifestIcon[] })?.icons;
  if (!Array.isArray(icons)) return [];
  const out: AppIconCandidate[] = [];
  for (const icon of icons) {
    if (!icon?.src) continue;
    // Monochrome icons are template glyphs, not the app's tile art.
    if (icon.purpose?.toLowerCase().split(/\s+/).includes("monochrome")) continue;
    const url = absolutize(icon.src, manifestUrl);
    if (!url) continue;
    out.push({ url, source: "manifest", declaredSize: parseSizesAttr(icon.sizes) });
  }
  return out;
}

// -----------------------------------------------------------------------------
// Candidate ranking
// -----------------------------------------------------------------------------

/**
 * Order candidates into the sequence to *try*: by source priority, then by
 * declared size (largest first), deduped by URL keeping the best-ranked entry.
 * Downloads happen in this order and the first valid image wins.
 */
export function rankCandidates(
  candidates: AppIconCandidate[],
): AppIconCandidate[] {
  const sorted = [...candidates].sort(
    (a, b) =>
      SOURCE_PRIORITY[b.source] - SOURCE_PRIORITY[a.source] ||
      b.declaredSize - a.declaredSize,
  );
  const seen = new Set<string>();
  return sorted.filter((c) => !seen.has(c.url) && seen.add(c.url));
}

// -----------------------------------------------------------------------------
// Discovery (network)
// -----------------------------------------------------------------------------

export interface AppIconDiscovery {
  /** True when the page itself was reachable (candidates may still be empty). */
  ok: boolean;
  error?: string;
  /** Candidates in try-order — includes conventional fallback probes. */
  candidates: AppIconCandidate[];
}

/**
 * Fetch a page and produce the ordered icon-candidate list for it.
 * Never throws — failures surface as `ok: false` plus fallback probes only.
 */
export async function discoverAppIcon(url: string): Promise<AppIconDiscovery> {
  // Conventional locations exist even when discovery fails outright.
  const probes: AppIconCandidate[] = [];
  const appleProbe = absolutize("/apple-touch-icon.png", url);
  if (appleProbe)
    probes.push({ url: appleProbe, source: "apple-touch-icon", declaredSize: 0 });
  const icoProbe = absolutize("/favicon.ico", url);
  if (icoProbe)
    probes.push({ url: icoProbe, source: "favicon.ico", declaredSize: 0 });

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": CRAWLER_USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}`,
        candidates: rankCandidates(probes),
      };
    }

    const html = await response.text();
    const { candidates, manifestUrl } = parseIconLinks(html, response.url || url);

    if (manifestUrl) {
      try {
        const r = await fetch(manifestUrl, {
          headers: { "User-Agent": CRAWLER_USER_AGENT, Accept: "application/json" },
        });
        if (r.ok) candidates.push(...parseManifestIcons(await r.json(), manifestUrl));
      } catch {
        // Manifest fetch failing just removes those candidates.
      }
    }

    // A declared apple-touch-icon makes the probe at the same path redundant,
    // but rankCandidates dedupes by URL so appending both is harmless.
    return { ok: true, candidates: rankCandidates([...candidates, ...probes]) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      candidates: rankCandidates(probes),
    };
  }
}

// -----------------------------------------------------------------------------
// Icon download + validation
// -----------------------------------------------------------------------------

export interface FetchedIcon {
  bytes: Uint8Array;
  /** File extension inferred from the magic bytes ("png", "svg", "ico", …). */
  ext: string;
  /** Intrinsic pixel size; undefined for vectors / unparsed formats. */
  width?: number;
  height?: number;
}

/**
 * Download one candidate and verify it's really an image (404 pages served as
 * 200 + HTML are common for the conventional-path probes). Returns null on
 * any failure so the caller simply tries the next candidate.
 */
export async function fetchIcon(url: string): Promise<FetchedIcon | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": CRAWLER_USER_AGENT, Accept: "image/*,*/*;q=0.8" },
    });
    if (!r.ok) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.length < 64) return null; // tracking pixels / empty responses
    const sniffed = sniffImage(bytes, r.headers.get("content-type"));
    if (!sniffed) return null;
    return { bytes, ...sniffed };
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Image sniffing (magic bytes → format + dimensions)
//
// Compact per-format header readers, same approach as lib/image-meta.ts (which
// is `server-only` and reads from /public, so it can't be shared with this
// plain-Node module). ICO and SVG are added because favicons ship in both.
// -----------------------------------------------------------------------------

export interface SniffedImage {
  ext: string;
  width?: number;
  height?: number;
}

export function sniffImage(
  bytes: Uint8Array,
  contentType: string | null,
): SniffedImage | null {
  const buf = bytes;

  // PNG — IHDR width/height at byte 16/20 (big-endian u32).
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { ext: "png", width: readU32BE(buf, 16), height: readU32BE(buf, 20) };
  }

  // ICO — reserved 0, type 1; each 16-byte dir entry stores w/h (0 → 256).
  if (buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0) {
    const count = buf[4] | (buf[5] << 8);
    let width = 0;
    let height = 0;
    for (let i = 0; i < count; i++) {
      const off = 6 + i * 16;
      if (off + 16 > buf.length) break;
      const w = buf[off] || 256;
      const h = buf[off + 1] || 256;
      if (w * h > width * height) {
        width = w;
        height = h;
      }
    }
    return { ext: "ico", width: width || undefined, height: height || undefined };
  }

  // GIF — logical screen size at byte 6/8 (little-endian u16).
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return {
      ext: "gif",
      width: buf[6] | (buf[7] << 8),
      height: buf[8] | (buf[9] << 8),
    };
  }

  // JPEG / WebP — possible but rare for icons; format is enough (the renderer
  // only needs dimensions for the fill-vs-fit call, and falls back to "fit").
  if (buf[0] === 0xff && buf[1] === 0xd8) return { ext: "jpg" };
  if (
    ascii(buf, 0, 4) === "RIFF" &&
    ascii(buf, 8, 12) === "WEBP"
  ) {
    return { ext: "webp" };
  }

  // SVG — text that parses as markup containing an <svg> root.
  const isSvgType = contentType?.includes("svg") ?? false;
  const head = ascii(buf, 0, Math.min(buf.length, 1024));
  if (isSvgType || (/^\s*(<\?xml|<!doctype|<svg)/i.test(head) && /<svg[\s>]/i.test(head))) {
    return { ext: "svg" };
  }

  return null;
}

function readU32BE(buf: Uint8Array, off: number): number {
  return ((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]) >>> 0;
}

function ascii(buf: Uint8Array, start: number, end: number): string {
  let s = "";
  for (let i = start; i < end && i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return s;
}

// -----------------------------------------------------------------------------
// Snapshot shapes (shared by the script and the UI)
// -----------------------------------------------------------------------------

/**
 * How an app runs inside a chrome window:
 *   - "web"  — an ordinary web page, loaded in an `<iframe>`.
 *   - "lynx" — a Lynx app bundle (`.web.bundle`), rendered by `@lynx-js/web-core`'s
 *              `<lynx-view>` element (a "Lynx Player").
 */
export type AppRuntime = "web" | "lynx";

/**
 * The authoring framework behind a Lynx bundle. Purely cosmetic here — it tints
 * the little Lynx badge on the app icon so React-Lynx and Vue-Lynx apps read
 * apart at a glance. Ignored for `runtime: "web"`.
 */
export type AppFlavor = "react" | "vue";

/** One app-link as authored in `content/apps.json`. */
export interface AppLink {
  /** Stable id — also the icon's filename under /app-icons/. */
  id: string;
  /** Display label under the tile. */
  title: string;
  /**
   * Canonical destination. For `runtime: "web"` it's the page the window
   * iframes; for either runtime it's the "Open externally" target and the URL
   * the build-time icon snapshot resolves the tile art from.
   */
  url: string;
  /**
   * What opens when the icon is tapped. Defaults to `"web"` (an iframe window).
   * `"lynx"` opens the Lynx Player pointed at {@link bundleUrl}.
   */
  runtime?: AppRuntime;
  /** Lynx authoring framework — badge tint only. See {@link AppFlavor}. */
  flavor?: AppFlavor;
  /**
   * For `runtime: "lynx"`: the `.web.bundle` the player loads.
   *   - a site-local `/…` path → a **built-in** (offline) bundle from /public
   *   - an `http(s)://…` URL   → an **online** bundle fetched at open time
   * Falls back to {@link url} when omitted.
   */
  bundleUrl?: string;
  /**
   * Preferred window size preset when the app opens. Defaults to `portrait`
   * for Lynx apps and `landscape` for web apps. Must stay in sync with
   * `SizePreset` in `systems/windows/lib/geometry.ts`.
   */
  size?: "portrait" | "landscape" | "max";
  /**
   * Manual icon override — the recovery path for sites whose declared icon is
   * wrong or unfetchable (same philosophy as og-snapshot's manual `preview`).
   * A site-local `/…` path is used as-is; an `http(s)` URL is downloaded.
   */
  icon?: string;
}

/** One resolved entry in `content/app-icons.json`, keyed by app id. */
export interface AppIconSnapshotEntry {
  /** The app URL the icon was resolved from (staleness detection). */
  url: string;
  /** Site-local path under /public where the icon was written. */
  file: string;
  /** Which declaration won. */
  source: AppIconSource;
  /** Remote URL the bytes came from (absent for site-local manual icons). */
  iconUrl?: string;
  /** Intrinsic pixel size — lets the renderer choose full-bleed vs padded. */
  width?: number;
  height?: number;
}

export type AppIconSnapshot = Record<string, AppIconSnapshotEntry>;

// -----------------------------------------------------------------------------
// App-model derivations (single source for label / icon resolution)
// -----------------------------------------------------------------------------

/**
 * Human runtime label for an app — the one string every surface shows for
 * "how it runs" (window menu, ⌘K, the badge's aria-label). Flavour is only a
 * tint elsewhere, but it names the label here so React-Lynx and Vue-Lynx read
 * apart. Single source so the badge, menu, and palette never drift.
 */
export function runtimeLabel(app: Pick<AppLink, "runtime" | "flavor">): string {
  if ((app.runtime ?? "web") === "lynx") {
    return app.flavor === "vue" ? "Lynx · Vue" : "Lynx · React";
  }
  return "Web";
}

/**
 * Resolve the tile-art `src` for an app: the build-time snapshot wins, then a
 * manual `icon` override, then a per-runtime fallback (the Lynx mark for Lynx
 * apps). Callers that need the snapshot *entry* itself (e.g. full-bleed vs
 * padded sizing) should read the snapshot directly.
 */
export function resolveAppIconSrc(
  app: AppLink,
  snapshot: AppIconSnapshot,
): string | undefined {
  return (
    snapshot[app.id]?.file ??
    app.icon ??
    (app.runtime === "lynx" ? "/app-icons/lynx.png" : undefined)
  );
}
