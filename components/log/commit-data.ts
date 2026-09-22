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
  StripItem,
} from "@/lib/log";
import {
  localize,
  localizeOptional,
  formatCommitDate,
  computeCommitHash,
  getCommitLanguageBadge,
  isVideoMedia,
  isSlidesMedia,
  isSocialEmbedMedia,
  isLinkMedia,
  isLinkPill,
  isImageMedia,
  isPinnedMedia,
  getMediaThumbnail,
  getMediaStripItems,
  isPlayableMedia,
  VIDEO_PLATFORM_LABEL,
} from "@/lib/log";
import { pickInternalLink } from "@/lib/og-enrich";
import {
  detectSocialEmbedPlatform,
  getDomainLabel, SOCIAL_PLATFORM_LABEL } from "@/lib/og-core";

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
  /**
   * The media this pill stands for — always the commit's own object, by
   * reference, never a copy.
   *
   * On /works only the ones in the commit's set do anything with it: the
   * rail opens a video, a deck, a card or a social widget through the
   * attachment system by finding it there, and a plain pill (a website, a
   * repo) is not in the set, so `indexOf` misses and it stays a plain link.
   * The editor reads it off every pill regardless — the rail is the only
   * affordance a plain pill has, so it is the only way to select one.
   */
  media?: Media;
}

export interface NormalizedCommit {
  // Identity
  hash: string;
  type: CommitType;
  /** Optional icon override key (e.g. "graduation-cap"). */
  iconOverride?: string;
  /**
   * Timeline dressing. `"aside"` folds the row to a muted line
   * (see `foldedTitle`) until the reader opens it. Not a type.
   */
  present?: "aside";

  // Core content
  title: string;
  /**
   * The one line an aside row prints while folded: its venue and its
   * title, `venue · title` — the conference, publication or platform,
   * then what it was. The venue alone when the two would say the same
   * thing, and the title alone for a type with no venue. Absent when the
   * row is not an aside.
   */
  foldedTitle?: string;
  description: string;
  date: string;

  /** "EN" / "中文" when the work's language differs from the viewer's locale. */
  languageBadge: "EN" | "中文" | null;

  // Type-derived metadata
  meta?: string;
  /** When set, the meta line is rendered as an external link. */
  metaUrl?: string;

  /**
   * Optional label that replaces the date slot when the parent tag has
   * `hideDate: true`. For role commits this is the location (e.g. city);
   * other commit types leave it undefined.
   */
  dateSlotOverride?: string;

  // Expandable content
  commentary?: string;

  // Media
  /** Pill-style links extracted for the folded right-rail indicators. */
  links: SimpleLink[];
  /** Rich media (cards / widgets / players / images) shown when expanded. */
  expandedMedia: Media[];
  /** Items flagged `pinned: true` — shown beneath the row while folded. */
  pinnedMedia: Media[];
  /**
   * Contact-sheet covers: every cover in `expandedMedia`, at thumbnail size,
   * for the `stat` density's strip (see `MediaStrip`). Derived here because
   * that is where the locale is resolved and the renderers are deliberately
   * locale-agnostic — the alternative was a prop threaded through four
   * components that neither read nor cared about it.
   */
  stripItems: StripItem[];

  // Compact rendering
  thumbnail?: { url: string; linkUrl?: string };
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
      return { url: m.url, label: SOCIAL_PLATFORM_LABEL[platform], icon: "x" };
    case "instagram":
    case "tiktok":
      return { url: m.url, label: SOCIAL_PLATFORM_LABEL[platform], icon: platform };
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
      links.push({
        url: m.url,
        label: VIDEO_PLATFORM_LABEL[m.platform],
        icon: m.platform,
        media: m,
      });
    } else if (isSlidesMedia(m)) {
      links.push({
        url: m.url,
        label: m.title || "Slides",
        icon: "slides",
        media: m,
      });
    } else if (isSocialEmbedMedia(m)) {
      links.push({ ...socialEmbedToLink(m), media: m });
    } else if (isLinkMedia(m)) {
      if (m.present === "card") {
        links.push({ ...linkCardToLink(m, locale), media: m });
      } else {
        links.push({
          url: m.url,
          label: m.label || (locale === "zh" ? "链接" : "Link"),
          icon: m.icon || "external",
          media: m,
        });
      }
    }
  }

  return links;
}

/** Whether two labels would print as the same line — case and surrounding
 *  space are not a difference worth repeating a venue over. */
function sameLine(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
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
): { url: string; linkUrl?: string } | undefined {
  for (const m of media) {
    if (isPlayableMedia(m) || isImageMedia(m)) {
      const thumb = getMediaThumbnail(m);
      if (thumb) return { url: thumb, linkUrl: m.url };
    }
  }
  for (const m of media) {
    if (isLinkMedia(m) && m.present === "card") {
      const thumb = getMediaThumbnail(m);
      if (thumb) return { url: thumb, linkUrl: m.url };
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
  const stripItems = getMediaStripItems(expandedMedia, locale);

  const title = localize(commit.title, locale);
  const description = localize(commit.description, locale);
  const commentary = localizeOptional(commit.commentary, locale);
  const date = formatCommitDate(commit, locale);
  const hash = computeCommitHash(commit.id);
  const thumbnail = deriveThumbnail(media);
  const languageBadge = getCommitLanguageBadge(commit, locale);
  // The venue an aside prints while folded: the conference, the
  // publication, the platform — where the work happened, since the aside
  // voice is the event voice and an event is a dateline.
  const foldedVenue =
    commit.type === "talk"
      ? commit.conference.name
      : commit.type === "post"
        ? commit.publication.name
        : commit.type === "press"
          ? commit.platform
          : undefined;

  // `venue · title`, and the venue alone when the two would say the same
  // thing. Sparse, the way every other repeated field on this row is: the
  // handle prints once per author run, the team chip blanks when it
  // repeats. A talk whose `conference.name` IS its title — which is how
  // two of the three asides in the log are authored — would otherwise
  // read "CSS Still Sucks 2015 · CSS Still Sucks 2015".
  //
  // The venue leads because that is what the voice is for: folded, an
  // aside is answering "when and where", and the title is the detail it
  // offers if you have room for it. Opening the row gives the title its
  // own line at full weight.
  const foldedTitle =
    commit.present === "aside"
      ? foldedVenue
        ? // The author's choice, and a floor under it: even asked for both,
          // print the venue alone when the two would say the same thing.
          commit.asideLine === "venue" || sameLine(foldedVenue, title)
          ? foldedVenue
          : `${foldedVenue} · ${title}`
        : title
      : undefined;

  // Identity fields shared by every branch's return.
  const identity = {
    hash,
    type: commit.type,
    iconOverride: commit.icon,
    present: commit.present,
    foldedTitle,
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
        commentary,
        links: mediaLinks,
        expandedMedia,
        pinnedMedia,
        stripItems,
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
        commentary,
        links: mediaLinks,
        expandedMedia,
        pinnedMedia,
        stripItems,
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
        commentary,
        links: mediaLinks,
        expandedMedia,
        pinnedMedia,
        stripItems,
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
        commentary,
        links: mediaLinks,
        expandedMedia,
        pinnedMedia,
        stripItems,
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
        links: [],
        expandedMedia: [],
        pinnedMedia: [],
        stripItems: [],
      };
    }

    case "press": {
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
        commentary,
        links: socialLinks,
        expandedMedia,
        pinnedMedia,
        stripItems,
        thumbnail: thumbnail ? { ...thumbnail, linkUrl: socialPrimaryUrl } : undefined,
        secondaryLine: `${commit.platform} · ${date}`,
      };
    }
  }
}
