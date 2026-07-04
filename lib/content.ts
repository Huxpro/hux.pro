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
 * reaching across the framework boundary — the same reason `SocialEmbedPlatform`
 * lives in `lib/og-core`. `PeekCover` imports these back from here.
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
  /** Plain-text excerpt extracted from the post body for hover previews —
   *  markdown / MDX components stripped, whitespace collapsed, truncated. */
  excerpt?: string;
  excerptZh?: string;
  /** First image URL referenced in the post body — used as the peek cover. */
  cover?: string;
  coverZh?: string;
  /**
   * How the peek cover fills its slot (frontmatter `coverFit`):
   *  - `"cover"` (default): fixed-aspect slot, image cropped to fill.
   *  - `"natural"`: slot matches the cover's intrinsic aspect (no crop) —
   *    use for portrait screenshots / framing-sensitive covers.
   * Applies to both locales' covers. See {@link CoverFit} / PeekCover.
   */
  coverFit?: CoverFit;
  /**
   * Fixed-mode aspect ratio (frontmatter `coverAspect`), any CSS
   * `aspect-ratio` value (e.g. `"3 / 4"`). Ignored when `coverFit` is
   * `"natural"`. Defaults to the site-wide `DEFAULT_COVER_ASPECT`.
   */
  coverAspect?: string;
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
// truth for the exceptions — exactly the way a post's own locale visibility
// lives in `shouldShowPost` above, rather than being special-cased ad-hoc at
// each render site. A tag listed here is shown ONLY in the locales given:
//   "译"   the piece is a translation   → zh only
//   "知乎" originally answered on Zhihu  → zh only
// The mechanism is fully general — scope ANY tag to ANY locale by adding a row
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
// instead of living only in the hover peek. This is purely a display choice and
// is deliberately independent of locale visibility — a tag can be locale-scoped
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
