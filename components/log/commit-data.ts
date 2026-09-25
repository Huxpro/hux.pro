/**
 * Commit Data Adapter
 *
 * Normalizes type-specific commit data into a generic shape consumed by
 * all three renderers (TimelineCommit, CommitCard, CommitCompact).
 * Type-specific logic lives HERE — renderers are type-agnostic.
 */

import type { Locale } from "@/lib/i18n";
import type {
  Attachment,
  Commit,
  CommitType,
  InternalLinkMeta,
  Media,
  StripItem,
} from "@/lib/log";
import {
  attachmentsOf,
  commitVenue,
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
  factorSquash,
  squashAttachments,
  type ResolvedSquash,
  type SquashMemberFacts,
} from "@/lib/log-squash";
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

/**
 * One member of a squashed row, as the band prints it: the fields that vary
 * (`SquashMemberFacts`), and the member's own share of the row's media.
 */
export interface SquashMemberView extends SquashMemberFacts {
  /** Its covers — the run of tiles its bracket spans. */
  stripItems: StripItem[];
  /** Its rich media with no cover to draw (a live widget). */
  leftovers: Media[];
  /** All of its links, as the row's rail would draw them. */
  links: SimpleLink[];
  /** The links that are not already one of its covers — its caption's rail. */
  extraLinks: SimpleLink[];
}

/**
 * The level nested under a squashed row's header.
 *
 * The row is not flattened: its header says what the members share, and
 * this says what each of them is. Where the header is one member's own row
 * (`"parent"`), `members` is everyone else, and the parent's covers are the
 * row's ordinary `stripItems`.
 */
export interface SquashView {
  mode: "peers" | "parent";
  members: SquashMemberView[];
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

  /**
   * When this row stands for several commits, the level nested under it —
   * see {@link SquashView}. Absent for an ordinary row.
   */
  squash?: SquashView;

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
  attachments: readonly Attachment[],
  locale: Locale,
): SimpleLink[] {
  const links: SimpleLink[] = [];

  for (const { media: m } of attachments) {
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

/**
 * Normalize one commit into the shape every renderer consumes.
 *
 * `squash` is the row's *reading*, when it has one: several commits printed
 * as one row (see `lib/log-squash.ts`). The row is then two levels — a
 * header, and a band nested under it — and this is where each field is
 * sent to one level or the other. Nothing is taken from one member and
 * applied to the others: what every member shares goes up, what varies
 * stays with the member it belongs to, media included.
 */
export function normalizeCommit(
  commit: Commit,
  locale: Locale,
  squash?: ResolvedSquash | null,
  /**
   * The row's attachments, when the caller has already built them — which
   * it must whenever it also builds an `AttachmentSet`, so the two share
   * object identity and a cover can find its own place in the set. Omit it
   * and they are derived here (the home widgets' path, which has no set).
   */
  attachments?: Attachment[],
): NormalizedCommit {
  const all =
    attachments ??
    (squash ? squashAttachments(squash, locale) : attachmentsOf(commit, locale));
  if (!squash) return normalizeOne(commit, locale, all);

  const facts = factorSquash(squash, locale);
  // Each attachment already knows whose it is (lib/log.ts), so splitting the
  // row's one array back into its members is a filter, not a lookup table.
  const ownedBy = (id: string) => all.filter((a) => a.origin.commitId === id);

  const members: SquashMemberView[] = facts.members.map((f) => {
    const mine = ownedBy(f.commit.id);
    const rich = mine.filter((a) => !isLinkPill(a.media));
    const stripItems = getMediaStripItems(rich, locale);
    const covered = new Set(stripItems.map((s) => s.media));
    const links = extractMediaLinks(mine, locale);
    return {
      ...f,
      stripItems,
      // What has no cover still belongs to someone: a live widget prints in
      // its member's card, not loose at the bottom of the row.
      leftovers: rich.filter((a) => !covered.has(a.media)).map((a) => a.media),
      links,
      // The caption's rail: a member's links that are not already one of its
      // covers. A cover is the affordance; an icon beside it saying the same
      // thing is the row's rail printed twice.
      extraLinks: links.filter((l) => !l.media || !covered.has(l.media)),
    };
  });

  if (facts.mode === "parent") {
    // The parent IS the row: normalize it exactly as an ordinary row, on its
    // own attachments only. Its covers print bare at the head of the band,
    // the children nest after them.
    const base = normalizeOne(squash.parent!, locale, ownedBy(squash.parent!.id));
    return {
      ...base,
      title: facts.headline,
      description: facts.description || base.description,
      squash: { mode: "parent", members },
    };
  }

  // Peers: the header is built from what is shared, so it owns no media and
  // no rail of its own — every cover and every link is some member's, and
  // prints with that member in the band.
  const base = normalizeOne(squash.lead, locale, []);
  return {
    ...base,
    type: facts.type,
    iconOverride: facts.type === squash.lead.type ? base.iconOverride : undefined,
    title: facts.headline,
    // A group of asides is an aside; a group with one aside in it is not.
    present: facts.quiet ? "aside" : undefined,
    foldedTitle: facts.quiet ? facts.headline : undefined,
    date: facts.date,
    description: facts.description,
    // No peer's prose speaks for the group; the commentary is a peer's too.
    commentary: undefined,
    languageBadge: facts.languageBadge,
    meta: facts.meta ?? undefined,
    metaUrl: undefined,
    dateSlotOverride: undefined,
    squash: { mode: "peers", members },
  };
}

function normalizeOne(
  commit: Commit,
  locale: Locale,
  attachments: readonly Attachment[],
): NormalizedCommit {
  const media = attachments.map((a) => a.media);
  const mediaLinks = extractMediaLinks(attachments, locale);
  // Rich media (everything except pills) is what flows into the expanded
  // block; folded-prominent items get hoisted above the row separately.
  const rich = attachments.filter((a) => !isLinkPill(a.media));
  const pinned = rich.filter((a) => isPinnedMedia(a.media));
  const expanded = rich.filter((a) => !isPinnedMedia(a.media));
  const pinnedMedia = pinned.map((a) => a.media);
  const expandedMedia = expanded.map((a) => a.media);
  // The strip keeps the whole attachment. A cover is the one affordance
  // that has to say which commit it is of without opening anything, and on
  // a squashed row that is not the row it is sitting on. Everything else
  // here stays `Media[]`: the renderers key on the media object and read
  // the origin back off the set, which is the same identity rule they
  // already used to find an item's index.
  const stripItems = getMediaStripItems(expanded, locale);

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
  const foldedVenue = commitVenue(commit);

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
        socialLinks.push(...extractMediaLinks(attachments.slice(1), locale));
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
