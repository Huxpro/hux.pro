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
  primaryUrl?: string;

  // Type-derived metadata
  meta?: string;
  subtitle?: string;

  // Expandable content
  commentary?: string;
  tags: string[];
  stats?: { stars?: number; downloads?: string; users?: string };

  // Media (split for rendering)
  links: SimpleLink[];
  videoLinks: SimpleLink[];
  nonLinkMedia: Media[];
  playableMedia: Media[];

  // Compact rendering
  thumbnail?: { url: string; linkUrl?: string };
  secondaryLine?: string;
}

// =============================================================================
// Media Partitioning
// =============================================================================

/**
 * Split media into video toggle links and regular links.
 * Video links are rendered as toggle buttons for inline player.
 * Applied to ALL commit types (not just talks).
 */
export function partitionMediaLinks(
  media: Media[],
  locale: Locale,
): { videoLinks: SimpleLink[]; otherLinks: SimpleLink[] } {
  const videoLinks: SimpleLink[] = [];
  const otherLinks: SimpleLink[] = [];

  for (const m of media) {
    if (isVideoMedia(m)) {
      const platformLabel: Record<string, string> = {
        bilibili: "Bilibili",
        youtube: locale === "zh" ? "观看视频" : "YouTube",
        vimeo: "Vimeo",
      };
      videoLinks.push({
        url: m.url,
        label: platformLabel[m.platform] ?? m.platform,
        icon: m.platform,
      });
    } else if (isLinkMedia(m)) {
      otherLinks.push({
        url: m.url,
        label: m.label || (locale === "zh" ? "链接" : "Link"),
        icon: m.icon || "external",
      });
    }
  }

  return { videoLinks, otherLinks };
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
  primaryUrl?: string,
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
  const { videoLinks, otherLinks } = partitionMediaLinks(media, locale);
  const nonLinkMedia = media.filter((m) => !isLinkMedia(m));
  const playableMedia = media.filter(isVideoMedia);

  const title = localize(commit.title, locale);
  const description = localize(commit.description, locale);
  const commentary = localizeOptional(commit.commentary, locale);
  const date = formatCommitDate(commit, locale);
  const hash = computeCommitHash(commit.id);
  const tags = commit.tags ?? [];
  const thumbnail = deriveThumbnail(media, undefined);

  // Type-specific extraction
  switch (commit.type) {
    case "project": {
      const primaryUrl = media.filter(isLinkMedia)[0]?.url;
      return {
        hash,
        type: commit.type,
        title,
        description,
        date,
        primaryUrl,
        tags,
        commentary,
        stats: commit.stats,
        links: otherLinks,
        videoLinks,
        nonLinkMedia,
        playableMedia,
        thumbnail: thumbnail ? { ...thumbnail, linkUrl: primaryUrl } : undefined,
        secondaryLine: description,
      };
    }

    case "talk": {
      return {
        hash,
        type: commit.type,
        title,
        description,
        date,
        primaryUrl: commit.conference.url,
        meta: commit.conference.name,
        tags,
        commentary,
        links: otherLinks,
        videoLinks,
        nonLinkMedia,
        playableMedia,
        thumbnail,
        secondaryLine: date,
      };
    }

    case "post": {
      return {
        hash,
        type: commit.type,
        title,
        description,
        date,
        primaryUrl: commit.url,
        meta: commit.publication.name,
        tags,
        commentary,
        links: otherLinks,
        videoLinks,
        nonLinkMedia,
        playableMedia,
        thumbnail: thumbnail ? { ...thumbnail, linkUrl: commit.url } : undefined,
        secondaryLine: `${commit.publication.name} · ${date}`,
      };
    }

    case "role": {
      const company = localize(commit.company, locale);
      const roleTitle = localize(commit.roleTitle, locale);

      // Build a website link if url exists
      const roleLinks: SimpleLink[] = [...otherLinks];
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
        primaryUrl: commit.url,
        meta: commit.location,
        subtitle: roleTitle,
        tags,
        commentary,
        links: roleLinks,
        videoLinks,
        nonLinkMedia,
        playableMedia,
        thumbnail: thumbnail
          ? { ...thumbnail, linkUrl: commit.url }
          : undefined,
        secondaryLine: roleTitle,
      };
    }

    case "social": {
      const primaryUrl = media[0]?.url;

      // Build platform link
      const socialLinks: SimpleLink[] = [];
      if (primaryUrl) {
        socialLinks.push({
          url: primaryUrl,
          label: commit.platform,
          icon: getPlatformIcon(commit.platform),
        });
      }
      socialLinks.push(...otherLinks);

      return {
        hash,
        type: commit.type,
        title,
        description,
        date,
        primaryUrl,
        meta: commit.platform,
        tags,
        commentary,
        links: socialLinks,
        videoLinks,
        nonLinkMedia,
        playableMedia,
        thumbnail: thumbnail ? { ...thumbnail, linkUrl: primaryUrl } : undefined,
        secondaryLine: `${commit.platform} · ${date}`,
      };
    }
  }
}
