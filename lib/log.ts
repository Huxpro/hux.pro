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
 * - "slides":       a reveal.js / HTML slide deck played in an ~80% modal
 *                   iframe (e.g. huangxuan.me decks from Yanshuo.io).
 * - "image":        a static image asset.
 *
 * A discriminator field `kind` (not `type`, which is taken by CommitType) keeps
 * the layer crisp: commits have types, media items have kinds.
 */
export type MediaKind = "link" | "social-embed" | "video" | "slides" | "image";

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
// Shared cover-fit vocabulary, from the framework-agnostic content layer, so
// both hover surfaces (and the node snapshot script that imports this file)
// speak the same language.
import type { CoverFit } from "./content";
export type { CoverFit };

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
  /**
   * How this card's image fills the hover-peek cover slot (see PeekCover):
   *  - `"cover"` (default): fixed-aspect slot, image cropped to fill.
   *  - `"natural"`: slot matches the image's intrinsic aspect (no crop).
   * Only affects the single-item commit peek; the stacked deck always uses
   * fixed rectangles so its layered transforms overlap cleanly.
   */
  fit?: CoverFit;
  /** Fixed-mode aspect ratio (any CSS `aspect-ratio` value, e.g. `"3 / 4"`). */
  aspect?: string;
}

/**
 * Pinned media is "always visible above the row's fold" — it stays beneath
 * the row even while the row is collapsed (and renders in the expanded view
 * too). Default is unpinned: only visible once the row is expanded.
 *
 * Meaningful for cards / videos / slides / images. No-op for `pill` (those
 * already live in the folded right rail) and `social-embed` (currently always
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
  /**
   * Optional per-locale URL variants for the same underlying resource
   * (e.g. an EN and ZH page of the same blog post). When set, the card
   * click-target and OG preview are picked based on the viewer's
   * locale, falling back to `url` when the locale variant is absent.
   *
   * Author-authored. The snapshot pipeline crawls every URL in this
   * map in addition to `url`; enrichment layers each URL's OG data
   * into `previews[locale]` for the client to pick from.
   */
  urls?: LocaleUrls;
  present: LinkPresent;
  /** Manual card metadata; skips the runtime crawl when title+image set. */
  preview?: MediaPreview;
  /**
   * Per-locale OG previews, populated by `enrichLogDataWithPreviews`
   * when the media has a `urls` map. Never author-authored — the
   * enrichment pipeline writes it before the render layer reads it.
   * When absent (single-URL cards), the top-level `preview` is used.
   */
  previews?: Partial<Record<"en" | "zh", MediaPreview>>;
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

/**
 * HTML slide deck — typically a reveal.js export (Yanshuo.io / self-hosted).
 * Renders as a cover with a play affordance; click opens the in-site
 * SlideModal (~80% viewport iframe) so visitors never leave the page.
 */
