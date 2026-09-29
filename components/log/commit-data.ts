/**
 * Commit Data Adapter
 *
 * Normalizes type-specific commit data into a generic shape consumed by
 * all three renderers (TimelineCommit, CommitCard, CommitCompact).
 * Type-specific logic lives HERE — renderers are type-agnostic.
 */

import { t, type Locale } from "@/lib/i18n";
import type { Commit, CommitType, Media, StripItem } from "@/lib/log";
import { linkTarget } from "@/systems/attachments/lib/policy";
import {
  VIDEO_PLATFORM_LABEL,
  isSlidesMedia,
  isVideoMedia,
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
   * The one line an aside row prints while folded. `venue · title` by
   * default — the conference, publication or platform, then what it was.
   * `asideLine` can keep just the venue or just the title. The venue
   * alone when the two would say the same thing, and the title alone for
   * a type with no venue. Absent when the row is not an aside.
   */
  foldedTitle?: string;
  description: string;
  date: string;

  /** "EN" / "中文" when the work's language differs from the viewer's locale. */
  languageBadge: "EN" | "中文" | null;

  // Type-derived metadata
  meta?: string;
  /** What I did on it (`credit`, lib/log.ts): the résumé entry's second
   *  line, before the team. */
  credit?: string;
  /** The one number worth printing beside a project's name: `1B+ users`,
   *  `★ 220k`. */
  stat?: string;
  /**
   * Where to see it, a word each — `lynxjs.org`, `github.com`, `YouTube`,
   * `slides` — for the résumé entry, which prints no covers. Every one is
   * an attachment, opened the way its cover would open it.
   */
  links: MediaLink[];
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

export interface MediaLink {
  label: string;
  href: string;
  media: Media;
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
// Résumé fields
// =============================================================================

const COMPACT = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const USERS: Record<Locale, string> = { en: "users", zh: "用户" };
const DOWNLOADS: Record<Locale, string> = { en: "downloads", zh: "下载" };

/**
 * One stat, the biggest claim first. Stars print as GitHub prints them
 * (`★ 220k`), so the number says where it was counted without a word for
 * it in either language.
 */
function statOf(commit: Commit, locale: Locale): string | undefined {
  if (commit.type !== "project" || !commit.stats) return undefined;
  const { users, stars, downloads } = commit.stats;
  if (users) return `${users} ${USERS[locale]}`;
  if (stars) return `★ ${COMPACT.format(stars).toLowerCase()}`;
  if (downloads) return `${downloads} ${DOWNLOADS[locale]}`;
  return undefined;
}

/**
 * A word for each place a work can be seen.
 *
 * Derived, never authored: a recording is named for where it plays, a deck
 * is a deck, and a page is named for the site it is on — which is what a
 * reader deciding whether to click wants to know. Two pages on one site
 * take their first path segment as well (`react.dev/blog`,
 * `react.dev/learn`); two that would still read the same (three posts
 * under `writing`) print once, since the set it opens pages through all of
 * them anyway. An image is left out: it is a picture of the work, not a
 * place to see it, and one depth down it is a cover.
 */
function linksOf(items: Media[], locale: Locale): MediaLink[] {
  const where = (m: Media) => {
    try {
      const url = new URL(linkTarget(m, locale), "https://hux.pro");
      return {
        host: url.host.replace(/^www\./, ""),
        segment: url.pathname.split("/").filter(Boolean)[0] ?? "",
      };
    } catch {
      return { host: "", segment: "" };
    }
  };
  const places = items.filter((m) => !isImageMedia(m));
  const base = places.map((m) => {
    if (isVideoMedia(m)) return VIDEO_PLATFORM_LABEL[m.platform];
    if (isSlidesMedia(m)) return t(locale, "logSlides").toLowerCase();
    const { host, segment } = where(m);
    // This site's own pages go by what they are, not by our domain.
    return host === "hux.pro" ? segment || host : host;
  });
  const seen = new Set<string>();
  return places.flatMap((media, i) => {
    const { host, segment } = where(media);
    const shared = base.indexOf(base[i]) !== base.lastIndexOf(base[i]);
    const label =
      shared && segment && host !== "hux.pro"
        ? `${base[i]}/${segment}`
        : base[i];
    if (seen.has(label)) return [];
    seen.add(label);
    return [{ label, href: linkTarget(media, locale), media }];
  });
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

  // Which half the folded line keeps. Absent is both, venue first: folded,
  // an aside is answering "when and where", and the title is the detail it
  // offers if there is room. `"venue"` is the conference (or publication,
  // or platform) alone. `"title"` is the work alone, when that is the part
  // worth the line. Opening the row gives the title its own line at full
  // weight either way.
  //
  // A floor under "both": even asked for both, print the venue alone when
  // the two would say the same thing. Sparse, the way every other repeated
  // field on this row is. A talk whose `conference.name` IS its title would
  // otherwise read "CSS Still Sucks 2015 · CSS Still Sucks 2015". A type
  // with no venue prints its title, whichever half was asked for.
  const line = commit.asideLine ?? "venue-title";
  const foldedTitle =
    commit.present === "aside"
      ? !foldedVenue || line === "title"
        ? title
        : line === "venue" || sameLine(foldedVenue, title)
          ? foldedVenue
          : `${foldedVenue} · ${title}`
      : undefined;

  // Identity fields shared by every branch's return — and the résumé's,
  // which every type can carry (a role's credit is the Flash years').
  const identity = {
    hash,
    type: commit.type,
    iconOverride: commit.icon,
    present: commit.present,
    foldedTitle,
    credit: localizeOptional(commit.credit, locale),
    stat: statOf(commit, locale),
    links: linksOf(expandedMedia, locale),
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
        links: [],
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
