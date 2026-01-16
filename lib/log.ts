// =============================================================================
// Log System - Types and Utilities
// History as git history: commits (work items) organized by tags (context/eras)
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
// Commit Types (Discriminated Union)
// Each commit is a work item in the git history
// =============================================================================

export type CommitType = "project" | "talk" | "post" | "social" | "role";

/**
 * Common link structure used across commits
 */
export interface ItemLink {
  url: string;
  label: string;
  icon?: string; // lucide icon name
}

// -----------------------------------------------------------------------------
// Base Commit
// -----------------------------------------------------------------------------

/**
 * Base fields shared by all commit types
 */
interface BaseCommit {
  id: string;
  tagId: string;
  date: string; // YYYY-MM or YYYY-MM-DD
  endDate?: string; // YYYY-MM, YYYY-MM-DD, or "present"
  title: LocalizedString;
  description: LocalizedString;
  /** Personal reflection / liner notes */
  commentary?: LocalizedString;
  tags?: string[];
  /**
   * Whether this commit should be shown in /works (and other index surfaces).
   * Defaults to true when omitted.
   */
  listed?: boolean;
}

// -----------------------------------------------------------------------------
// Project Commit
// -----------------------------------------------------------------------------

export interface ProjectCommit extends BaseCommit {
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
// Talk Commit
// -----------------------------------------------------------------------------

export interface TalkCommit extends BaseCommit {
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
// Post Commit (Article/Blog)
// -----------------------------------------------------------------------------

export interface PostCommit extends BaseCommit {
  type: "post";
  publication: {
    name: string;
    logo?: string;
  };
  url: string;
}

// -----------------------------------------------------------------------------
// Role Commit (Job/Position)
// -----------------------------------------------------------------------------

export interface RoleCommit extends BaseCommit {
  type: "role";
  company: LocalizedString;
  roleTitle: LocalizedString;
  location?: string;
  url?: string;
}

// -----------------------------------------------------------------------------
// Social Commit (Tweet, Thread, etc.)
// -----------------------------------------------------------------------------

export interface SocialCommit extends BaseCommit {
  type: "social";
  platform: string;
  url: string;
}

// -----------------------------------------------------------------------------
// Discriminated Union
// -----------------------------------------------------------------------------

/**
 * A Commit is an atomic piece of work within a tag (context).
 * Use `commit.type` to narrow the type and access type-specific fields.
 *
 * @example
 * if (commit.type === "project") {
 *   // TypeScript knows commit.links exists here
 *   commit.links.forEach(link => console.log(link.url));
 * }
 */
export type Commit =
  | ProjectCommit
  | TalkCommit
  | PostCommit
  | RoleCommit
  | SocialCommit;

// =============================================================================
// Tag Types (formerly Era)
// A tag represents a contextual period, like a git tag marking a release
// =============================================================================

/**
 * A Tag represents a cohesive period of professional work.
 * Git metaphor: each tag marks a significant chapter in the history.
 */
export interface Tag {
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

// =============================================================================
// Groups (curated collections / Home widgets)
// =============================================================================

export type GroupLayout = "h" | "v";
export type GroupSort = "dateAsc" | "dateDesc";

export interface GroupQuery {
  type?: CommitType;
  tagId?: string;
  tagsAny?: string[];
  tagsAll?: string[];
  upcoming?: boolean;
  excludeTypes?: CommitType[];
  /**
   * Include commits with `listed: false`.
   * Defaults to false (i.e. only listed commits).
   */
  includeUnlisted?: boolean;
}

interface GroupBase {
  id: string;
  title: LocalizedString;
  href?: string;
  layout?: GroupLayout;
  limit?: number;
  sort?: GroupSort;
  /**
   * Include commits with `listed: false`.
   * Defaults to false (i.e. only listed commits).
   */
  includeUnlisted?: boolean;
}

export interface GroupByIds extends GroupBase {
  commitIds: string[];
  query?: never;
}

export interface GroupByQuery extends GroupBase {
  query: GroupQuery;
  commitIds?: never;
}

export type Group = GroupByIds | GroupByQuery;

/**
 * Combined data structure for loading from JSON
 */
export interface LogData {
  tags: Tag[];
  groups?: Group[];
  commits: Commit[];
}

// =============================================================================
// Tag Localization Helpers
// =============================================================================

export function getLocalizedTagTitle(tag: Tag, locale: Locale): string {
  return localize(tag.title, locale);
}

export function getLocalizedTagline(tag: Tag, locale: Locale): string {
  return localize(tag.tagline, locale);
}

export function getLocalizedCompany(
  tag: Tag,
  locale: Locale
): string | undefined {
  return localizeOptional(tag.company, locale);
}

export function getLocalizedTagDescription(
  tag: Tag,
  locale: Locale
): string | undefined {
  return localizeOptional(tag.narrative, locale);
}

// =============================================================================
// Commit Localization Helpers
// =============================================================================

export function getLocalizedCommitTitle(commit: Commit, locale: Locale): string {
  return localize(commit.title, locale);
}

export function getLocalizedCommitDescription(
  commit: Commit,
  locale: Locale
): string {
  return localize(commit.description, locale);
}

export function getLocalizedCommentary(
  commit: Commit,
  locale: Locale
): string | undefined {
  return localizeOptional(commit.commentary, locale);
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
 * Format a commit's date for display
 */
export function formatCommitDate(commit: Commit, locale: Locale): string {
  if (commit.endDate) {
    return formatDateRange(commit.date, commit.endDate, locale);
  }

  const d = new Date(commit.date);
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
  };

  return d.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", options);
}

/**
 * Format a tag's date range for display
 */
export function formatTagDateRange(tag: Tag, locale: Locale): string {
  return formatDateRange(tag.startDate, tag.endDate, locale);
}

// =============================================================================
// Commit Type Helpers
// =============================================================================

/**
 * Get display name for commit type
 */
export function getCommitTypeLabel(type: CommitType, locale: Locale): string {
  const labels: Record<CommitType, LocalizedString> = {
    project: { en: "Project", zh: "项目" },
    talk: { en: "Talk", zh: "演讲" },
    post: { en: "Post", zh: "文章" },
    social: { en: "Social", zh: "社交" },
    role: { en: "Role", zh: "职位" },
  };

  return localize(labels[type], locale);
}

/**
 * Get the icon character for commit type (for minimal ASCII display)
 */
export function getCommitTypeIcon(type: CommitType): string {
  const icons: Record<CommitType, string> = {
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
 * Sort commits by date (most recent first)
 */
export function sortCommitsByDate<T extends Commit>(commits: T[]): T[] {
  return [...commits].sort((a, b) => {
    return b.date.localeCompare(a.date);
  });
}

/**
 * Sort tags by date (most recent first)
 */
export function sortTagsByDate(tags: Tag[]): Tag[] {
  return [...tags].sort((a, b) => {
    return b.startDate.localeCompare(a.startDate);
  });
}

// =============================================================================
// Listing / Visibility
// =============================================================================

export function isCommitListed(commit: Commit): boolean {
  return commit.listed !== false;
}

// =============================================================================
// Group Resolution
// =============================================================================

function parseLooseDate(date: string): Date | null {
  // Support "YYYY-MM" and "YYYY-MM-DD"
  const normalized = /^\d{4}-\d{2}$/.test(date) ? `${date}-01` : date;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function hasAnyTag(commit: Commit, tagsAny: string[]): boolean {
  if (!commit.tags || commit.tags.length === 0) return false;
  return tagsAny.some((t) => commit.tags!.includes(t));
}

function hasAllTags(commit: Commit, tagsAll: string[]): boolean {
  if (!commit.tags || commit.tags.length === 0) return false;
  return tagsAll.every((t) => commit.tags!.includes(t));
}

export function resolveGroupCommits(
  group: Group,
  commits: Commit[],
  now: Date = new Date()
): Commit[] {
  const includeUnlisted = group.includeUnlisted ?? false;
  const base = includeUnlisted ? commits : commits.filter(isCommitListed);

  const items: Commit[] =
    "commitIds" in group && group.commitIds
      ? group.commitIds
          .map((id) => base.find((c) => c.id === id))
          .filter(Boolean) as Commit[]
      : (() => {
          const q = group.query;
          const qIncludeUnlisted = q.includeUnlisted ?? false;
          const pool = qIncludeUnlisted ? commits : base;

          return pool
            .filter((c) => (q.type ? c.type === q.type : true))
            .filter((c) => (q.tagId ? c.tagId === q.tagId : true))
            .filter((c) =>
              q.excludeTypes ? !q.excludeTypes.includes(c.type) : true
            )
            .filter((c) => (q.tagsAny ? hasAnyTag(c, q.tagsAny) : true))
            .filter((c) => (q.tagsAll ? hasAllTags(c, q.tagsAll) : true))
            .filter((c) => {
              if (!q.upcoming) return true;
              const d = parseLooseDate(c.date);
              if (!d) return false;
              return d.getTime() >= now.getTime();
            });
        })();

  const sort: GroupSort =
    group.sort ??
    ("query" in group && group.query?.upcoming ? "dateAsc" : "dateDesc");

  const sorted = [...items].sort((a, b) =>
    sort === "dateAsc" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
  );

  return typeof group.limit === "number" ? sorted.slice(0, group.limit) : sorted;
}

// =============================================================================
// Type Guards
// =============================================================================

export function isProjectCommit(commit: Commit): commit is ProjectCommit {
  return commit.type === "project";
}

export function isTalkCommit(commit: Commit): commit is TalkCommit {
  return commit.type === "talk";
}

export function isPostCommit(commit: Commit): commit is PostCommit {
  return commit.type === "post";
}

export function isRoleCommit(commit: Commit): commit is RoleCommit {
  return commit.type === "role";
}

export function isSocialCommit(commit: Commit): commit is SocialCommit {
  return commit.type === "social";
}
