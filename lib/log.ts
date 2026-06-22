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
  locale: Locale,
): string | undefined {
  return str ? str[locale] : undefined;
}

// =============================================================================
// Commit Types (Discriminated Union)
// Each commit is a work item in the git history
// =============================================================================

export type CommitType = "project" | "talk" | "post" | "role" | "social";

// =============================================================================
// Media Types - Attachable to any Commit
// =============================================================================

/**
 * Media types define HOW external content is rendered:
 * - "video": YouTube/Bilibili/Vimeo iframe players
 * - "embed": Native social platform embeds (Twitter, Instagram, TikTok)
 * - "link": External link with optional OG preview
 * - "image": Static image display
 */
export type MediaType = "video" | "embed" | "link" | "image";

/**
 * Video platforms with native iframe support
 */
export type VideoPlatform = "youtube" | "bilibili" | "vimeo";

/**
 * Platforms with native embed support (non-video)
 */
export type EmbedPlatform = "twitter" | "x" | "instagram" | "tiktok";

/**
 * Video media - YouTube, Bilibili, Vimeo with iframe players
 */
export interface VideoMedia {
  type: "video";
  url: string;
  platform: VideoPlatform;
  thumbnail?: string;
}

/**
 * Embed media - Native social platform embeds (Twitter, Instagram, TikTok)
 */
export interface EmbedMedia {
  type: "embed";
  url: string;
  platform?: EmbedPlatform; // Auto-detected from URL if not provided
}

/**
 * Link media - External link with optional OG preview
 */
export interface LinkMedia {
  type: "link";
  url: string;
  label?: string;
  icon?: string;
  /** Whether to fetch and render OG image preview */
  showPreview?: boolean;
}

/**
 * Image media - Static image display
 */
export interface ImageMedia {
  type: "image";
  url: string;
  alt?: string;
}

/**
 * Discriminated union of all media types.
 * Use `media.type` to narrow and access type-specific fields.
 */
export type Media = VideoMedia | EmbedMedia | LinkMedia | ImageMedia;

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
  /**
   * The work's own language (intrinsic metadata, e.g. the language a talk
   * was delivered in, an article was written in). When this differs from
   * the viewer's locale, a small badge (EN / ZH) is rendered on the row.
   * Omit when not meaningful.
   */
  language?: CommitLanguage;
  /**
   * Which locale's listings should include this commit (visibility filter).
   * Defaults to "both" — independent of `language`, since you may want to
   * feature a Chinese talk in the English view.
   */
  listedIn?: CommitLanguage;
  /**
   * Attached media - rendered as video players, embeds, OG previews, etc.
   * Composable: any commit type can have any combination of media.
   */
  media?: Media[];
}

/**
 * The language of a work or its visibility scope.
 * - "en" / "zh": the work is in that language, or visibility is restricted
 *   to that locale.
 * - "both": bilingual, or visible in both locales.
 */
export type CommitLanguage = "en" | "zh" | "both";

// -----------------------------------------------------------------------------
// Project Commit
// -----------------------------------------------------------------------------

export interface ProjectCommit extends BaseCommit {
  type: "project";
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
  location?: string;
  url?: string;
}

// -----------------------------------------------------------------------------
// Social Commit (Social post / thread)
// -----------------------------------------------------------------------------

export interface SocialCommit extends BaseCommit {
  type: "social";
  /** Display name of the platform (e.g. "X", "Twitter", "YouTube") */
  platform: string;
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
 *   // TypeScript knows commit.stats exists here
 *   console.log(commit.stats?.stars);
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
  /**
   * Hide dates for this tag (tag header range and per-commit dates).
   * Used for ancillary sections like Education where the location
   * is shown in the date slot instead.
   */
  hideDate?: boolean;
}

// =============================================================================
// Groups (curated collections / Home widgets)
// =============================================================================

export type GroupLayout = "h" | "v";
export type GroupColumn = "left" | "right";
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
  column?: GroupColumn;
  hidden?: boolean;
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
  locale: Locale,
): string | undefined {
  return localizeOptional(tag.company, locale);
}

export function getLocalizedTagDescription(
  tag: Tag,
  locale: Locale,
): string | undefined {
  return localizeOptional(tag.narrative, locale);
}

// =============================================================================
// Commit Localization Helpers
// =============================================================================

export function getLocalizedCommitTitle(
  commit: Commit,
  locale: Locale,
): string {
  return localize(commit.title, locale);
}

export function getLocalizedCommitDescription(
  commit: Commit,
  locale: Locale,
): string {
  return localize(commit.description, locale);
}

export function getLocalizedCommentary(
  commit: Commit,
  locale: Locale,
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
  locale: Locale,
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
// Commit Hash
// =============================================================================

/**
 * Compute a 7-character hex hash from a commit's id.
 * Uses djb2 hashing — deterministic, stable, and visually git-like.
 * The id is the canonical key so the hash won't change when content is edited.
 */
export function computeCommitHash(commitId: string): string {
  let hash = 5381;
  for (let i = 0; i < commitId.length; i++) {
    hash = ((hash << 5) + hash + commitId.charCodeAt(i)) & 0xffffffff;
  }
  return (hash >>> 0).toString(16).padStart(7, "0").slice(0, 7);
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
    role: { en: "Role", zh: "职位" },
    social: { en: "Social", zh: "社交" },
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
    role: "■",
    social: "▲",
  };
  return icons[type];
}

