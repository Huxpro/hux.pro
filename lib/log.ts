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

export type CommitType =
  | "project"
  | "talk"
  | "post"
  | "role"
  | "social"
  | "event";

// =============================================================================
// Media Types - Attachable to any Commit
// =============================================================================

/**
 * Media kinds, separated by *data shape*, not by visual treatment:
 * - "link":         a URL with an optional OG-derived preview card. Presents
 *                   as a pill (corner indicator) or card (full OG-style block).
 * - "social-embed": a native social platform widget (X / Instagram / TikTok)
 *                   that mounts the platform's own iframe/script.
 * - "video":        a video player (YouTube / Bilibili / Vimeo iframe).
 * - "image":        a static image asset.
 *
 * A discriminator field `kind` (not `type`, which is taken by CommitType) keeps
 * the layer crisp: commits have types, media items have kinds.
 */
export type MediaKind = "link" | "social-embed" | "video" | "image";

/**
 * How a `link` renders. Two presentations, one data shape — the explicit
 * acknowledgement that a "card" and a "pill" are the same URL with different
 * dressings (this used to be split across `link` vs non-native `embed`).
 */
export type LinkPresent = "pill" | "card";

/** Video platforms with native iframe support. */
export type VideoPlatform = "youtube" | "bilibili" | "vimeo";

// SocialEmbedPlatform's canonical definition lives in `lib/og-core` (the
// Node snapshot script imports it from there, so it must stay framework-
// agnostic). Re-import + re-export so the type is in scope for the Media
// interfaces below and consumers can keep a single import source.
import type { SocialEmbedPlatform } from "./og-core";
export type { SocialEmbedPlatform };

/**
 * Manual card metadata.
 *
 * Author-curated title/description/image used by the card pipeline as the
 * tier-1 source of truth (beats build-time OG snapshot and runtime crawl).
 * Useful for sites that block server-side scraping (Medium returns 403 to
 * non-browser requests) or where you simply want a curated headline/image.
 * When `title` and `image` are both present the live crawl is skipped.
 */
export interface MediaPreview {
  title?: string;
  description?: string;
  image?: string;
}

/**
 * Pinned media is "always visible above the row's fold" — it stays beneath
 * the row even while the row is collapsed (and renders in the expanded view
 * too). Default is unpinned: only visible once the row is expanded.
 *
 * Meaningful for cards / videos / images. No-op for `pill` (those already
 * live in the folded right rail) and `social-embed` (currently always
 * expanded-only); the field is kept on every kind for schema uniformity.
 *
 * The hover peek view excludes pinned items — they're already on screen so
 * peeking adds nothing. See `getCommitPeekItems`.
 */
type Pinned = { pinned?: true };

/**
 * Link media — a URL with two presentations:
 *  - `pill`: a compact corner indicator (icon + label) in the folded rail.
 *  - `card`: an OG-style preview card (the card pipeline supplies title /
 *    description / image; `preview` is the author-authoritative override).
 *
 * `label` / `icon` are pill-only display overrides; harmless on a card.
 */
/** Per-locale URL map. Keys present are the locales a resource exists in. */
export type LocaleUrls = Partial<Record<"en" | "zh", string>>;

/**
 * Set server-side at enrichment time for internal `/writing/{slug}/{lang}`
 * URLs. Not author-authored; written by the enrichment pipeline.
 */
export interface InternalLinkMeta {
  kind: "writing";
  slug: string;
  urls: LocaleUrls;
}

export interface LinkMedia extends Pinned {
  kind: "link";
  url: string;
  present: LinkPresent;
  /** Manual card metadata; skips the runtime crawl when title+image set. */
  preview?: MediaPreview;
  /** Pill-only: label override (defaults to domain). */
  label?: string;
  /** Pill-only: icon key (e.g. "github", "globe"). */
  icon?: string;
  /** Resolved at enrichment time — see {@link InternalLinkMeta}. */
  internal?: InternalLinkMeta;
}

