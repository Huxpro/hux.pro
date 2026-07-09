/**
 * Commit Data Adapter
 *
 * Normalizes type-specific commit data into a generic shape consumed by
 * all three renderers (TimelineCommit, CommitCard, CommitCompact).
 * Type-specific logic lives HERE — renderers are type-agnostic.
 */

import type { Locale } from "@/lib/i18n";
import type {
  Commit,
  CommitType,
  InternalLinkMeta,
  Media,
} from "@/lib/log";
import {
  localize,
  localizeOptional,
  formatCommitDate,
  computeCommitHash,
  getCommitLanguageBadge,
  isVideoMedia,
  isSocialEmbedMedia,
  isLinkMedia,
  isLinkPill,
  isImageMedia,
  isPinnedMedia,
  getMediaThumbnail,
} from "@/lib/log";
import { pickInternalLink } from "@/lib/og-enrich";
import {
  detectSocialEmbedPlatform,
  getDomainLabel,
  isVideoLinkHost,
} from "@/lib/og-core";

// =============================================================================
// Types
// =============================================================================

export interface SimpleLink {
  url: string;
  label: string;
  icon: string;
  /**
   * Pills derived from a `present:"card"` link: the icon stays (anchors the
   * right-rail rhythm), but the label is suppressed on expand since the card
   * itself prints the domain + title right below.
   */
  redundantWhenExpanded?: boolean;
}

export interface NormalizedCommit {
  // Identity
  hash: string;
  type: CommitType;
  /** Optional icon override key (e.g. "graduation-cap"). */
  iconOverride?: string;

  // Core content
  title: string;
  description: string;
  date: string;

  /** "EN" / "中文" when the work's language differs from the viewer's locale. */
  languageBadge: "EN" | "中文" | null;

  // Type-derived metadata
  meta?: string;
  /** When set, the meta line is rendered as an external link. */
  metaUrl?: string;
  subtitle?: string;

  /**
   * Optional label that replaces the date slot when the parent tag has
   * `hideDate: true`. For role commits this is the location (e.g. city);
   * other commit types leave it undefined.
   */
  dateSlotOverride?: string;

  // Expandable content
  commentary?: string;
  tags: string[];
  stats?: { stars?: number; downloads?: string; users?: string };

  // Media
  /** Pill-style links extracted for the folded right-rail indicators. */
  links: SimpleLink[];
  /** Rich media (cards / widgets / players / images) shown when expanded. */
  expandedMedia: Media[];
  /** Items flagged `pinned: true` — shown beneath the row while folded. */
  pinnedMedia: Media[];

  // Compact rendering
  thumbnail?: { url: string; linkUrl?: string; isVideo?: boolean };
  secondaryLine?: string;
}

// =============================================================================
// Media Partitioning
// =============================================================================

/**
 * Build the summary-row entry for a social embed.
 *
 * Social embeds, like videos and pills, get a clickable indicator in the
 * folded row's right rail — so a collapsed commit signals "there's a tweet/
 * reel/clip here" even before expanded. We reuse the brand icon per platform.
 */
function socialEmbedToLink(m: {
  url: string;
  platform?: string | null;
}): SimpleLink {
  const platform = m.platform ?? detectSocialEmbedPlatform(m.url);
  switch (platform) {
    case "x":
    case "twitter":
      return { url: m.url, label: "X", icon: "x" };
    case "instagram":
      return { url: m.url, label: "Instagram", icon: "instagram" };
    case "tiktok":
      return { url: m.url, label: "TikTok", icon: "tiktok" };
    default:
      return { url: m.url, label: getDomainLabel(m.url), icon: "globe" };
  }
}

/**
 * Build the summary-row entry for a link card (kind:"link", present:"card").
 *
 * Cards get a clickable indicator just like social embeds — keeps the folded
 * row's rail symmetric whether the URL renders as an OG card or a native
 * widget. Falls back to a globe + domain label.
 */
function linkCardToLink(
  m: { url: string; internal?: InternalLinkMeta },
  locale: Locale,
): SimpleLink {
  if (m.internal) {
    const { url } = pickInternalLink(m.internal, locale);
    return {
      url: url ?? m.url,
      label: "/writing",
      icon: "globe",
      redundantWhenExpanded: true,
    };
  }
  return {
    url: m.url,
    label: getDomainLabel(m.url),
    icon: "globe",
    redundantWhenExpanded: true,
  };
}

/**
 * Extract link-like entries from the media array for the folded rail.
 * Every kind contributes a pill except images, which are silent.
 */
export function extractMediaLinks(
  media: Media[],
  locale: Locale,
): SimpleLink[] {
  const links: SimpleLink[] = [];

  for (const m of media) {
    if (isVideoMedia(m)) {
      const platformLabel: Record<string, string> = {
        bilibili: "Bilibili",
        youtube: "YouTube",
        vimeo: "Vimeo",
      };
      links.push({
        url: m.url,
        label: platformLabel[m.platform] ?? m.platform,
        icon: m.platform,
      });
    } else if (isSocialEmbedMedia(m)) {
      links.push(socialEmbedToLink(m));
    } else if (isLinkMedia(m)) {
      if (m.present === "card") {
        links.push(linkCardToLink(m, locale));
      } else {
        links.push({
          url: m.url,
          label: m.label || (locale === "zh" ? "链接" : "Link"),
          icon: m.icon || "external",
        });
      }
    }
  }

  return links;
}

// =============================================================================
// Platform Icon Helper
// =============================================================================

function getPlatformIcon(platform: string): string {
  const p = platform.toLowerCase();
  if (p === "twitter" || p === "x") return "x";
  if (p === "youtube") return "youtube";
  if (p === "instagram") return "instagram";
  if (p === "tiktok") return "tiktok";
  if (p === "github") return "github";
  return "external";
}

