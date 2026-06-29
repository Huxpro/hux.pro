// Content types and helpers for MDX posts
import type { Locale } from "@/lib/i18n";

export type PostLanguage = "en" | "zh" | "both";

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
// Tag Decorators
// -----------------------------------------------------------------------------
// Most tags are content topics ("Web", "React", "UX/UI") and are shown to every
// reader. A few tags are *decorators*: provenance / meta annotations that only
// make sense to a reader of a particular locale —
//   "译"   the piece is a translation (relevant only to zh readers)
//   "知乎" originally answered on Zhihu, a Chinese Q&A site
// Their per-locale visibility is declared here, in one place, exactly the way a
// post's own locale visibility lives in `shouldShowPost` above — rather than
// being special-cased ad-hoc at each render site. To scope a tag to a locale,
// add an entry; everything not listed is a normal content tag, always visible.
// =============================================================================

export interface TagDecorator {
  /** The raw tag string exactly as authored in frontmatter. */
  tag: string;
  /** Locales this decorator is visible in. */
  locales: Locale[];
}

export const tagDecorators: TagDecorator[] = [
  { tag: "译", locales: ["zh"] },
  { tag: "知乎", locales: ["zh"] },
];

const decoratorByTag = new Map(tagDecorators.map((d) => [d.tag, d]));

/** Whether a tag is a declared decorator (vs. a normal content tag). */
export function isTagDecorator(tag: string): boolean {
  return decoratorByTag.has(tag);
}

/**
 * Whether a tag should be visible in the given locale. Normal content tags are
 * always visible; decorator tags are visible only in the locales declared in
 * `tagDecorators`.
 */
export function isTagVisible(tag: string, locale: Locale): boolean {
  const decorator = decoratorByTag.get(tag);
  return decorator ? decorator.locales.includes(locale) : true;
}

/** Filter a tag list to those visible in the given locale, preserving order. */
export function getVisibleTags(tags: string[], locale: Locale): string[] {
  return tags.filter((tag) => isTagVisible(tag, locale));
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
