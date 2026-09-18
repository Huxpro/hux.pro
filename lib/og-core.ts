/**
 * Open Graph crawl + parse — framework-agnostic core.
 *
 * This module holds the *single* implementation of "fetch a URL and pull out
 * its OG/Twitter-card metadata". It is intentionally free of any Next.js or
 * React imports so it can be used identically by:
 *   - the runtime Server Action (`lib/og.ts`), and
 *   - the build-time snapshot script (`scripts/og-snapshot.ts`).
 *
 * Sharing one parser is what makes "the snapshot equals what the server would
 * crawl" true by construction, so drift detection compares like with like.
 */

/**
 * Whether a page lets another origin frame it. `"deny"` is the only value
 * worth storing: a page with no `X-Frame-Options` and no `frame-ancestors`
 * is framable by default, and "not checked" is treated the same way.
 */
export type FramePolicy = "allow" | "deny";

/** The metadata fields a link preview is built from (sans the source URL). */
export interface OGFields {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  /** See {@link FramePolicy}. Only `"deny"` is ever persisted. */
  frame?: FramePolicy;
}

export interface OGData extends OGFields {
  url: string;
}

/** A snapshot entry is just the cached OG fields, keyed by URL elsewhere. */
export type SnapshotEntry = OGFields;

export interface OGFetchResult {
  /** True when the page was fetched successfully (HTTP 2xx). A 200 with no
   *  OG tags is still `ok: true` — we reached the page. Only network errors
   *  and non-2xx responses (e.g. Medium's 403) are `ok: false`. */
  ok: boolean;
  /** HTTP status when a response came back, else undefined (network error). */
  status?: number;
  /** Failure reason, present only when `ok` is false. */
  error?: string;
  /** Parsed metadata. On failure this carries only `{ siteName, url }`. */
  data: OGData;
  /**
   * Whether the page may be framed, read from the response headers. Present
   * whenever a response came back at all — a 403 still says `SAMEORIGIN`,
   * which is how Medium's refusal to be crawled still tells us it refuses
   * to be framed.
   */
  frame?: FramePolicy;
}

/** The origin an in-app browser window would frame the page from. */
const SITE_ORIGIN = "https://hux.pro";

/**
 * Read a page's framing policy from its headers, the way the browser will
 * when the window system puts it in an iframe. `frame-ancestors` wins over
 * `X-Frame-Options` where both are present, as the CSP spec says it must.
 */
export function framePolicyFromHeaders(headers: Headers): FramePolicy {
  const csp = headers.get("content-security-policy") ?? "";
  const ancestors = csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => /^frame-ancestors\b/i.test(d));
  if (ancestors) {
    const sources = ancestors.split(/\s+/).slice(1).map((s) => s.toLowerCase());
    const allowed = sources.some(
      (s) =>
        s === "*" ||
        s === "https:" ||
        s === SITE_ORIGIN ||
        s === "hux.pro" ||
        s === "*.hux.pro" ||
        s === "https://*.hux.pro",
    );
    return allowed ? "allow" : "deny";
  }
  const xfo = headers.get("x-frame-options")?.trim().toUpperCase();
  if (xfo === "DENY" || xfo === "SAMEORIGIN") return "deny";
  return "allow";
}

/**
 * User-Agent used to fetch link previews.
 *
 * Many sites (Medium, X, etc.) gate their server-rendered HTML — and the
 * Open Graph / Twitter Card tags that come with it — behind bot detection,
 * returning 403 to a generic or unknown agent while serving the full markup
 * to recognized link-unfurling crawlers. We identify as one of those so the
 * same preview a Slack/Twitter/Facebook unfurl would get is available to us.
 * (A plain "OGBot/1.0" or a vanilla desktop-browser UA both get a 403 from
 * Medium — which is why the Medium link previewed as a bare domain before.)
 */
const CRAWLER_USER_AGENT =
  "Mozilla/5.0 (compatible; Slackbot-LinkExpanding 1.0; +https://api.slack.com/robots)";

