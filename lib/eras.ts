// =============================================================================
// Eras System - Types and Utilities
// Unified view of professional work organized by contextual eras
// =============================================================================

import type { Locale } from "./i18n";

// =============================================================================
// Localization Types
// =============================================================================

/**
 * A string with both English and Chinese variants.
 * Use `localize(str, locale)` to get the appropriate version.
 */
export type LocalizedString = {
  en: string;
  zh: string;
};

/**
 * Get the localized value from a LocalizedString
 */
export function localize(str: LocalizedString, locale: Locale): string {
  return str[locale];
}

/**
 * Get localized value with fallback for optional LocalizedString
 */
export function localizeOptional(
  str: LocalizedString | undefined,
  locale: Locale
): string | undefined {
  return str ? str[locale] : undefined;
}

// =============================================================================
// Work Item Types (Discriminated Union)
// =============================================================================

export type WorkItemType = "project" | "talk" | "post" | "social" | "role";

/**
 * Common link structure used across work items
 */
export interface ItemLink {
  url: string;
  label: string;
  icon?: string; // lucide icon name
}

/**
 * Base fields shared by all work item types
 */
interface BaseWorkItem {
  id: string;
  eraId: string;
  date: string; // YYYY-MM or YYYY-MM-DD
  endDate?: string; // YYYY-MM, YYYY-MM-DD, or "present"
  title: LocalizedString;
  description: LocalizedString;
  /** Personal reflection / liner notes */
  commentary?: LocalizedString;
  tags?: string[];
}

// -----------------------------------------------------------------------------
// Project
// -----------------------------------------------------------------------------

export interface ProjectItem extends BaseWorkItem {
  type: "project";
  links: ItemLink[];
  techStack?: string[];
  stats?: {
    stars?: number;
    downloads?: string;
    users?: string;
  };
}

// -----------------------------------------------------------------------------
// Talk
// -----------------------------------------------------------------------------

export interface TalkItem extends BaseWorkItem {
  type: "talk";
  conference: {
    name: string;
    city?: string;
    url?: string;
  };
  video?: {
    url: string;
    thumbnail?: string;
    platform: "youtube" | "bilibili" | "other";
  };
  slides?: {
    url: string;
  };
}

// -----------------------------------------------------------------------------
// Post (Article/Blog)
// -----------------------------------------------------------------------------

export interface PostItem extends BaseWorkItem {
  type: "post";
  publication: {
    name: string;
    logo?: string;
  };
  url: string;
}

// -----------------------------------------------------------------------------
// Role (Job/Position)
// -----------------------------------------------------------------------------

export interface RoleItem extends BaseWorkItem {
  type: "role";
  company: LocalizedString;
  roleTitle: LocalizedString;
  location?: string;
  url?: string;
}

// -----------------------------------------------------------------------------
// Social (Tweet, Thread, etc.)
// -----------------------------------------------------------------------------

export interface SocialItem extends BaseWorkItem {
  type: "social";
  platform: string;
  url: string;
}

// -----------------------------------------------------------------------------
// Discriminated Union
// -----------------------------------------------------------------------------

/**
 * A WorkItem is an atomic piece of work within an era.
 * Use `item.type` to narrow the type and access type-specific fields.
 *
 * @example
 * if (item.type === "project") {
 *   // TypeScript knows item.links exists here
 *   item.links.forEach(link => console.log(link.url));
 * }
 */
export type WorkItem =
  | ProjectItem
  | TalkItem
  | PostItem
  | RoleItem
  | SocialItem;

// =============================================================================
// Era Types
// =============================================================================

/**
 * An Era represents a cohesive period of professional work.
 * Album/Discography metaphor: each era is a "release" with its own identity.
 */
export interface Era {
  id: string;
  title: LocalizedString;
  tagline: LocalizedString;
  narrative?: LocalizedString;
  company?: LocalizedString;
  keywords?: LocalizedString;
  startDate: string; // YYYY-MM
  endDate?: string; // YYYY-MM or undefined for present
  coverImage?: string;
  accentColor?: string;
}

/**
 * Combined data structure for loading from JSON
 */
