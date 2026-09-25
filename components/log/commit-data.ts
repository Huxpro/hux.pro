/**
 * Commit Data Adapter
 *
 * Normalizes type-specific commit data into a generic shape consumed by
 * all three renderers (TimelineCommit, CommitCard, CommitCompact).
 * Type-specific logic lives HERE — renderers are type-agnostic.
 */

import type { Locale } from "@/lib/i18n";
import type { Commit, CommitType, Media, StripItem } from "@/lib/log";
import {
  localize,
  localizeOptional,
  formatCommitDate,
  computeCommitHash,
  getCommitLanguageBadge,
  isLinkMedia,
  isImageMedia,
  isPinnedMedia,
  getMediaThumbnail,
  getMediaStripItems,
  isPlayableMedia,
} from "@/lib/log";

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

/** Whether two labels would print as the same line — case and surrounding
 *  space are not a difference worth repeating a venue over. */
function sameLine(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
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
  // Everything flows into the expanded block; folded-prominent items get
  // hoisted above the row separately.
  const pinnedMedia = media.filter(isPinnedMedia);
  const expandedMedia = media.filter((m) => !isPinnedMedia(m));
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
      return {
        ...identity,
        languageBadge,
        title,
        description,
        date,
        commentary,
        expandedMedia,
        pinnedMedia,
        stripItems,
        thumbnail,
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
        expandedMedia: [],
        pinnedMedia: [],
        stripItems: [],
      };
    }

    case "press": {
      const socialPrimaryUrl = media[0]?.url;

      return {
        ...identity,
        languageBadge,
        title,
        description,
        date,
        meta: commit.platform,
        commentary,
        expandedMedia,
        pinnedMedia,
        stripItems,
        thumbnail: thumbnail ? { ...thumbnail, linkUrl: socialPrimaryUrl } : undefined,
        secondaryLine: `${commit.platform} · ${date}`,
      };
    }
  }
}
