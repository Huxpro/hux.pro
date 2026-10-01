// Content types and helpers for MDX posts
import type { Locale } from "@/lib/i18n";

export type PostLanguage = "en" | "zh" | "both";

/**
 * How a peek cover fills its slot (see the `PeekCover` component):
 *  - `"cover"`: fixed-aspect slot, image cropped to fill.
 *  - `"natural"`: slot matches the image's intrinsic aspect (no crop).
 *
 * Lives here (framework-agnostic content layer) rather than in the client
 * component, so `lib/*` and the node snapshot script can reference it without
 * reaching across the framework boundary. `SocialEmbedPlatform` lives in
 * `lib/og-core` for the same reason. `PeekCover` imports these back from here.
 */
export type CoverFit = "cover" | "natural";

/**
 * Site-wide default aspect ratio for `coverFit: "cover"` slots. Retune the
 * whole site's default from this single point; individual posts/commits
 * override it with `coverAspect` / `preview.aspect`. Any valid CSS
 * `aspect-ratio` value works (e.g. `"16 / 9"`, `"4 / 3"`, `"3 / 4"`, `"1 / 1"`).
 */
export const DEFAULT_COVER_ASPECT = "16 / 9";

// ===== Base Types =====

// Minimal localized content (for search/command palette)
export interface LocalizedContent {
  slug: string;
  language: PostLanguage;
  title: string;
  titleZh?: string;
  description: string;
  descriptionZh?: string;
}

// Full post with reading time (for actual content pages)
export interface Post extends LocalizedContent {
  readingTime: string;
  readingTimeZh?: string;
}

// ===== Specialized Post Types =====

export interface BlogPost extends Post {
  date: string; // YYYY-MM-DD
  tags?: string[];
  origin?: string; // Markdown string describing provenance (from en file or zh-only)
  originZh?: string; // Chinese version's origin (from zh file)
  /** The post's first paragraph, whole, as plain text (lib/mdx `extractLead`):
   *  markdown / MDX components stripped, whitespace collapsed, truncated. */
  excerpt?: string;
  excerptZh?: string;
  /** First image URL referenced in the post body, used as the peek cover. */
  cover?: string;
  coverZh?: string;
  /**
   * How the peek cover fills its slot (frontmatter `coverFit`):
   *  - `"cover"` (default): fixed-aspect slot, image cropped to fill.
   *  - `"natural"`: slot matches the cover's intrinsic aspect (no crop).
   *    Use for portrait screenshots / framing-sensitive covers.
   * Applies to both locales' covers. See {@link CoverFit} / PeekCover.
   */
  coverFit?: CoverFit;
  /**
   * Fixed-mode aspect ratio (frontmatter `coverAspect`), any CSS
   * `aspect-ratio` value (e.g. `"3 / 4"`). Ignored when `coverFit` is
   * `"natural"`. Defaults to the site-wide `DEFAULT_COVER_ASPECT`.
   */
  coverAspect?: string;
  /**
   * Frontmatter `featured: true`: curated onto the home writing widget
   * alongside the latest posts. Mirrored in `lib/data.ts` for the client.
   */
  featured?: boolean;
}

/**
 * Format a post date the way every writing surface prints it (the list,
 * the article header and the home widget): `"apr 2021"` (lowercase short
 * month + year, always en-US so it reads as a plain mono caption in both
 * locales).
 */
export function formatPostDate(dateStr: string): string {
  return new Date(dateStr)
    .toLocaleDateString("en-US", { month: "short", year: "numeric" })
    .toLowerCase();
}

/**
 * The row-level slice of a blog post: what list-like client surfaces (the
 * home writing widget) need, without excerpts, covers or raw frontmatter.
 * Built server-side from `getAllBlogPosts()` so the client payload stays
 * small and the data is the real frontmatter, not a hand-kept mirror.
 */
export type BlogPostSummary = Pick<
  BlogPost,
  "slug" | "language" | "title" | "titleZh" | "description" | "date" | "featured"
>;

export function toBlogPostSummaries(posts: BlogPost[]): BlogPostSummary[] {
  return posts.map(
    ({ slug, language, title, titleZh, description, date, featured }) => ({
      slug,
      language,
      title,
      titleZh,
      description,
      date,
      featured,
    }),
  );
}

// Docs don't have extra fields beyond Post
export type Doc = Post;

export interface Note extends Post {
  date: string;
  category: string; // e.g. "sf-lf", "sf-plf", "data-rep"
}