/**
 * Social embed — a native widget for X / Instagram / TikTok. Distinct kind
 * from `link` because it's a live mini-app, not an OG card; it doesn't go
 * through the card pipeline.
 */
export interface SocialEmbedMedia extends Pinned {
  kind: "social-embed";
  url: string;
  /** Platform hint; auto-detected from URL when omitted. */
  platform?: SocialEmbedPlatform;
}

/** Video player — YouTube / Bilibili / Vimeo iframe with cover thumbnail. */
export interface VideoMedia extends Pinned {
  kind: "video";
  url: string;
  platform: VideoPlatform;
  thumbnail?: string;
}

/** Static image asset. */
export interface ImageMedia extends Pinned {
  kind: "image";
  url: string;
  alt?: string;
}

/**
 * Discriminated union of all media kinds.
 * Use `media.kind` to narrow and access kind-specific fields.
 */
export type Media = LinkMedia | SocialEmbedMedia | VideoMedia | ImageMedia;

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
  /**
   * Explicit role attachment.
   * - `undefined` (default): use tenure auto-detect — a commit dated
   *   within a role's [date, endDate] window joins that role's bracket.
   * - `"<role-id>"`: force-attach to that role even if the commit is
   *   outside its tenure window. Rendered as an animated beam when the
   *   role is non-adjacent in the sort order.
   * - `null`: force-detach — no rail or beam even if in tenure.
   */
  attachedTo?: string | null;
  /**
   * Per-commit override that hides the date column and renders the
   * commit's location (for roles) instead. Useful for education
   * entries that overlap with concurrent work and would otherwise
   * highlight the overlap. Orthogonal to `sortBy` — hiding the date
   * is purely a display concern.
   */
  hideDate?: boolean;
  /**
   * Which date field anchors this commit in the timeline sort.
   * - `"endDate"` (default for roles): role row sits at the top of
   *   its tenure cluster.
   * - `"date"`: row sits at its start date — e.g. an education entry
   *   that should land at its enrollment year rather than anchor
   *   the top of an unrelated cluster via its graduation year.
   * - undefined: type default (`endDate` for roles, `date` otherwise).
   */
  sortBy?: "date" | "endDate";
  /**
   * Override the default icon picked by commit type. Useful when
   * the type is correct but the iconography wants a flavor — e.g.
   * an education `role` rendered with `graduation-cap` instead of
   * the default briefcase.
   */
  icon?: "graduation-cap";
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
// Event Commit (Life event / bracket marker — moves, graduations, joins)
// -----------------------------------------------------------------------------

/**
 * An ambient life event that contextualizes nearby work commits but is
 * not itself a "work artifact" — moves, graduations, tenure beginnings.
 * Rendered as muted italic on the timeline, no links, no expand.
 */
