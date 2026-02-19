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
 * Fetch Open Graph metadata from a URL.
 * Returns basic info if OG tags aren't available.
 */
export async function fetchOGData(url: string): Promise<OGData> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; OGBot/1.0; +https://example.com/bot)",
        Accept: "text/html,application/xhtml+xml",
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
 * Decode HTML entities in a string
 */
function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
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
