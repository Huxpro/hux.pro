import { postCardOf } from "./content";
import type { Locale } from "./i18n";
import { getBlogPostBySlug } from "./mdx";
import type { SnapshotEntry } from "./og-core";

/**
 * A page of this site as a card, without a crawl. The snapshot records a
 * post's card under its URL the same way it records another site's
 * (`pnpm og:snapshot`), from the function the post's page publishes its Open
 * Graph with (`postCardOf`): the same title and the same first paragraph a
 * crawler reads off the page. The picture is the card's inside face, the
 * post's own first image; the page's og:image is its shared face, the card
 * baked from that image (see docs/og-images.md). `og:complete` recomputes
 * each one and fails when the snapshot is stale.
 *
 * Node-only (it reads the post from disk). Only a post, by its language URL,
 * has a card yet; any other path returns null.
 */
export const SITE_NAME = "Hux.Pro";

const POST_URL = /^\/writing\/([^/?#]+)\/(en|zh)\/?$/;

export function isSiteCardUrl(url: string): boolean {
  return POST_URL.test(url);
}

export function siteCardOf(url: string): SnapshotEntry | null {
  const match = url.match(POST_URL);
  if (!match) return null;
  const [, slug, lang] = match;
  const post = getBlogPostBySlug(slug);
  if (!post) return null;
  if (post.language !== "both" && post.language !== lang) return null;
  const card = postCardOf(post, lang as Locale);
  return {
    title: card.title,
    description: card.description,
    image: card.image,
    siteName: SITE_NAME,
  };
}
