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
}

// Docs don't have extra fields beyond Post
export type Doc = Post;

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
 * Get the href for a post, including ?lang= for bilingual posts
 */
export function getPostHref<T extends LocalizedContent>(
  post: T,
  locale: Locale,
  basePath: string
): string {
  const base = `${basePath}/${post.slug}`;
  // Bilingual posts include ?lang= so URL is source of truth
  if (post.language === "both") {
    return `${base}?lang=${locale}`;
  }
  return base;
}

/**
 * Resolve display locale for a post based on URL and system preference
 */
export function resolveDisplayLocale(
  urlLang: Locale | null,
  systemLocale: Locale,
  postLanguage: PostLanguage
): Locale {
  // Single-language posts: always use that language
  if (postLanguage === "en") return "en";
  if (postLanguage === "zh") return "zh";

  // Bilingual posts: URL param takes precedence, then system locale
  return urlLang ?? systemLocale;
}
