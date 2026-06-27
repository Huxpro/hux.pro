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

export interface OGData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  url: string;
}

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
export const CRAWLER_USER_AGENT =
  "Mozilla/5.0 (compatible; Slackbot-LinkExpanding 1.0; +https://api.slack.com/robots)";

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
  const siteNameFromHost = (): string | undefined => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return undefined;
    }
  };

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

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `HTTP ${response.status}`,
        data: { siteName: siteNameFromHost(), url },
      };
    }

    const html = await response.text();
    return { ok: true, status: response.status, data: parseOG(html, url) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      data: { siteName: siteNameFromHost(), url },
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
  const siteName =
    getMetaContent("site_name") ||
    (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return undefined;
      }
    })();

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
// Media → preview classification (shared by runtime + snapshot script)
// =============================================================================

/** Embed platforms that render as native widgets (no OG preview needed). */
export type NativeEmbedPlatform = "twitter" | "x" | "instagram" | "tiktok";

/**
 * Detect a native embed platform from a URL or an explicit platform hint.
 * Returns null for everything else — those embeds fall back to a link-preview
 * card and therefore DO want OG metadata.
 */
export function detectNativeEmbedPlatform(
  urlOrPlatform: string,
): NativeEmbedPlatform | null {
  const v = urlOrPlatform.toLowerCase();
  // Explicit platform hint
  if (v === "x") return "x";
  if (v === "twitter") return "twitter";
  if (v === "instagram") return "instagram";
  if (v === "tiktok") return "tiktok";
  // URL host
  try {
    const host = new URL(urlOrPlatform).hostname.replace(/^www\./, "");
    if (host === "x.com" || host.endsWith(".x.com")) return "x";
    if (host === "twitter.com" || host.endsWith(".twitter.com"))
      return "twitter";
    if (host === "instagram.com" || host.endsWith(".instagram.com"))
      return "instagram";
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  } catch {
    // not a URL — fall through
  }
  return null;
}

/** Minimal structural shape of a media item (works for typed Media or raw JSON). */
export interface PreviewableMedia {
  type: string;
  url: string;
  platform?: string | null;
  showPreview?: boolean;
  preview?: { title?: string; description?: string; image?: string };
}

/**
 * True when a media item renders as an OG-crawled preview card on the /works
 * timeline — i.e. a non-native embed (web.dev, Medium, …). It deliberately
 * EXCLUDES `link` media: in the dense git-log timeline links are compact
 * corner indicators (icon + label), not cards, so they neither need nor
 * trigger an OG crawl. This keeps the snapshot scoped to what actually
 * previews, so a non-crawlable plain link can't create a phantom "missing".
 */
export function mediaIsOGPreviewTarget(m: PreviewableMedia): boolean {
  if (m.type !== "embed") return false;
  const platform = m.platform ?? detectNativeEmbedPlatform(m.url);
  return platform == null; // non-native embed → link-preview fallback card
}

/**
 * True when a preview target needs a *live crawl* to build its card.
 * A complete manual `preview` (title + image) is authoritative and skips the
 * crawl entirely — the recovery path for sites that block crawling.
 */
export function mediaNeedsLiveCrawl(m: PreviewableMedia): boolean {
  if (!mediaIsOGPreviewTarget(m)) return false;
  const manualComplete = !!(m.preview?.title && m.preview?.image);
  return !manualComplete;
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