export interface EventCommit extends BaseCommit {
  type: "event";
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
  | SocialCommit
  | EventCommit;

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
 * Format a commit's date for display.
 *
 * Roles always render a date range — even without an `endDate`, an
 * open-ended role reads as `"2023 — Present"` so the row visibly
 * communicates "still ongoing" rather than collapsing to a single
 * month label (which would otherwise read like a one-off project).
 *
 * Non-roles fall back to a single `"Mon YYYY"` label when no endDate
 * is set, since most projects/talks are one-shot events.
 */
export function formatCommitDate(commit: Commit, locale: Locale): string {
  if (commit.endDate) {
    return formatDateRange(commit.date, commit.endDate, locale);
  }

  if (commit.type === "role") {
    return formatDateRange(commit.date, undefined, locale);
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
    event: { en: "Event", zh: "事件" },
  };

  return localize(labels[type], locale);
}

// =============================================================================
// Committers — roles reframed as "virtual committers" (git author/committer)
// =============================================================================

/**
 * The bold idea behind /works: **every commit is a project**, and a `role`
 * isn't a piece of work at all — it's the *identity the work was committed as*.
 *
 * Borrowing git's author/committer split: the real author is always "Hux",
 * while each employment (or education) is the **virtual committer** stamped on
 * the artifacts produced during its tenure. React Forget is committed "as a
 * Meta Software Engineer"; Taobao / Alitrip "as an Alibaba Front-End Engineer".
 *
 * Roles stay modelled as `RoleCommit` — so the editor, the home widget, and
 * the tenure rail keep working unchanged — but on the timeline they render as
 * committer headers anchoring the cluster of artifacts they authored, rather
 * than as work rows of their own.
 */
export type Employment = RoleCommit;

/** True for the work-artifact commit types (everything a committer authors). */
export function isArtifactCommit(commit: Commit): boolean {
  return commit.type !== "role";
}

/**
 * The single stable letter shown in a committer's avatar — the org's initial,
 * the way a git remote avatars an org. Falls back to a neutral dot.
 */
export function getCommitterInitial(company: string): string {
  const ch = company.trim().charAt(0);
  return ch ? ch.toUpperCase() : "·";
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
    event: "·",
  };
  return icons[type];
}

// =============================================================================
// Sorting
// =============================================================================

/**
 * Sort key for a commit. Honors the explicit `sortBy` field when set;
 * otherwise falls back to type defaults: roles sit at the top of their
 * tenure cluster by sorting on `endDate` (ongoing roles → "9999-12"),
 * non-roles sort by their own `date`.
 */
function commitSortKey(c: Commit): string {
  const explicit = c.sortBy;
  if (explicit === "date") return c.date;
  if (explicit === "endDate") {
    return c.endDate && c.endDate !== "present" ? c.endDate : "9999-12";
  }
  // Type defaults.
  if (c.type === "role") {
    return c.endDate && c.endDate !== "present" ? c.endDate : "9999-12";
  }
  return c.date;
}

/**
 * Sort commits by date (most recent first). Tie-break order depends on
 * the role's sort orientation:
 *
 * - Roles that sort by `endDate` (the default): role comes BEFORE
 *   non-roles at tie, so the role row appears above its projects
 *   dated at the same month — anchoring the TOP of the cluster.
 * - Roles that sort by `date` (start): role comes AFTER non-roles at
 *   tie, so the role row settles BELOW its same-month projects —
 *   anchoring the BOTTOM of the cluster.
 * - Non-roles: middle tier; order amongst themselves is stable.
 */