export interface Talk {
  title: string;
  titleZh?: string;
  event: string;
  date: string; // YYYY-MM-DD
  location: string;
  video?: string;
  slides?: string;
  language: "en" | "zh";
  description?: string;
  descriptionZh?: string;
}

export interface CareerEntry {
  role: string;
  roleZh?: string;
  company: string;
  companyZh?: string;
  startDate: string; // YYYY-MM
  endDate?: string; // YYYY-MM or "present"
  achievements: string[];
  achievementsZh?: string[];
  skills?: string[];
}

// ===== Generic Helpers =====
// These work with LocalizedContent or Post

/**
 * Check if a post should be shown for a given locale
 */
export function shouldShowPost<T extends LocalizedContent>(
  post: T,
  locale: Locale,
  includeOther: boolean
): boolean {
  if (post.language === "both") return true;
  if (post.language === locale) return true;
  if (includeOther) return true;
  return false;
}

// =============================================================================
// Tag Locale Visibility
// -----------------------------------------------------------------------------
// Every tag is an ordinary tag; nothing here is a special kind of data. By
// default a tag is visible in every locale. This table is the single source of
// truth for the exceptions, the same way a post's own locale visibility
// lives in `shouldShowPost` above, rather than being special-cased ad-hoc at
// each render site. A tag listed here is shown ONLY in the locales given:
//   "译"   the piece is a translation   → zh only
//   "知乎" originally answered on Zhihu  → zh only
// The mechanism is fully general: scope ANY tag to ANY locale by adding a row
// (e.g. `Foo: ["en"]` for en-only, `Bar: []` to hide everywhere). A tag not
// listed stays visible in every locale.
// =============================================================================

export const tagLocaleVisibility: Record<string, Locale[]> = {
  译: ["zh"],
  知乎: ["zh"],
};

/**
 * Whether a tag should be visible in the given locale. A tag absent from
 * `tagLocaleVisibility` is visible everywhere; a listed tag is visible only in
 * its declared locales.
 */
export function isTagVisible(tag: string, locale: Locale): boolean {
  const locales = tagLocaleVisibility[tag];
  return locales ? locales.includes(locale) : true;
}

/** Filter a tag list to those visible in the given locale, preserving order. */
export function getVisibleTags(tags: string[], locale: Locale): string[] {
  return tags.filter((tag) => isTagVisible(tag, locale));
}

// =============================================================================
// Tag Decorators (presentation only)
// -----------------------------------------------------------------------------
// A separate, smaller concern from visibility above: which tags read as
// provenance/meta *annotations* and so render as a badge on the list row,
// instead of living only in the hover peek. This is only a display choice and
// is deliberately independent of locale visibility. A tag can be locale-scoped
// without being a decorator (e.g. an en-only topic tag), and a decorator is
// still subject to the visibility table (a decorator hidden in this locale
// won't render). 译 / 知乎 happen to be both, but each is configured on its own.
// =============================================================================

export const decoratorTags: ReadonlySet<string> = new Set(["译", "知乎"]);

/** Whether a tag renders as a row-level decorator badge (vs. a plain tag). */
export function isDecoratorTag(tag: string): boolean {
  return decoratorTags.has(tag);
}

/**
 * Get the display title based on locale
 */
export function getLocalizedTitle<T extends LocalizedContent>(
  post: T,
  locale: Locale
): string {
  if (locale === "zh" && post.titleZh) {
    return post.titleZh;
  }
  return post.title;
}

/**
 * Get the display description based on locale
 */
export function getLocalizedDescription<T extends LocalizedContent>(
  post: T,
  locale: Locale
): string {
  if (locale === "zh" && post.descriptionZh) {
    return post.descriptionZh;
  }
  return post.description;
}

/**
 * Get the display reading time based on locale
 * Only works with Post (which has readingTime)
 */
export function getLocalizedReadingTime<T extends Post>(
  post: T,
  locale: Locale
): string {
  if (locale === "zh" && post.readingTimeZh) {
    return post.readingTimeZh;
  }
  return post.readingTime;
}

/**
 * Check if post has alternate language version
 */
export function hasAlternateLanguage<T extends LocalizedContent>(post: T): boolean {
  return post.language === "both";
}

/**
 * Get the alternate language label
 */
export function getAlternateLangLabel<T extends LocalizedContent>(
  post: T,
  currentLocale: Locale
): { locale: Locale; label: string } | null {
  if (post.language !== "both") return null;

  if (currentLocale === "en") {
    return { locale: "zh", label: "中文" };
  } else {
    return { locale: "en", label: "English" };
  }
}