// =============================================================================
// Sorting
// =============================================================================

/**
 * Sort key for a commit. Roles use their `endDate` so they sit at the
 * TOP of their tenure's segment (with all the projects/talks they did
 * during that role appearing below). Ongoing roles (no endDate) sort
 * at the very top.
 */
function commitSortKey(c: Commit): string {
  if (c.type === "role") {
    return c.endDate && c.endDate !== "present" ? c.endDate : "9999-12";
  }
  return c.date;
}

/**
 * Sort commits by date (most recent first). Roles use their endDate so
 * they anchor the top of their segment; non-roles use their own date.
 * When two commits tie on the effective date, roles come FIRST so the
 * role row appears above projects dated at its end date.
 */
export function sortCommitsByDate<T extends Commit>(commits: T[]): T[] {
  return [...commits].sort((a, b) => {
    const d = commitSortKey(b).localeCompare(commitSortKey(a));
    if (d !== 0) return d;
    const aR = a.type === "role" ? 0 : 1;
    const bR = b.type === "role" ? 0 : 1;
    return aR - bR;
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

/**
 * True when the commit's `listedIn` scope includes the given locale.
 * Commits with no `listedIn` field default to "both" (visible in any locale).
 */
export function isCommitListedIn(commit: Commit, locale: Locale): boolean {
  const scope = commit.listedIn ?? "both";
  return scope === "both" || scope === locale;
}

/**
 * Combines `listed` (global hide) and `listedIn` (per-locale scope).
 * The single visibility predicate for index surfaces.
 */
export function isCommitVisibleIn(commit: Commit, locale: Locale): boolean {
  return isCommitListed(commit) && isCommitListedIn(commit, locale);
}

/**
 * The badge label to show for a commit whose intrinsic language differs
 * from the viewer's locale. Returns null when no badge should appear:
 * no language set, language is "both", or language matches locale.
 *
 * Mirrors the /writing list convention: each language is labeled in its
 * own native form ("EN" / "中文") rather than ISO codes.
 */
export function getCommitLanguageBadge(
  commit: Commit,
  locale: Locale,
): "EN" | "中文" | null {
  const lang = commit.language;
  if (!lang || lang === "both" || lang === locale) return null;
  return lang === "en" ? "EN" : "中文";
}

// =============================================================================
// Timeline Data Derivation
// =============================================================================

export interface TimelineData {
  tag: Tag;
  commits: Commit[];
}

/**
 * Per-commit rail info, used to render the right-side bracket on /works.
 */
export interface RailInfo {
  /** ASCII char: ┐ (role top), │ (mid), ┘ (last), or "" when no rail. */
  rail: string;
  /** The role commit's id that owns this row's segment, or null when
   *  the row has no rail (solo role or out-of-tenure commit). */
  segmentId: string | null;
}

/**
 * Compute the right-side rail bracket info for each commit in a tag.
 * The bracket attaches a role (top, sorted by endDate) to every commit
 * dated within its tenure, then wraps up at the last commit in the
 * segment. Rendered right of the dates, corners face LEFT.
 *
 *   ┐  role anchor — top of a multi-commit segment; line goes down
 *   │  mid-segment
 *   ┘  last commit in the segment; wraps the line up-left
 *      (empty)  solo role with no projects, or no role context
 */
export function computeRail(commits: Commit[]): RailInfo[] {
  const result: RailInfo[] = commits.map(() => ({
    rail: "",
    segmentId: null,
  }));

  // roleContextAbove[i] = index of nearest role at or above commit i
  const roleContextAbove: number[] = new Array(commits.length).fill(-1);
  let lastRole = -1;
  for (let i = 0; i < commits.length; i++) {
    if (commits[i].type === "role") lastRole = i;
    roleContextAbove[i] = lastRole;
  }

  // segmentEnd[ctx] = index of the bottom (oldest) commit in role ctx's
  // segment, i.e. the last contiguous row whose context is still ctx.
  const segmentEnd = new Map<number, number>();
  for (let i = commits.length - 1; i >= 0; i--) {
    const ctx = roleContextAbove[i];
    if (ctx !== -1 && !segmentEnd.has(ctx)) segmentEnd.set(ctx, i);
  }

  for (let i = 0; i < commits.length; i++) {
    const ctx = roleContextAbove[i];
    if (ctx === -1) continue;
    const endIdx = segmentEnd.get(ctx)!;
    // Solo role (no descendants): leave blank — bracketing a single row
    // is meaningless visual noise.
    if (ctx === endIdx) continue;

    result[i].segmentId = commits[ctx].id;

    if (commits[i].type === "role") {
      result[i].rail = "┐";
    } else if (i === endIdx) {
      result[i].rail = "┘";
    } else {
      result[i].rail = "│";
    }
  }

  return result;
}

/**
 * Build the timeline data structure from raw LogData.
 * Single source of truth for /works rendering and editor preview.
 *
 * When `locale` is provided, commits are filtered by per-locale visibility
 * (`listedIn`). Omit the locale to include every listed commit (useful for
 * the editor preview).
 */
export function buildTimelineData(
  logData: LogData,
  locale?: Locale,
): TimelineData[] {
  const visible = logData.commits.filter((c) =>
    locale ? isCommitVisibleIn(c, locale) : isCommitListed(c),
  );
  const sortedTags = sortTagsByDate(logData.tags);
  return sortedTags.map((tag) => ({
    tag,
    commits: sortCommitsByDate(visible.filter((c) => c.tagId === tag.id)),
  }));
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
  now: Date = new Date(),
  locale?: Locale,
): Commit[] {
  const includeUnlisted = group.includeUnlisted ?? false;
  const localeScoped = (c: Commit) =>
    !locale || isCommitListedIn(c, locale);

  const listedFilter = (c: Commit) =>
    (includeUnlisted || isCommitListed(c)) && localeScoped(c);

  const base = commits.filter(listedFilter);

  const items: Commit[] =
    "commitIds" in group && group.commitIds
      ? (group.commitIds
          .map((id) => base.find((c) => c.id === id))
          .filter(Boolean) as Commit[])
      : (() => {
          const q = group.query;
          const qIncludeUnlisted = q.includeUnlisted ?? false;
          const pool = (
            qIncludeUnlisted ? commits.filter(localeScoped) : base
          );

          return pool
            .filter((c) => (q.type ? c.type === q.type : true))
            .filter((c) => (q.tagId ? c.tagId === q.tagId : true))
            .filter((c) =>
              q.excludeTypes ? !q.excludeTypes.includes(c.type) : true,
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
    sort === "dateAsc"
      ? a.date.localeCompare(b.date)
      : b.date.localeCompare(a.date),
  );

  return typeof group.limit === "number"
    ? sorted.slice(0, group.limit)
    : sorted;
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

// =============================================================================
// Media Type Guards
// =============================================================================

export function isVideoMedia(media: Media): media is VideoMedia {
  return media.type === "video";
}

export function isEmbedMedia(media: Media): media is EmbedMedia {
  return media.type === "embed";
}

export function isLinkMedia(media: Media): media is LinkMedia {
  return media.type === "link";
}

export function isImageMedia(media: Media): media is ImageMedia {
  return media.type === "image";
}

// =============================================================================
// Thumbnail Derivation
// =============================================================================

/**
 * Extract YouTube video ID from URL
 */
function extractYouTubeId(url: string): string | null {
  if (/^[\w-]{11}$/.test(url)) return url;

  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes("youtu.be")) {
      return urlObj.pathname.slice(1).split("?")[0] || null;
    }
    if (urlObj.pathname.includes("/watch")) {
      return urlObj.searchParams.get("v");
    }
    if (urlObj.pathname.includes("/embed/")) {
      return urlObj.pathname.split("/embed/")[1]?.split("?")[0] || null;
    }
    if (urlObj.pathname.includes("/shorts/")) {
      return urlObj.pathname.split("/shorts/")[1]?.split("?")[0] || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get thumbnail URL for a single media item.
 * Returns null for types that require async fetch (embeds, links without image).
 *
 * Derivation by type:
 * - VideoMedia: YouTube thumbnail URL (derived from ID), or explicit thumbnail
 * - ImageMedia: The image URL itself
 * - EmbedMedia: null (would need OG fetch)
 * - LinkMedia: null (would need OG fetch)
 */
export function getMediaThumbnail(media: Media): string | null {
  switch (media.type) {
    case "video":
      // Use explicit thumbnail if provided
      if (media.thumbnail) return media.thumbnail;
      // Derive from YouTube URL
      if (media.platform === "youtube") {
        const id = extractYouTubeId(media.url);
        return id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : null;
      }
      // Bilibili/Vimeo require API calls, return null
      return null;

    case "image":
      // The image itself is the thumbnail
      return media.url;

    case "embed":
    case "link":
      // Would need async OG fetch
      return null;
  }
}

/**
 * Get the primary thumbnail URL for a commit's media array.
 * Tries each media item in order until one returns a thumbnail.
 */
export function getCommitThumbnail(commit: Commit): string | null {
  for (const m of commit.media ?? []) {
    const thumb = getMediaThumbnail(m);
    if (thumb) return thumb;
  }
  return null;
}

/**
 * Get the primary media item from a commit (for thumbnail display).
 * For projects, prefers non-link media (videos, images) over plain links.
 */
export function getCommitPrimaryMedia(commit: Commit): Media | null {
  const media = commit.media ?? [];
  if (commit.type === "project") {
    return media.find((m) => m.type !== "link") ?? media[0] ?? null;
  }
  return media[0] ?? null;
}

