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
  EmbedMedia,
  Media,
} from "@/lib/log";
import {
  localize,
  localizeOptional,
  formatCommitDate,
  computeCommitHash,
  getCommitLanguageBadge,
  isVideoMedia,
  isEmbedMedia,
  isLinkMedia,
  isImageMedia,
  getMediaThumbnail,
} from "@/lib/log";
import { detectNativeEmbedPlatform } from "@/lib/og-core";

// =============================================================================
// Types
// =============================================================================

export interface SimpleLink {
  url: string;
  label: string;
  icon: string;
}

export interface NormalizedCommit {
  // Identity
  hash: string;
  type: CommitType;

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
  links: SimpleLink[];
  nonLinkMedia: Media[];
  /** Embeds flagged to render beneath the row while it's still folded. */
  foldedEmbeds: EmbedMedia[];

  // Compact rendering
  thumbnail?: { url: string; linkUrl?: string };
  secondaryLine?: string;
}

// =============================================================================
// Media Partitioning
// =============================================================================

function getDomainLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Build the summary-row entry for an embed.
 *
 * Embeds, like videos and links, get a clickable indicator in the folded
 * row's right rail — so a collapsed commit signals "there's an embed here"
 * even before it's expanded. Recognized social platforms reuse their brand
 * icon; everything else (a Medium/web.dev-style preview card) falls back to
 * a globe + domain label.
 */
function embedToLink(m: EmbedMedia): SimpleLink {
  const platform = m.platform ?? detectNativeEmbedPlatform(m.url);
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
 * Extract link-like entries from media array.
 * Video, embed, and link media each become an external link in the summary
 * row (the right-hand indicator rail shown when a commit is folded).
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
    } else if (isEmbedMedia(m)) {
      links.push(embedToLink(m));
    } else if (isLinkMedia(m)) {
      links.push({
        url: m.url,
        label: m.label || (locale === "zh" ? "链接" : "Link"),
        icon: m.icon || "external",
      });
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

function deriveThumbnail(
  media: Media[],
): { url: string; linkUrl?: string } | undefined {
  // Try video media first (YouTube thumbnails), then images
  for (const m of media) {
    if (isVideoMedia(m) || isImageMedia(m)) {
      const thumb = getMediaThumbnail(m);
      if (thumb) {
        return { url: thumb, linkUrl: m.url };
      }
    }
  }
  // Fall back to link with explicit thumbnail (shouldn't happen, but safe)
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
  const nonLinkMedia = media.filter((m) => !isLinkMedia(m));
  const foldedEmbeds = media.filter(isEmbedMedia).filter((m) => m.defaultShown);

  const title = localize(commit.title, locale);
  const description = localize(commit.description, locale);
  const commentary = localizeOptional(commit.commentary, locale);
  const date = formatCommitDate(commit, locale);
  const hash = computeCommitHash(commit.id);
  const tags = commit.tags ?? [];
  const thumbnail = deriveThumbnail(media);
  const languageBadge = getCommitLanguageBadge(commit, locale);

  // Type-specific extraction
  switch (commit.type) {
    case "project": {
      const firstLinkUrl = media.filter(isLinkMedia)[0]?.url;
      return {
        hash,
        type: commit.type,
        languageBadge,
        title,
        description,
        date,
        tags,
        commentary,
        stats: commit.stats,
        links: mediaLinks,
        nonLinkMedia,
        foldedEmbeds,
        thumbnail: thumbnail ? { ...thumbnail, linkUrl: firstLinkUrl } : undefined,
        secondaryLine: description,
      };
    }

    case "talk": {
      return {
        hash,
        type: commit.type,
        languageBadge,
        title,
        description,
        date,
        meta: commit.conference.name,
        metaUrl: commit.conference.url,
        tags,
        commentary,
        links: mediaLinks,
        nonLinkMedia,
        foldedEmbeds,
        thumbnail,
        secondaryLine: date,
      };
    }

    case "post": {
      return {
        hash,
        type: commit.type,
        languageBadge,
        title,
        description,
        date,
        meta: commit.publication.name,
        metaUrl: commit.url,
        tags,
        commentary,
        links: mediaLinks,
        nonLinkMedia,
        foldedEmbeds,
        thumbnail: thumbnail ? { ...thumbnail, linkUrl: commit.url } : undefined,
        secondaryLine: `${commit.publication.name} · ${date}`,
      };
    }

    case "role": {
      const company = localize(commit.company, locale);

      return {
        hash,
        type: commit.type,
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
        nonLinkMedia,
        foldedEmbeds,
        thumbnail: thumbnail
          ? { ...thumbnail, linkUrl: commit.url }
          : undefined,
        secondaryLine: company,
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
        hash,
        type: commit.type,
        languageBadge,
        title,
        description,
        date,
        meta: commit.platform,
        tags,
        commentary,
        links: socialLinks,
        nonLinkMedia,
        foldedEmbeds,
        thumbnail: thumbnail ? { ...thumbnail, linkUrl: socialPrimaryUrl } : undefined,
        secondaryLine: `${commit.platform} · ${date}`,
      };
    }
  }
}
