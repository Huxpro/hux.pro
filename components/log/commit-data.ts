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
  Media,
} from "@/lib/log";
import {
  localize,
  localizeOptional,
  formatCommitDate,
  computeCommitHash,
  isVideoMedia,
  isLinkMedia,
  isImageMedia,
  getMediaThumbnail,
} from "@/lib/log";

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

  // Type-derived metadata
  meta?: string;
  subtitle?: string;

  // Expandable content
  commentary?: string;
  tags: string[];
  stats?: { stars?: number; downloads?: string; users?: string };

  // Media
  links: SimpleLink[];
  nonLinkMedia: Media[];

  // Compact rendering
  thumbnail?: { url: string; linkUrl?: string };
  secondaryLine?: string;
}

// =============================================================================
// Media Partitioning
// =============================================================================

/**
 * Extract link-like entries from media array.
 * Both video media and link media become external links in the summary row.
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

  const title = localize(commit.title, locale);
  const description = localize(commit.description, locale);
  const commentary = localizeOptional(commit.commentary, locale);
  const date = formatCommitDate(commit, locale);
  const hash = computeCommitHash(commit.id);
  const tags = commit.tags ?? [];
  const thumbnail = deriveThumbnail(media);

  // Type-specific extraction
  switch (commit.type) {
    case "project": {
      const firstLinkUrl = media.filter(isLinkMedia)[0]?.url;
      return {
        hash,
        type: commit.type,
        title,
        description,
        date,
        tags,
        commentary,
        stats: commit.stats,
        links: mediaLinks,
        nonLinkMedia,
        thumbnail: thumbnail ? { ...thumbnail, linkUrl: firstLinkUrl } : undefined,
        secondaryLine: description,
      };
    }

    case "talk": {
      // Add conference link if URL exists
      const talkLinks: SimpleLink[] = [];
      if (commit.conference.url) {
        talkLinks.push({
          url: commit.conference.url,
          label: commit.conference.name,
          icon: "globe",
        });
      }
      talkLinks.push(...mediaLinks);

      return {
        hash,
        type: commit.type,
        title,
        description,
        date,
        meta: commit.conference.name,
        tags,
        commentary,
        links: talkLinks,
        nonLinkMedia,
        thumbnail,
        secondaryLine: date,
      };
    }

    case "post": {
      // Add post URL as a link
      const postLinks: SimpleLink[] = [
        {
          url: commit.url,
          label: commit.publication.name,
          icon: "external",
        },
        ...mediaLinks,
      ];

      return {
        hash,
        type: commit.type,
        title,
        description,
        date,
        meta: commit.publication.name,
        tags,
        commentary,
        links: postLinks,
        nonLinkMedia,
        thumbnail: thumbnail ? { ...thumbnail, linkUrl: commit.url } : undefined,
        secondaryLine: `${commit.publication.name} · ${date}`,
      };
    }

    case "role": {
      const company = localize(commit.company, locale);
      const roleTitle = localize(commit.roleTitle, locale);

      // Build a website link if url exists
      const roleLinks: SimpleLink[] = [...mediaLinks];
      if (commit.url) {
        roleLinks.unshift({
          url: commit.url,
          label: locale === "zh" ? "网站" : "Website",
          icon: "globe",
        });
      }

      return {
        hash,
        type: commit.type,
        title: company,
        description,
        date,
        meta: commit.location,
        subtitle: roleTitle,
        tags,
        commentary,
        links: roleLinks,
        nonLinkMedia,
        thumbnail: thumbnail
          ? { ...thumbnail, linkUrl: commit.url }
          : undefined,
        secondaryLine: roleTitle,
      };
    }

    case "social": {
      const socialPrimaryUrl = media[0]?.url;

      // Build platform link
      const socialLinks: SimpleLink[] = [];
      if (socialPrimaryUrl) {
        socialLinks.push({
          url: socialPrimaryUrl,
          label: commit.platform,
          icon: getPlatformIcon(commit.platform),
        });
      }
      socialLinks.push(...mediaLinks);

      return {
        hash,
        type: commit.type,
        title,
        description,
        date,
        meta: commit.platform,
        tags,
        commentary,
        links: socialLinks,
        nonLinkMedia,
        thumbnail: thumbnail ? { ...thumbnail, linkUrl: socialPrimaryUrl } : undefined,
        secondaryLine: `${commit.platform} · ${date}`,
      };
    }
  }
}
