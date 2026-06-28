"use server";

/**
 * Server action to fetch Open Graph metadata from a URL.
 * Must be server-side due to CORS restrictions.
 */

export interface OGData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  url: string;
}

/**
 * User-Agent used to fetch link previews.
 *
 * Many sites (Medium, X, etc.) gate their server-rendered HTML — and the
 * Open Graph / Twitter Card tags that come with it — behind bot detection,
 * returning 403 to a generic or unknown agent while serving the full
 * markup to recognized link-unfurling crawlers. We therefore identify as
 * one of those well-known crawlers so the same preview a Slack/Twitter/
 * Facebook unfurl would get is available to us. (A plain "OGBot/1.0" or a
 * vanilla desktop-browser UA both get a 403 from Medium, which is why the
 * Medium blog link previewed as a bare domain before.)
 */
const CRAWLER_USER_AGENT =
  "Mozilla/5.0 (compatible; Slackbot-LinkExpanding 1.0; +https://api.slack.com/robots)";

/**
 * Fetch Open Graph metadata from a URL.
 * Returns basic info if OG tags aren't available.
 */
export async function fetchOGData(url: string): Promise<OGData> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": CRAWLER_USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        // Prefer English markup — some sites (e.g. web.dev) localize OG
        // tags by Accept-Language and would otherwise hand back the
        // datacenter region's default locale.
        "Accept-Language": "en-US,en;q=0.9",
      },
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();

    // Parse OG tags using regex (lightweight, no external parser needed)
    const getMetaContent = (property: string): string | undefined => {
      // Try og: prefix
      const ogMatch = html.match(
        new RegExp(
          `<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']+)["']`,
          "i"
        )
      );
      if (ogMatch) return decodeHTMLEntities(ogMatch[1]);

      // Try content before property
      const ogMatchReverse = html.match(
        new RegExp(
          `<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${property}["']`,
          "i"
        )
      );
      if (ogMatchReverse) return decodeHTMLEntities(ogMatchReverse[1]);

      // Try twitter: prefix
      const twitterMatch = html.match(
        new RegExp(
          `<meta[^>]*name=["']twitter:${property}["'][^>]*content=["']([^"']+)["']`,
          "i"
        )
      );
      if (twitterMatch) return decodeHTMLEntities(twitterMatch[1]);

      // Try content before name (twitter)
      const twitterMatchReverse = html.match(
        new RegExp(
          `<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:${property}["']`,
          "i"
        )
      );
      if (twitterMatchReverse) return decodeHTMLEntities(twitterMatchReverse[1]);

      return undefined;
    };

    // Get title from og:title, twitter:title, or <title> tag
    let title = getMetaContent("title");
    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) title = decodeHTMLEntities(titleMatch[1].trim());
    }

    // Get description
    let description = getMetaContent("description");
    if (!description) {
      const descMatch = html.match(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
      );
      if (descMatch) description = decodeHTMLEntities(descMatch[1]);
    }

    // Get image
    const image = getMetaContent("image");

    // Get site name
    const siteName =
      getMetaContent("site_name") || new URL(url).hostname.replace("www.", "");

    return {
      title,
      description,
      image: image ? resolveUrl(image, url) : undefined,
      siteName,
      url,
    };
  } catch (error) {
    console.error(`Failed to fetch OG data for ${url}:`, error);
    // Return minimal data on error
    try {
      return {
        siteName: new URL(url).hostname.replace("www.", ""),
        url,
      };
    } catch {
      return { url };
    }
  }
}

/**
 * Decode HTML entities in a string.
 *
 * Covers the named entities common in OG/title text (including `&nbsp;`,
 * which web.dev embeds in its title and which previously rendered as a
 * literal "&nbsp;|&nbsp;") plus decimal and hex numeric references.
 */
function decodeHTMLEntities(str: string): string {
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

/**
 * Resolve relative URLs to absolute
 */
function resolveUrl(imageUrl: string, baseUrl: string): string {
  try {
    // Already absolute
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      return imageUrl;
    }
    // Protocol-relative
    if (imageUrl.startsWith("//")) {
      return `https:${imageUrl}`;
    }
    // Relative URL
    return new URL(imageUrl, baseUrl).href;
  } catch {
    return imageUrl;
  }
}