/**
 * If `url` is a Wayback Machine snapshot
 * (`web.archive.org/web/{timestamp}[flags]/{originalURL}`), return the parsed
 * parts; otherwise null.
 *
 * Used to "look through" archived URLs so the displayed domain and the
 * archived treatment match the original source, not `web.archive.org`. The
 * fetched HTML itself is unaffected — Wayback preserves the original
 * `<meta>` tags verbatim, so OG parsing already returns the original
 * title/description; only the hostname needs unwrapping.
 */
export function parseWaybackUrl(
  url: string,
): { timestamp: string; original: string } | null {
  // /web/{14-digit-timestamp}{flags?}/{original-url}. Flags are 0–3 lowercase
  // letters + optional underscore (e.g. `if_`, `im_`, `id_`).
  const m = url.match(
    /^https?:\/\/web\.archive\.org\/web\/(\d{14})[a-z_]{0,4}\/(.+)$/,
  );
  if (!m) return null;
  return { timestamp: m[1], original: m[2] };
}

/** True when `url` is a Wayback Machine snapshot. */
export function isArchivedUrl(url: string): boolean {
  return parseWaybackUrl(url) !== null;
}

/**
 * Bare hostname (no leading `www.`), or undefined for a non-URL string.
 *
 * Wayback URLs are unwrapped first so a snapshot of `https://2017.jsconf.cn/en/`
 * reports `2017.jsconf.cn`, not `web.archive.org`.
 */
export function getHostname(url: string): string | undefined {
  const wb = parseWaybackUrl(url);
  const target = wb?.original ?? url;
  try {
    return new URL(target).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/** Hostname for display, falling back to the raw URL string when unparseable. */
export function getDomainLabel(url: string): string {
  return getHostname(url) ?? url;
}

/**
 * True when a link points at a talk-recording host — a page that IS a video
 * even though we render it as an OG card (no embeddable iframe / derivable
 * cover, unlike YouTube/Bilibili). Used to give such cards a "video-ish" play
 * affordance so a GitNation talk reads like the recording it is.
 */
const VIDEO_LINK_HOSTS = ["gitnation.com"];
export function isVideoLinkHost(url: string): boolean {
  const host = getHostname(url)?.toLowerCase();
  if (!host) return false;
  return VIDEO_LINK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * Fetch and parse Open Graph metadata from a URL.
 *
 * Never throws — failures are reported via `ok: false` so callers can decide
 * how to recover (the snapshot script, for instance, keeps prior good data
 * and flags the URL for a manual `preview`).
 *
 * @param url        Target URL.
 * @param revalidate Optional Next.js Data Cache TTL (seconds). Ignored by the
 *                   plain Node fetch used in the snapshot script.
 */
export async function fetchOG(
  url: string,
  revalidate?: number,
): Promise<OGFetchResult> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": CRAWLER_USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        // Prefer English markup — some sites (e.g. web.dev) localize OG tags
        // by Accept-Language and would otherwise return the datacenter
        // region's default locale.
        "Accept-Language": "en-US,en;q=0.9",
      },
      // `next` is a Next.js fetch extension; plain Node fetch ignores it.
      ...(revalidate !== undefined
        ? { next: { revalidate } as { revalidate: number } }
        : {}),
    } as RequestInit);

    const policy = framePolicyFromHeaders(response.headers);

    if (!response.ok) {
      // A refusal to be crawled is a page too, and its headers still say
      // whether it may be framed — Medium's 403 carries `SAMEORIGIN`. But a
      // bot wall with no policy header says nothing about the real page, so
      // only an explicit refusal is trusted from a failed fetch.
      return {
        ok: false,
        status: response.status,
        error: `HTTP ${response.status}`,
        data: { siteName: getHostname(url), url },
        frame: policy === "deny" ? "deny" : undefined,
      };
    }

    const html = await response.text();
    return {
      ok: true,
      status: response.status,
      data: parseOG(html, url),
      frame: policy,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      data: { siteName: getHostname(url), url },
    };
  }
}

/**
 * Parse OG/Twitter-card metadata out of an HTML string.
 * Lightweight regex extraction — no external HTML parser needed.
 */
