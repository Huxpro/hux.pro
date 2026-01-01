// Content types for MDX frontmatter
import type { Locale } from "./i18n";

export type PostLanguage = "en" | "zh" | "both";

export interface BlogPost {
  slug: string;
  language: PostLanguage;
  title: string;
  titleZh?: string; // For bilingual posts
  date: string; // YYYY-MM-DD
  description: string;
  descriptionZh?: string; // For bilingual posts
  tags?: string[];
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

// Helper to check if a post should be shown for a given locale
export function shouldShowPost(
  post: BlogPost,
  locale: Locale,
  includeOther: boolean
): boolean {
  if (post.language === "both") return true;
  if (post.language === locale) return true;
  if (includeOther) return true;
  return false;
}

// Get the display title based on locale
export function getLocalizedTitle(
  post: BlogPost,
  locale: Locale
): string {
  if (locale === "zh" && post.titleZh) {
    return post.titleZh;
  }
  return post.title;
}

// Get the display description based on locale
export function getLocalizedDescription(
  post: BlogPost,
  locale: Locale
): string {
  if (locale === "zh" && post.descriptionZh) {
    return post.descriptionZh;
  }
  return post.description;
}

// Check if post has alternate language version
export function hasAlternateLanguage(post: BlogPost): boolean {
  return post.language === "both";
}

// Get the alternate language label
export function getAlternateLangLabel(
  post: BlogPost,
  currentLocale: Locale
): { locale: Locale; label: string } | null {
  if (post.language !== "both") return null;

  if (currentLocale === "en") {
    return { locale: "zh", label: "中文" };
  } else {
    return { locale: "en", label: "English" };
  }
}