// =============================================================================
// Thumbnail Derivation
// =============================================================================

/**
 * Pick a thumbnail for compact / card displays.
 *
 * Preference order:
 *  1. Videos and images (richest visual signal, already baked-in URL).
 *  2. Link cards with a resolved preview image (covers the case where an
 *     embed-only project still has a meaningful cover via og-snapshot).
 *
 * Pills and social embeds never contribute a thumbnail.
 */
function deriveThumbnail(
  media: Media[],
): { url: string; linkUrl?: string; isVideo?: boolean } | undefined {
  for (const m of media) {
    const isVideo = isVideoMedia(m);
    if (isVideo || isImageMedia(m)) {
      const thumb = getMediaThumbnail(m);
      if (thumb) return { url: thumb, linkUrl: m.url, isVideo };
    }
  }
  for (const m of media) {
    if (isLinkMedia(m) && m.present === "card") {
      const thumb = getMediaThumbnail(m);
      // A card cover pointing at a talk-recording host (GitNation) reads as a
      // video in the compact cover, matching the play affordance on the card.
      if (thumb) return { url: thumb, linkUrl: m.url, isVideo: isVideoLinkHost(m.url) };
    }
  }
  return undefined;
}

// =============================================================================
// Adapter
// =============================================================================

export function normalizeCommit(
  commit: Commit,
  locale: Locale,
): NormalizedCommit {
  const media = commit.media ?? [];
  const mediaLinks = extractMediaLinks(media, locale);
  // Rich media (everything except pills) is what flows into the expanded
  // block; folded-prominent items get hoisted above the row separately.
  const richMedia = media.filter((m) => !isLinkPill(m));
  const pinnedMedia = richMedia.filter(isPinnedMedia);
  const expandedMedia = richMedia.filter((m) => !isPinnedMedia(m));

  const title = localize(commit.title, locale);
  const description = localize(commit.description, locale);
  const commentary = localizeOptional(commit.commentary, locale);
  const date = formatCommitDate(commit, locale);
  const hash = computeCommitHash(commit.id);
  const tags = commit.tags ?? [];
  const thumbnail = deriveThumbnail(media);
  const languageBadge = getCommitLanguageBadge(commit, locale);

  // Identity fields shared by every branch's return.
  const identity = {
    hash,
    type: commit.type,
    iconOverride: commit.icon,
  };

  // Type-specific extraction
  switch (commit.type) {
    case "project": {
      const firstPillUrl = media.find(isLinkPill)?.url;
      return {
        ...identity,
        languageBadge,
        title,
        description,
        date,
        tags,
        commentary,
        stats: commit.stats,
        links: mediaLinks,
        expandedMedia,
        pinnedMedia,
        thumbnail: thumbnail ? { ...thumbnail, linkUrl: firstPillUrl } : undefined,
        secondaryLine: description,
      };
    }

    case "talk": {
      return {
        ...identity,
        languageBadge,
        title,
        description,
        date,
        meta: commit.conference.name,
        metaUrl: commit.conference.url,
        tags,
        commentary,
        links: mediaLinks,
        expandedMedia,
        pinnedMedia,
        thumbnail,
        secondaryLine: date,
      };
    }

    case "post": {
      return {
        ...identity,
        languageBadge,
        title,
        description,
        date,
        meta: commit.publication.name,
        metaUrl: commit.url,
        tags,
        commentary,
        links: mediaLinks,
        expandedMedia,
        pinnedMedia,
        thumbnail: thumbnail ? { ...thumbnail, linkUrl: commit.url } : undefined,
        secondaryLine: `${commit.publication.name} · ${date}`,
      };
    }

    case "role": {
      const company = localize(commit.company, locale);

      return {
        ...identity,
        languageBadge,
        title,
        description,
        date,
        // Company sits beneath the title (parallels talk's conference name).
        // When tag.hideDate moves `location` into the date slot, the meta
        // line stays as the institution.
        meta: company,
        metaUrl: commit.url,
        dateSlotOverride: commit.location,
        tags,
        commentary,
        links: mediaLinks,
        expandedMedia,
        pinnedMedia,
        thumbnail: thumbnail
          ? { ...thumbnail, linkUrl: commit.url }
          : undefined,
        secondaryLine: company,
      };
    }

    case "event": {
      // Life events render bare — no meta line, no links, no expand.
      return {
        ...identity,
        languageBadge,
        title,
        description,
        date,
        tags: [],
        links: [],
        expandedMedia: [],
        pinnedMedia: [],
      };
    }

    case "social": {
      const socialPrimaryUrl = media[0]?.url;

      // Build platform link. The first media item is represented by the
      // platform link itself, so the remaining items supply the extra
      // rail indicators — avoids listing media[0] (often an embed) twice.
      const socialLinks: SimpleLink[] = [];
      if (socialPrimaryUrl) {
        socialLinks.push({
          url: socialPrimaryUrl,
          label: commit.platform,
          icon: getPlatformIcon(commit.platform),
        });
        socialLinks.push(...extractMediaLinks(media.slice(1), locale));
      } else {
        socialLinks.push(...mediaLinks);
      }

      return {
        ...identity,
        languageBadge,
        title,
        description,
        date,
        meta: commit.platform,
        tags,
        commentary,
        links: socialLinks,
        expandedMedia,
        pinnedMedia,
        thumbnail: thumbnail ? { ...thumbnail, linkUrl: socialPrimaryUrl } : undefined,
        secondaryLine: `${commit.platform} · ${date}`,
      };
    }
  }
}