export function parseOG(html: string, url: string): OGData {
  const getMetaContent = (property: string): string | undefined => {
    const patterns = [
      // og:property (property before content, and content before property)
      `<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']+)["']`,
      `<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${property}["']`,
      // twitter:property (both attribute orders)
      `<meta[^>]*name=["']twitter:${property}["'][^>]*content=["']([^"']+)["']`,
      `<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:${property}["']`,
    ];
    for (const p of patterns) {
      const m = html.match(new RegExp(p, "i"));
      if (m) return decodeHTMLEntities(m[1]);
    }
    return undefined;
  };

  // Title: og/twitter, else <title>
  let title = getMetaContent("title");
  if (!title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) title = decodeHTMLEntities(titleMatch[1].trim());
  }

  // Description: og/twitter, else <meta name="description">
  let description = getMetaContent("description");
  if (!description) {
    const descMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
    );
    if (descMatch) description = decodeHTMLEntities(descMatch[1]);
  }

  const image = getMetaContent("image");
  const siteName = getMetaContent("site_name") || getHostname(url);

  return {
    title,
    description,
    image: image ? resolveUrl(image, url) : undefined,
    siteName,
    url,
  };
}

/**
 * Decode HTML entities in a string.
 *
 * Covers the named entities common in OG/title text (including `&nbsp;`,
 * which web.dev embeds in its title and which previously rendered as a
 * literal "&nbsp;|&nbsp;") plus decimal and hex numeric references.
 */
export function decodeHTMLEntities(str: string): string {
  const named: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&nbsp;": " ",
    "&mdash;": "—",
    "&ndash;": "–",
    "&hellip;": "…",
  };

  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(
      /&(?:amp|lt|gt|quot|apos|nbsp|mdash|ndash|hellip);/g,
      (m) => named[m] ?? m,
    );
}

// =============================================================================
// Media → card classification (shared by runtime + snapshot script)
//
// These live here (rather than next to the media kinds in lib/log.ts) so they
// stay free of framework imports and can run inside the Node snapshot script.
// =============================================================================

/** Social platforms that render as native widgets (no OG card needed). */
export type SocialEmbedPlatform = "twitter" | "x" | "instagram" | "tiktok";

/**
 * Detect a social-embed platform from a URL or an explicit platform hint.
 * Used by the editor / renderer to auto-classify a pasted URL when the author
 * hasn't picked a platform.
 */
export function detectSocialEmbedPlatform(
  urlOrPlatform: string,
): SocialEmbedPlatform | null {
  const v = urlOrPlatform.toLowerCase();
  // Explicit platform hint
  if (v === "x") return "x";
  if (v === "twitter") return "twitter";
  if (v === "instagram") return "instagram";
  if (v === "tiktok") return "tiktok";
  // URL host
  const host = getHostname(urlOrPlatform);
  if (host) {
    if (host === "x.com" || host.endsWith(".x.com")) return "x";
    if (host === "twitter.com" || host.endsWith(".twitter.com"))
      return "twitter";
    if (host === "instagram.com" || host.endsWith(".instagram.com"))
      return "instagram";
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  }
  return null;
}

/** Minimal structural shape of a media item (works for typed Media or raw JSON). */
export interface PreviewableMedia {
  kind: string;
  url: string;
  present?: string;
  platform?: string;
  preview?: { title?: string; description?: string; image?: string };
  thumbnail?: string;
}

/**
 * True when a media item renders as an OG-style card on the /works timeline —
 * i.e. a `link` media with `present: "card"`. Cards are exactly what the
 * card pipeline (snapshot + manual override + live fallback) serves; pills
 * and social widgets and video players are out of scope.
 */
export function mediaIsCardTarget(m: PreviewableMedia): boolean {
  return m.kind === "link" && m.present === "card";
}

/**
 * True when a card target needs a *live crawl* to build its preview.
 * A complete manual `preview` (title + image) is authoritative and skips the
 * crawl entirely — the recovery path for sites that block crawling.
 */
export function mediaNeedsLiveCrawl(m: PreviewableMedia): boolean {
  if (!mediaIsCardTarget(m)) return false;
  const manualComplete = !!(m.preview?.title && m.preview?.image);
  return !manualComplete;
}

// =============================================================================
// Video covers (Bilibili / Vimeo) — derived at build time, snapshot-cached
//
// YouTube covers are derivable from the video ID at runtime
// (`img.youtube.com/vi/{id}/maxresdefault.jpg`) so they don't need a snapshot.
// Bilibili and Vimeo need an API call: Bilibili's `view` endpoint and Vimeo's
// oEmbed. We do that once at build time so /works has zero runtime dependency
// on third-party APIs for its covers — same shape as the card pipeline.
// =============================================================================