/**
 * Get the href for a post with route-based locale suffix
 */
export function getPostHref<T extends LocalizedContent>(
  post: T,
  locale: Locale,
  basePath: string
): string {
  const base = `${basePath}/${post.slug}`;
  // Bilingual posts: use the viewer's locale
  if (post.language === "both") {
    return `${base}/${locale}`;
  }
  // Single-language posts: link directly to the post's language
  return `${base}/${post.language}`;
}

// ===== The post card =====

/**
 * A post as a card: its title, its first paragraph, its picture. A card for
 * it anywhere on this site paints this, and its page publishes the same
 * title and paragraph as Open Graph, so a crawl of the page and a card
 * inside the site say the same thing.
 *
 * The picture has two faces. Inside the site a card shows the post's own
 * first image, and sets the title beside it. Shared elsewhere, the post is
 * `shareImage`: the card baked for it (that image darkened, the title and
 * the year set over it), since a feed may show the picture alone.
 */
export interface PostCard {
  /** The page, site-relative: `/writing/<slug>/<lang>`. */
  url: string;
  lang: Locale;
  title: string;
  /** The first paragraph, whole; the dek when the body has none. */
  description?: string;
  /** The first image in the body; the baked card for a post with none. */
  image: string;
  /** The baked card, 1200×630 (its `opengraph-image` route). */
  shareImage: string;
  date: string;
}

/** The card of one language version of a post (`lang` is the page's). */
export function postCardOf(
  post: LocalizedContent & {
    date: string;
    cover?: string;
    coverZh?: string;
    excerpt?: string;
    excerptZh?: string;
  },
  lang: Locale,
): PostCard {
  const url = `/writing/${post.slug}/${lang}`;
  const pick = <T>(zh: T | undefined, en: T | undefined) =>
    lang === "zh" ? (zh ?? en) : (en ?? zh);
  const shareImage = `${url}/opengraph-image`;
  return {
    url,
    lang,
    title: getLocalizedTitle(post, lang),
    description:
      pick(post.excerptZh, post.excerpt) || getLocalizedDescription(post, lang) || undefined,
    image: pick(post.coverZh, post.cover) ?? shareImage,
    shareImage,
    date: post.date,
  };
}

// ===== The post peek =====

/**
 * What a post shows under the pointer (the /writing row's peek), resolved
 * for one locale: the post's "inner page" bits the row does not print.
 * Title and date are left out; they are on whatever was hovered.
 *
 * One shape for every surface that summons a post: the /writing list, a
 * magic link in prose (components/magic-link), and the attachment drawer
 * that stands in for the peek on a phone.
 */
export interface PostPeek {
  language: PostLanguage;
  readingTime: string;
  /** Curated frontmatter summary: the dek. */
  description?: string;
  /** Provenance, as authored (markdown links are flattened when shown). */
  origin?: string;
  /** Opening paragraphs of the body, plain text. */
  excerpt?: string;
  cover?: string;
  coverFit?: CoverFit;
  coverAspect?: string;
  /** Tags visible in this locale. */
  tags?: string[];
}

/** The blog-only extras a peek reads; Doc / Note simply leave them unset. */
export type PostPeekSource = Post &
  Partial<
    Pick<
      BlogPost,
      | "tags"
      | "origin"
      | "originZh"
      | "excerpt"
      | "excerptZh"
      | "cover"
      | "coverZh"
      | "coverFit"
      | "coverAspect"
    >
  >;

/**
 * A post's peek for `locale`, preferring that locale's bits and falling back
 * to the other language's, so a single-language post (js-20yrs-preface is
 * zh-only) still peeks for a reader in the other locale.
 */
export function postPeekOf(post: PostPeekSource, locale: Locale): PostPeek {
  const pick = <T>(zh: T | undefined, en: T | undefined) =>
    locale === "zh" ? (zh ?? en) : (en ?? zh);
  return {
    language: post.language,
    readingTime: getLocalizedReadingTime(post, locale),
    description: getLocalizedDescription(post, locale) || undefined,
    origin: pick(post.originZh, post.origin),
    excerpt: pick(post.excerptZh, post.excerpt),
    cover: pick(post.coverZh, post.cover),
    coverFit: post.coverFit,
    coverAspect: post.coverAspect,
    tags: post.tags ? getVisibleTags(post.tags, locale) : undefined,
  };
}

/** Whether a peek has anything the row does not already say. */
export function postPeekHasContent(peek: PostPeek): boolean {
  return !!peek.description || !!peek.excerpt || !!peek.cover;
}