export function sortCommitsByDate<T extends Commit>(commits: T[]): T[] {
  const tier = (c: Commit) => {
    if (c.type !== "role") return 1;
    return c.sortBy === "date" ? 2 : 0;
  };
  return [...commits].sort((a, b) => {
    const d = commitSortKey(b).localeCompare(commitSortKey(a));
    if (d !== 0) return d;
    return tier(a) - tier(b);
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
 * A non-adjacent role attachment, rendered as an animated ASCII beam
 * that climbs the right gutter from `fromIdx` row up to `toIdx` row.
 */
export interface BeamLink {
  fromIdx: number;
  toIdx: number;
  fromHash: string;
  toHash: string;
  roleId: string;
}

/**
 * Compute the rail bracket info for each commit in a tag.
 *
 * Each non-role commit is assigned to the role whose tenure window
 * [role.date, role.endDate] contains it. When multiple roles overlap
 * (e.g. an internship inside a school's larger window), the role with
 * the SMALLEST window wins — most specific membership.
 *
 * Once members are assigned, each cluster (role + members) computes
 * rail chars by POSITION in the sorted array, not by which row is the
 * role. So whether the role anchors at the top (`sortBy: "endDate"`,
 * the default) or the bottom (`sortBy: "date"`), the rail traces from
 * the topmost row in the cluster down to the bottommost.
 *
 *   ┐  topmost row in cluster — line goes down only
 *   │  mid-cluster row — line both directions
 *   ┘  bottommost row in cluster — line goes up only
 *      (empty)  solo role, out-of-tenure commit, or no role context
 *
 * Tenure compared at month granularity (YYYY-MM).
 *
 * Honours `attachedTo`:
 *   - `null`     → force-detach, no rail even if in tenure.
 *   - `"<id>"`   → handled by computeBeams (drawn as a beam, not a bracket).
 *   - undefined  → tenure auto-detect (default).
 */
export function computeRail(commits: Commit[]): RailInfo[] {
  const result: RailInfo[] = commits.map(() => ({
    rail: "",
    segmentId: null,
  }));

  const month = (s: string) => s.slice(0, 7);
  // Convert YYYY-MM to absolute month index for cheap window arithmetic.
  // "9999-12" is the open-ended sentinel for ongoing roles; treat it as
  // a very large number so the window size is large (less specific) and
  // bounded date roles win the smallest-window comparison.
  const monthIdx = (m: string): number => {
    if (m === "9999-12") return Number.MAX_SAFE_INTEGER;
    const [y, mo] = m.split("-").map(Number);
    return y * 12 + (mo - 1);
  };

  // Index each role's tenure window.
  type Window = { start: string; end: string; startIdx: number; endIdx: number };
  const roleWindows = new Map<number, Window>();
  for (let i = 0; i < commits.length; i++) {
    const c = commits[i];
    if (c.type !== "role") continue;
    const r = c as RoleCommit;
    const start = month(r.date);
    const end =
      r.endDate && r.endDate !== "present" ? month(r.endDate) : "9999-12";
    roleWindows.set(i, {
      start,
      end,
      startIdx: monthIdx(start),
      endIdx: monthIdx(end),
    });
  }

  // Assign each non-role commit (without explicit attachedTo) to the
  // smallest-window role that contains its date.
  const assignment: number[] = new Array(commits.length).fill(-1);
  for (let i = 0; i < commits.length; i++) {
    const c = commits[i];
    if (c.type === "role") continue;
    if (c.attachedTo !== undefined) continue;
    const cm = month(c.date);
    let bestRole = -1;
    let bestSize = Infinity;
    for (const [roleIdx, w] of roleWindows) {
      if (cm < w.start || cm > w.end) continue;
      const size = w.endIdx - w.startIdx;
      if (size < bestSize) {
        bestSize = size;
        bestRole = roleIdx;
      }
    }
    assignment[i] = bestRole;
  }

  // Build clusters in a single pass over the sorted commits. For each
  // row, decide which cluster it belongs to: a non-role with assignment
  // joins that role's cluster; a role that owns one or more assignments
  // joins its own. The push order matches sort order, so the resulting
  // index arrays are ascending without a follow-up sort.
  const roleHasMembers = new Set<number>();
  for (const r of assignment) if (r !== -1) roleHasMembers.add(r);

  const clusters = new Map<number, number[]>();
  for (let i = 0; i < commits.length; i++) {
    const owner =
      commits[i].type === "role" && roleHasMembers.has(i) ? i : assignment[i];
    if (owner === -1) continue;
    if (!clusters.has(owner)) clusters.set(owner, []);
    clusters.get(owner)!.push(i);
  }

  // Assign rail chars per cluster — topmost row gets ┐, bottommost
  // gets ┘, mids get │. Solo roles (single-element clusters never
  // reach here since they're not seeded above) get no rail.
  for (const [roleIdx, indices] of clusters) {
    if (indices.length < 2) continue;
    const topIdx = indices[0];
    const bottomIdx = indices[indices.length - 1];
    const id = commits[roleIdx].id;
    for (const i of indices) {
      result[i].segmentId = id;
      result[i].rail = i === topIdx ? "┐" : i === bottomIdx ? "┘" : "│";
    }
  }

  return result;
}

/**
 * Derive inferred-tenure beams from a rail computation: every row
 * `computeRail` slotted into a tenure cluster (segmentId set) gets a
 * beam from itself to the role anchor, except the role itself.
 *
 * Pulled out so the UI doesn't have to walk the rail + look up roles
 * by `findIndex` per row (which was O(N²) at the call site).
 */
export function computeInferredBeams(
  commits: Commit[],
  rail: RailInfo[],
): BeamLink[] {
  const idToIdx = new Map<string, number>();
  for (let i = 0; i < commits.length; i++) idToIdx.set(commits[i].id, i);

  const hashCache = new Map<string, string>();
  const hashOf = (id: string) => {
    const cached = hashCache.get(id);
    if (cached !== undefined) return cached;
    const h = computeCommitHash(id);
    hashCache.set(id, h);
    return h;
  };

  const beams: BeamLink[] = [];
  for (let i = 0; i < commits.length; i++) {
    const sid = rail[i].segmentId;
    if (!sid) continue;
    if (commits[i].id === sid) continue;
    const toIdx = idToIdx.get(sid);
    if (toIdx === undefined) continue;
    beams.push({
      fromIdx: i,
      toIdx,
      fromHash: hashOf(commits[i].id),
      toHash: hashOf(sid),
      roleId: sid,
    });
  }
  return beams;
}

/**
 * Compute explicit attachment links: commits with `attachedTo: "<id>"`
 * pointing at another commit in the same tag. Rendered as a persistent
 * connector line in the icon column (see TimelineConnector).
 *
 * Targets can be roles (an artifact attached to a tenure context) or
 * events (an artifact attached to an ambient period like a sabbatical).
 * Silently skips when the target is missing — a typo in JSON degrades
 * to "no connector" rather than crashing.
 */
export function computeBeams(commits: Commit[]): BeamLink[] {
  const beams: BeamLink[] = [];
  for (let i = 0; i < commits.length; i++) {
    const c = commits[i];
    if (typeof c.attachedTo !== "string") continue;
    const toIdx = commits.findIndex((x) => x.id === c.attachedTo);
    if (toIdx < 0) continue;
    const targetType = commits[toIdx].type;
    if (targetType !== "role" && targetType !== "event") continue;
    beams.push({
      fromIdx: i,
      toIdx,
      fromHash: computeCommitHash(c.id),
      toHash: computeCommitHash(commits[toIdx].id),
      roleId: commits[toIdx].id,
    });
  }
  return beams;
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
  opts?: { includeAll?: boolean },
): TimelineData[] {
  const visible = logData.commits.filter((c) =>
    opts?.includeAll
      ? true
      : locale
        ? isCommitVisibleIn(c, locale)
        : isCommitListed(c),
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

export function isEventCommit(commit: Commit): commit is EventCommit {
  return commit.type === "event";
}

// =============================================================================
// Media Kind Guards
// =============================================================================

export function isLinkMedia(media: Media): media is LinkMedia {
  return media.kind === "link";
}

export function isSocialEmbedMedia(media: Media): media is SocialEmbedMedia {
  return media.kind === "social-embed";
}

export function isVideoMedia(media: Media): media is VideoMedia {
  return media.kind === "video";
}

export function isImageMedia(media: Media): media is ImageMedia {
  return media.kind === "image";
}

/** A link that presents as an OG-style card (vs. a pill). */
export function isLinkCard(media: Media): media is LinkMedia & { present: "card" } {
  return media.kind === "link" && media.present === "card";
}

/** A link that presents as a corner-rail pill (vs. a card). */
export function isLinkPill(media: Media): media is LinkMedia & { present: "pill" } {
  return media.kind === "link" && media.present === "pill";
}

/** True when an item is pinned above the row's fold. */
export function isPinnedMedia(media: Media): boolean {
  return media.pinned === true;
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
 *
 * Derivation by kind:
 * - VideoMedia:       explicit `thumbnail`, else YouTube's derived URL
 *                     (Bilibili / Vimeo: must be explicit — no public derivation).
 * - ImageMedia:       the image URL itself.
 * - LinkMedia (card): the resolved `preview.image` (card pipeline writes this
 *                     server-side from the OG snapshot + manual override).
 * - LinkMedia (pill): null — pills don't carry a thumbnail.
 * - SocialEmbedMedia: null — widgets render their own cover.
 */
export function getMediaThumbnail(media: Media): string | null {
  switch (media.kind) {
    case "video":
      if (media.thumbnail) return media.thumbnail;
      if (media.platform === "youtube") {
        const id = extractYouTubeId(media.url);
        return id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : null;
      }
      return null;

    case "image":
      return media.url;

    case "link":
      // Cards may have a baked-in preview.image (resolved server-side from
      // og-snapshot + manual override). Pills never carry one.
      return media.present === "card" ? media.preview?.image ?? null : null;

    case "social-embed":
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
 * Get every thumbnail-able URL across a commit's media, preserving order.
 *
 * The hover "peek view" uses this to communicate richness: one thumbnail
 * renders flat; two or more render as a stacked deck. Pills and social
 * widgets contribute nothing (they have no native cover); videos and images
 * always contribute; link cards contribute when a preview image is resolved.
 */
export function getCommitThumbnails(commit: Commit): string[] {
  const out: string[] = [];
  for (const m of commit.media ?? []) {
    const t = getMediaThumbnail(m);
    if (t) out.push(t);
  }
  return out;
}

/**
 * Single entry in the hover-peek deck. Discriminated so the renderer can
 * decide layout per item:
 *  - `"card"`  → a mini OG-style preview (image + domain + title), used for
 *                `kind:"link", present:"card"` media that has a resolved
 *                preview image. Reads like the full LinkCard but at peek size.
 *  - `"thumb"` → a bare cover image, used for videos and image media. The
 *                player / asset IS the visual signal; no text strip needed.
 */
export type PeekItem =
  | {
      kind: "card";
      url: string;
      title?: string;
      description?: string;
      image: string;
      internal?: InternalLinkMeta;
    }
  | { kind: "thumb"; url: string; image: string };

/**
 * Collect peek-renderable items from a commit's media, preserving order.
 *
 * Reconciliation with `pinned`:
 *   Peek = "what's *behind* the fold". Pinned media is already visible
 *   inline in the row, so peeking at it adds nothing — we filter it out.
 *   Concretely: a commit with 3 media (1 pinned, 2 default) peeks the 2
 *   hidden ones; a commit whose media is *entirely* pinned peeks nothing
 *   and falls back to the description. This keeps the peek's role crisp:
 *   it surfaces what the user can't currently see.
 */
export function getCommitPeekItems(commit: Commit): PeekItem[] {
  const out: PeekItem[] = [];
  for (const m of commit.media ?? []) {
    if (isPinnedMedia(m)) continue; // already visible inline; nothing to peek
    if (isLinkMedia(m) && m.present === "card") {
      const image = m.preview?.image;
      if (image) {
        out.push({
          kind: "card",
          url: m.url,
          title: m.preview?.title,
          description: m.preview?.description,
          image,
          internal: m.internal,
        });
      }
      continue;
    }
    const t = getMediaThumbnail(m);
    if (t) out.push({ kind: "thumb", url: m.url, image: t });
  }
  return out;
}

/**
 * Get the primary media item from a commit (for thumbnail display).
 * For projects, prefers richer media (video / image / card) over plain pills.
 */
export function getCommitPrimaryMedia(commit: Commit): Media | null {
  const media = commit.media ?? [];
  if (commit.type === "project") {
    return media.find((m) => !isLinkPill(m)) ?? media[0] ?? null;
  }
  return media[0] ?? null;
}