/**
 * Extract a Bilibili BV ID from a Bilibili video URL. Returns null when the
 * URL doesn't look like a Bilibili video page.
 */
export function extractBilibiliBvid(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.toLowerCase().endsWith("bilibili.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const videoIdx = parts.indexOf("video");
    if (videoIdx < 0) return null;
    const raw = parts[videoIdx + 1]?.trim();
    if (raw && /^BV[0-9A-Za-z]+$/.test(raw)) return raw;
    return null;
  } catch {
    return null;
  }
}

/** Extract a numeric Vimeo video ID from a vimeo.com URL. */
export function extractVimeoVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.toLowerCase().endsWith("vimeo.com")) return null;
    const m = u.pathname.match(/\/(\d+)(?:[/?#]|$)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** Result of a video-cover fetch. Same `ok/error` shape as `fetchOG`. */
export interface VideoCoverResult {
  ok: boolean;
  image?: string;
  error?: string;
}

/**
 * Fetch the cover image URL for a Bilibili video, by BV ID.
 *
 * Public web API; no auth. We send a browser-ish User-Agent because Bilibili's
 * edge sometimes drops requests with the default Node fetch UA.
 */
export async function fetchBilibiliCover(
  bvid: string,
): Promise<VideoCoverResult> {
  try {
    const r = await fetch(
      `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://www.bilibili.com/",
        },
      },
    );
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    const json = (await r.json()) as { code?: number; data?: { pic?: string } };
    if (json.code !== 0) return { ok: false, error: `bilibili code ${json.code}` };
    const pic = json.data?.pic;
    if (!pic) return { ok: false, error: "no pic in payload" };
    // Normalize to https so the browser doesn't block mixed content.
    return { ok: true, image: pic.replace(/^http:\/\//, "https://") };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Fetch the cover image URL for a Vimeo video via the public oEmbed endpoint. */
export async function fetchVimeoCover(url: string): Promise<VideoCoverResult> {
  try {
    const r = await fetch(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
    );
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    const json = (await r.json()) as { thumbnail_url?: string };
    if (!json.thumbnail_url) return { ok: false, error: "no thumbnail_url" };
    return {
      ok: true,
      image: json.thumbnail_url.replace(/^http:\/\//, "https://"),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * True when a media item is a *video cover target* — i.e. needs an API call
 * at build time to resolve its cover. YouTube is intentionally excluded: its
 * cover is derivable from the video ID at runtime, so snapshotting it would
 * be redundant churn.
 */
export function mediaIsVideoCoverTarget(m: PreviewableMedia): boolean {
  if (m.kind !== "video") return false;
  return m.platform === "bilibili" || m.platform === "vimeo";
}

/**
 * True when a video cover target needs the API to be hit at build time.
 * A manually-set `thumbnail` is authoritative and skips the API call.
 */
export function mediaNeedsCoverCrawl(m: PreviewableMedia): boolean {
  if (!mediaIsVideoCoverTarget(m)) return false;
  return !m.thumbnail;
}

/** Dispatch to the right per-platform fetcher for a video URL. */
export async function fetchVideoCover(
  m: PreviewableMedia,
): Promise<VideoCoverResult> {
  if (m.platform === "bilibili") {
    const bvid = extractBilibiliBvid(m.url);
    if (!bvid) return { ok: false, error: "could not parse BV ID" };
    return fetchBilibiliCover(bvid);
  }
  if (m.platform === "vimeo") {
    if (!extractVimeoVideoId(m.url))
      return { ok: false, error: "could not parse Vimeo ID" };
    return fetchVimeoCover(m.url);
  }
  return { ok: false, error: `unsupported platform ${m.platform}` };
}

// =============================================================================
// URL helpers
// =============================================================================

/** Resolve a possibly-relative image URL to absolute. */
export function resolveUrl(imageUrl: string, baseUrl: string): string {
  try {
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      return imageUrl;
    }
    if (imageUrl.startsWith("//")) {
      return `https:${imageUrl}`;
    }
    return new URL(imageUrl, baseUrl).href;
  } catch {
    return imageUrl;
  }
}