export interface ErasData {
  eras: Era[];
  items: WorkItem[];
}

// =============================================================================
// Era Localization Helpers
// =============================================================================

export function getLocalizedEraTitle(era: Era, locale: Locale): string {
  return localize(era.title, locale);
}

export function getLocalizedTagline(era: Era, locale: Locale): string {
  return localize(era.tagline, locale);
}

export function getLocalizedCompany(
  era: Era,
  locale: Locale
): string | undefined {
  return localizeOptional(era.company, locale);
}

export function getLocalizedEraDescription(
  era: Era,
  locale: Locale
): string | undefined {
  return localizeOptional(era.narrative, locale);
}

// =============================================================================
// Work Item Localization Helpers
// =============================================================================

export function getLocalizedItemTitle(item: WorkItem, locale: Locale): string {
  return localize(item.title, locale);
}

export function getLocalizedItemDescription(
  item: WorkItem,
  locale: Locale
): string {
  return localize(item.description, locale);
}

export function getLocalizedCommentary(
  item: WorkItem,
  locale: Locale
): string | undefined {
  return localizeOptional(item.commentary, locale);
}

// =============================================================================
// Date Formatting
// =============================================================================

/**
 * Format a date range for display
 * Examples: "2019 – 2024", "2024 – Present", "2023"
 */
export function formatDateRange(
  startDate: string,
  endDate: string | undefined,
  locale: Locale
): string {
  const startYear = new Date(startDate).getFullYear();

  if (!endDate || endDate === "present") {
    const presentText = locale === "zh" ? "至今" : "Present";
    return `${startYear} – ${presentText}`;
  }

  const endYear = new Date(endDate).getFullYear();
  if (startYear === endYear) {
    return String(startYear);
  }

  return `${startYear} – ${endYear}`;
}

/**
 * Format a work item's date for display
 */
export function formatItemDate(item: WorkItem, locale: Locale): string {
  if (item.endDate) {
    return formatDateRange(item.date, item.endDate, locale);
  }

  const d = new Date(item.date);
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
  };

  return d.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", options);
}

/**
 * Format an era's date range for display
 */
export function formatEraDateRange(era: Era, locale: Locale): string {
  return formatDateRange(era.startDate, era.endDate, locale);
}

// =============================================================================
// Item Type Helpers
// =============================================================================

/**
 * Get display name for item type
 */
export function getItemTypeLabel(type: WorkItemType, locale: Locale): string {
  const labels: Record<WorkItemType, LocalizedString> = {
    project: { en: "Project", zh: "项目" },
    talk: { en: "Talk", zh: "演讲" },
    post: { en: "Post", zh: "文章" },
    social: { en: "Social", zh: "社交" },
    role: { en: "Role", zh: "职位" },
  };

  return localize(labels[type], locale);
}

/**
 * Get the icon character for item type (for minimal ASCII display)
 */
export function getItemTypeIcon(type: WorkItemType): string {
  const icons: Record<WorkItemType, string> = {
    project: "●",
    talk: "○",
    post: "◆",
    social: "◇",
    role: "■",
  };
  return icons[type];
}

// =============================================================================
// Sorting
// =============================================================================

/**
 * Sort items by date (most recent first)
 */
export function sortItemsByDate<T extends WorkItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    return b.date.localeCompare(a.date);
  });
}

/**
 * Sort eras by date (most recent first)
 */
export function sortErasByDate(eras: Era[]): Era[] {
  return [...eras].sort((a, b) => {
    return b.startDate.localeCompare(a.startDate);
  });
}

// =============================================================================
// Type Guards
// =============================================================================

export function isProjectItem(item: WorkItem): item is ProjectItem {
  return item.type === "project";
}

export function isTalkItem(item: WorkItem): item is TalkItem {
  return item.type === "talk";
}

export function isPostItem(item: WorkItem): item is PostItem {
  return item.type === "post";
}

export function isRoleItem(item: WorkItem): item is RoleItem {
  return item.type === "role";
}

export function isSocialItem(item: WorkItem): item is SocialItem {
  return item.type === "social";
}