export interface SlidesMedia extends Pinned {
  kind: "slides";
  /** Direct URL of the playable deck (not the wrapping blog/keynote page). */
  url: string;
  /** Cover image for the thumbnail / peek / compact surfaces. */
  thumbnail?: string;
  /** Accessible title for the modal iframe. */
  title?: string;
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
export type Media =
  | LinkMedia
  | SocialEmbedMedia
  | VideoMedia
  | SlidesMedia
  | ImageMedia;

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
  /**
   * Explicit identity attachment for this commit's `<handle>` byline
   * and rail clustering. Set this when the commit falls outside any
   * role's tenure window but should still count as authored under a
   * given identity (e.g. an award received a month after leaving Meta).
   *
   * When absent, identity is resolved by walking `attachedTo` (if it
   * points to a role) and then by smallest-window tenure auto-detect.
   */
  identityId?: string;
  /**
   * Sub-org / team the commit sits under. Renders as the row's
   * subtitle chip on project rows — e.g. `"React Core team @ Meta"`,
   * `"PLR @ Meta"`, `"Lynx @ ByteDance"`. Set on a project to override
   * per-row; set on a role range to serve as the default for every
   * project resolved under that role (Lynx-era projects inherit
   * `Lynx @ ByteDance` without repeating the string). Sparse rendering
   * blanks the chip when it repeats the previous project's team, so
   * the line only prints where the value actually changes.
   */
  team?: LocalizedString;
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
  /**
   * Required for role commits: the identity this role is an instance of.
   * Multiple roles can share the same `identityId` (Meta SWE + two
   * summer interns all point to identity `"meta"`), which is how the
   * rail clusters them into one continuous run — the identity IS the
   * cross-tenure link.
   *
   * `handle` is stored on the identity only. `company` is copied onto
   * the role by `normalizeLogData` at load time (from the identity's
   * `company` or the range's optional `companyOverride`) so downstream
   * row-rendering code can stay identity-map-agnostic.
   */
  identityId: string;
  /**
   * Company label shown on the row's meta line. On disk this field is
   * NOT stored on the role range — it comes from the identity (or the
   * range's `companyOverride`). `normalizeLogData` fills it in when
   * flattening ranges into commits; `denormalizeLogData` strips it
   * back out on save so it stays a single source of truth on the
   * identity.
   */
  company: LocalizedString;
  /**
   * Per-range override for `company` when a specific instance wants a
   * different label than the identity's canonical one — e.g. a Meta
   * intern at "Meta Reality Labs" while the identity stays "Meta".
   */
  companyOverride?: LocalizedString;
  location?: string;
  url?: string;
  /**
   * Suppress this role's own timeline row. The role still exists as a
   * range within its identity (contributes to tenure inference and its
   * `<handle>` still shows up on other commits in-window), it just
   * doesn't take a row of its own — used when the identity's contained
   * projects speak for the tenure and the role row would be redundant.
   */
  hideRow?: boolean;
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

// =============================================================================
// Identity Types
// =============================================================================

/**
 * An `Identity` is the persistent "who I was when I committed this" —
 * a shared byline that can span multiple role instances. Two summer
 * interns and a full-time engineer at Meta all point to the same
 * identity (handle: `jsx@fb.com`, company: Meta); each role only
 * differs in title / tenure / description / team.
 *
 * Metadata only — no ranges here at runtime; ranges are materialized
 * into top-level role commits by `normalizeLogData` and carry an
 * `identityId` back-reference for lookup.
 */
export interface Identity {
  handle: string;
  company: LocalizedString;
  /** Rail / avatar accent color (oklch or any CSS color). Optional. */
  accentColor?: string;
}

/**
 * Authoring-only nested shape: an `Identity` plus its collected role
 * ranges. On disk, `content/log.json` uses this — everything about
 * "Meta" (handle, company, and every role instance under it) sits in
 * one place. `normalizeLogData` flattens the ranges into `commits[]`
 * so the downstream pipeline (sort / rail / groups / og) keeps
 * operating on a plain flat commit array.
 *
 * `tagId` here is the identity-level default; any range may override.
 */
export interface RawIdentity extends Identity {
  tagId?: string;
  ranges?: RawRoleRange[];
}

/**
 * A role range under an identity, as it appears on disk. All the
 * BaseCommit + RoleCommit fields EXCEPT `type` and `identityId` —
 * both are auto-injected by the normalizer. `tagId` may be omitted
 * to inherit from the enclosing identity.
 */
export interface RawRoleRange
  extends Omit<BaseCommit, "identityId" | "tagId"> {
  tagId?: string;
  companyOverride?: LocalizedString;
  location?: string;
  url?: string;
  hideRow?: boolean;
  icon?: "graduation-cap";
  sortBy?: "date" | "endDate";
}

/**
 * On-disk / editor-authoring shape. Read via `normalizeLogData` before
 * handing to any downstream consumer.
 */
export interface RawLogData {
  tags: Tag[];
  groups?: Group[];
  /**
   * Nested identities keyed by short stable id (`meta`, `bytedance`,
   * `rit`). Each identity carries its role ranges inline for
   * co-located authoring — no way for a range to drift out of sync
   * with its identity's handle/company.
   */
  identities?: Record<string, RawIdentity>;
  commits: Commit[];
}

/**
 * Runtime shape used by every downstream consumer. Roles from
 * `identities[*].ranges` have been flattened into `commits` with
 * `type: "role"` and `identityId` back-reference injected. The
 * `identities` map is preserved as a metadata lookup (handle,
 * company, accent color) — no ranges live inside it at runtime.
 */
export interface LogData {
  tags: Tag[];
  groups?: Group[];
  identities?: Record<string, Identity>;
  commits: Commit[];
}

// =============================================================================
// Loader: nested-source → flat runtime
// =============================================================================

/**
 * Flatten `raw.identities[*].ranges` into top-level role commits and
 * strip the ranges from the identity map. Idempotent when given an
 * already-flat `LogData` (no `identities` key, or identities present
 * without `ranges`) so all read sites can call it unconditionally.
 */
export function normalizeLogData(raw: RawLogData | LogData): LogData {
  const identityMeta: Record<string, Identity> = {};
  const extraRoles: Commit[] = [];

  const rawIdentities = raw.identities as
    | Record<string, RawIdentity | Identity>
    | undefined;

  if (rawIdentities) {
    for (const [id, def] of Object.entries(rawIdentities)) {
      identityMeta[id] = {
        handle: def.handle,
        company: def.company,
        accentColor: def.accentColor,
      };
      const ranges = (def as RawIdentity).ranges;
      const defaultTagId = (def as RawIdentity).tagId;
      if (!ranges) continue;
      for (const range of ranges) {
        // Copy `company` onto the runtime role from the identity (or
        // the range's per-instance override). Storing it here keeps
        // every row-rendering path identity-map-agnostic — commit-data,
        // commit-card, editor forms all just read `role.company`.
        const company = range.companyOverride ?? def.company;
        const roleCommit = {
          ...range,
          type: "role" as const,
          identityId: id,
          tagId: range.tagId ?? defaultTagId ?? "",
          company,
        } as RoleCommit;
        extraRoles.push(roleCommit);
      }
    }
  }

  return {
    tags: raw.tags,
    groups: raw.groups,
    identities: Object.keys(identityMeta).length ? identityMeta : undefined,
    commits: [...raw.commits, ...extraRoles],
  };
}

/**
 * Reverse of `normalizeLogData` for editor-save round-trips. Pulls
 * every `type: "role"` commit with an `identityId` out of the flat
 * `commits[]` and re-nests it under its identity's `ranges`. Non-role
 * commits (and any orphan roles without a matching identity) stay in
 * top-level `commits[]`.
 *
 * Preserves the nested-authoring shape on disk even after the editor
 * saves — the flat runtime shape never touches `log.json`.
 */
export function denormalizeLogData(flat: LogData): RawLogData {
  const identities: Record<string, RawIdentity> = {};

  if (flat.identities) {
    for (const [id, meta] of Object.entries(flat.identities)) {
      identities[id] = {
        handle: meta.handle,
        company: meta.company,
        accentColor: meta.accentColor,
        ranges: [],
      };
    }
  }

  const restCommits: Commit[] = [];
  for (const c of flat.commits) {
    if (c.type === "role" && c.identityId && identities[c.identityId]) {
      const idDef = identities[c.identityId];
      // Strip fields that live on the identity (company, identityId,
      // type) so they don't get duplicated in the on-disk range —
      // the identity is the single source of truth.
      const {
        identityId: _idRef,
        type: _type,
        company: _company,
        ...rangeFields
      } = c;
      idDef.ranges!.push(rangeFields as RawRoleRange);
    } else {
      restCommits.push(c);
    }
  }

  // Prune the `ranges: []` field on identities that ended up empty so
  // the serialized JSON stays compact.
  for (const id of Object.keys(identities)) {
    if (identities[id].ranges && identities[id].ranges!.length === 0) {
      delete identities[id].ranges;
    }
  }

  return {
    tags: flat.tags,
    groups: flat.groups,
    identities: Object.keys(identities).length ? identities : undefined,
    commits: restCommits,
  };
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
 * The badge label ("EN" / "中文", native form, not ISO codes) for a commit's
 * intrinsic language. Returns null when no badge should appear: no language
 * set, or language is "both".
 *
 * A talk is delivered in one language and can't be translated, so its badge
 * is always shown — the language is intrinsic information the viewer should
 * see regardless of their own locale. For translatable works (posts, whose
 * text has both an EN and a 中文 version), the badge only flags a *mismatch*
 * — i.e. "this piece isn't in your locale" — so it stays silent when the
 * language already matches the viewer.
 */
export function getCommitLanguageBadge(
  commit: Commit,
  locale: Locale,
): "EN" | "中文" | null {
  const lang = commit.language;
  if (!lang || lang === "both") return null;
  if (commit.type !== "talk" && lang === locale) return null;
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
 * Under the identity model, the rail groups **consecutive commits
 * sharing the same resolved `identityId`** — the byline handle IS the
 * clustering key. Two summer interns + a full-time engineer + all the
 * projects during Meta tenure resolve to identity `"meta"` and form
 * one continuous ┐│┘ bracket regardless of role-instance boundaries
 * inside. When the identity changes (Meta → RIT), the rail breaks.
 *
 *   ┐  topmost row in cluster — line goes down only
 *   │  mid-cluster row — line both directions
 *   ┘  bottommost row in cluster — line goes up only
 *      (empty)  no cluster, or single-row identity, or no identity
 *
 * `segmentId` is set to the identity id for every clustered row
 * (including single-row identities, so downstream can still identify
 * "which cluster does this row belong to" for hover/selection).
 * `rail` is only set when there's an actual bracket to draw.
 */
export function computeRail(commits: Commit[]): RailInfo[] {
  const result: RailInfo[] = commits.map(() => ({
    rail: "",
    segmentId: null,
  }));

  // Resolve identity for every commit. Non-role commits with no
  // identity (attachedTo:null, or no tenure fit) come back as null —
  // those rows are rail-less.
  const iids: (string | null)[] = commits.map(
    (c) => resolveIdentity(c, commits)?.identityId ?? null,
  );

  // Walk in sort order, grouping consecutive same-identity rows.
  let i = 0;
  while (i < commits.length) {
    const iid = iids[i];
    if (!iid) {
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < commits.length && iids[j + 1] === iid) j += 1;

    // Stamp segmentId for every row in the cluster (even single-row —
    // preserves "belongs to identity X" for downstream lookups).
    for (let k = i; k <= j; k++) result[k].segmentId = iid;

    // Bracket glyphs only when there's actually more than one row to
    // bracket. A solo commit has segmentId but no rail char.
    if (j > i) {
      for (let k = i; k <= j; k++) {
        result[k].rail = k === i ? "┐" : k === j ? "┘" : "│";
      }
    }

    i = j + 1;
  }

  return result;
}

/**
 * Re-derive rail glyphs after some rows are hidden (currently: roles
 * with `hideRow: true`). The identity cluster (segmentId) is
 * unchanged — we just shift the `┐` / `┘` top/bottom markers onto the
 * first/last *visible* row in each cluster, and clear the hidden
 * row's own rail so it contributes nothing to the gutter.
 *
 * Called after `computeRail` so the identity clustering stays derived
 * from the full data (hidden roles still contribute their handle /
 * tenure to identity resolution for surrounding commits).
 */
export function adjustRailForHidden(
  commits: Commit[],
  rail: RailInfo[],
): RailInfo[] {
  const isHidden = (c: Commit) => c.type === "role" && c.hideRow === true;

  const hidden = new Set<number>();
  for (let i = 0; i < commits.length; i++) {
    if (isHidden(commits[i])) hidden.add(i);
  }
  if (hidden.size === 0) return rail;

  const result = rail.map((r) => ({ ...r }));

  // Group visible rows by segmentId and re-stamp ┐ / │ / ┘.
  const visibleBySegment = new Map<string, number[]>();
  for (let i = 0; i < commits.length; i++) {
    if (hidden.has(i)) continue;
    const sid = result[i].segmentId;
    if (!sid) continue;
    if (!visibleBySegment.has(sid)) visibleBySegment.set(sid, []);
    visibleBySegment.get(sid)!.push(i);
  }
  for (const [, indices] of visibleBySegment) {
    if (indices.length < 2) {
      // Hiding the role collapsed the cluster to a single visible row —
      // no rail glyph (matches the "solo role" baseline).
      for (const i of indices) result[i].rail = "";
      continue;
    }
    const topIdx = indices[0];
    const bottomIdx = indices[indices.length - 1];
    for (const i of indices) {
      result[i].rail = i === topIdx ? "┐" : i === bottomIdx ? "┘" : "│";
    }
  }

  // Hidden rows themselves: drop rail/segmentId — they won't render
  // anyway, but be defensive against downstream consumers that walk
  // the array without checking visibility.
  for (const i of hidden) {
    result[i].rail = "";
    result[i].segmentId = null;
  }
  return result;
}

/**
 * Placeholder: identity clusters have no single anchor row to beam
 * to, and cluster hover is CSS-only via `group/tenure`. Beams are
 * only used for explicit `attachedTo` links (see `computeBeams`).
 * Kept so consumers that mix inferred + explicit beams keep a stable
 * shape at the call site.
 */
export function computeInferredBeams(
  _commits: Commit[],
  _rail: RailInfo[],
): BeamLink[] {
  return [];
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
    // attachedTo can target any anchor row we're willing to draw a
    // connector to: roles (tenure context), events (life markers),
    // and projects (a talk pointing at the project it presents,
    // an artifact pointing at its parent codebase, etc.). Skip
    // targets that don't render as anchor rows (e.g. another talk).
    const targetType = commits[toIdx].type;
    if (
      targetType !== "role" &&
      targetType !== "event" &&
      targetType !== "project"
    )
      continue;
    // If the target is a hidden role, drop the beam — the connector
    // has nothing to land on. (Projects don't have a hideRow flag.)
    const target = commits[toIdx];
    if (target.type === "role" && target.hideRow === true) continue;
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
 * The result of resolving a commit's authorial context:
 *  - `identityId` is the durable byline id — what the rail clusters
 *    on and what feeds `<handle>` (via `identities[identityId].handle`).
 *  - `role` is the specific role instance whose title / tenure /
 *    description feed the expanded author block. Absent when no role
 *    range in the same identity contains the commit's date (e.g. an
 *    award received a month after the tenure ended and only linked via
 *    explicit `identityId`).
 */
export interface ResolvedIdentity {
  identityId: string;
  role: RoleCommit | null;
}

// Cheap module-level helpers so identity resolution doesn't rebuild
// them on every call. `9999-12` is the open-ended-tenure sentinel.
const monthStr = (s: string) => s.slice(0, 7);
const monthIdx = (m: string): number => {
  if (m === "9999-12") return Number.MAX_SAFE_INTEGER;
  const [y, mo] = m.split("-").map(Number);
  return y * 12 + (mo - 1);
};

/**
 * Per-commits-array cache of "roles grouped by their identityId" plus
 * a flat "all roles" list. `resolveIdentity` gets called once per
 * commit inside `computeRail` and again inside the byline builder —
 * without this the role scan is O(N²) over the same commits array.
 * A WeakMap keyed on the array reference lets both callers share the
 * work without threading a new parameter through the public API.
 */
const roleIndexCache = new WeakMap<
  Commit[],
  { byIdentity: Map<string, RoleCommit[]>; all: RoleCommit[] }
>();
function getRoleIndex(commits: Commit[]) {
  const cached = roleIndexCache.get(commits);
  if (cached) return cached;
  const byIdentity = new Map<string, RoleCommit[]>();
  const all: RoleCommit[] = [];
  for (const c of commits) {
    if (c.type !== "role") continue;
    const r = c as RoleCommit;
    all.push(r);
    const arr = byIdentity.get(r.identityId);
    if (arr) arr.push(r);
    else byIdentity.set(r.identityId, [r]);
  }
  const idx = { byIdentity, all };
  roleIndexCache.set(commits, idx);
  return idx;
}

/** Pick the tenure-smallest role in `pool` whose window contains `cm`. */
function pickBestRole(pool: RoleCommit[], cm: string): RoleCommit | null {
  let best: RoleCommit | null = null;
  let bestSize = Infinity;
  for (const r of pool) {
    const start = monthStr(r.date);
    const end =
      r.endDate && r.endDate !== "present" ? monthStr(r.endDate) : "9999-12";
    if (cm < start || cm > end) continue;
    const size = monthIdx(end) - monthIdx(start);
    if (size < bestSize) {
      bestSize = size;
      best = r;
    }
  }
  return best;
}

/**
 * Resolve the identity + specific role instance a commit was
 * "committed as". Feeds both the byline (identity → handle) and the
 * expanded author block (role → title / tenure / description).
 *
 * Resolution order:
 *  1. `commit.identityId` explicitly set → use it. Role instance is
 *     picked by smallest-window fit among that identity's ranges (or
 *     null if none fit).
 *  2. `commit` is itself a role → its own identity + itself as role.
 *  3. `attachedTo: "<role-id>"` → that role's identity, that role as
 *     the role instance.
 *  4. `attachedTo: "<event-id>"` → fall through to tenure inference
 *     (the event is a visual anchor, not an authorial identity).
 *  5. `attachedTo: null` → explicit detach, no identity.
 *  6. Tenure auto-detect: smallest-window role containing this
 *     commit's date across ALL roles.
 *
 * Event commits themselves never resolve an identity.
 */
export function resolveIdentity(
  commit: Commit,
  commits: Commit[],
): ResolvedIdentity | null {
  if (commit.type === "event") return null;
  if (commit.attachedTo === null && !commit.identityId) return null;

  const cm = monthStr(commit.date);
  const idx = getRoleIndex(commits);

  // 1) Explicit identity on the commit.
  if (commit.identityId) {
    return {
      identityId: commit.identityId,
      role: pickBestRole(idx.byIdentity.get(commit.identityId) ?? [], cm),
    };
  }

  // 2) Commit is a role itself.
  if (commit.type === "role") {
    return { identityId: commit.identityId, role: commit as RoleCommit };
  }

  // 3) attachedTo → role.
  if (typeof commit.attachedTo === "string") {
    const target = commits.find((c) => c.id === commit.attachedTo);
    if (target && target.type === "role") {
      const targetRole = target as RoleCommit;
      return { identityId: targetRole.identityId, role: targetRole };
    }
    // attachedTo → event or missing: fall through to tenure inference.
  }

  // 4) Tenure auto-detect across ALL roles.
  const best = pickBestRole(idx.all, cm);
  return best ? { identityId: best.identityId, role: best } : null;
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

export function isSlidesMedia(media: Media): media is SlidesMedia {
  return media.kind === "slides";
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
 * - SlidesMedia:      explicit `thumbnail` (decks don't expose a public cover API).
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

    case "slides":
      return media.thumbnail ?? null;

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
      /** Author-chosen cover fill for the single-item peek. See MediaPreview. */
      fit?: CoverFit;
      /** Fixed-mode aspect override for the single-item peek. */
      aspect?: string;
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
          fit: m.preview?.fit,
          aspect: m.preview?.aspect,
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
