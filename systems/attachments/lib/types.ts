import type { Media } from "@/lib/log";

// =============================================================================
// Attachments — types
// =============================================================================

/**
 * A commit's attachments, as one thing to open: the rich media it carries
 * (cards, videos, decks, images, social widgets — never the pills, which are
 * plain outbound links), in authored order, under the commit's name.
 *
 * Built once per row by `attachmentSetFor` and handed to every affordance on
 * the row, so a cover in the contact strip, the player in the expanded body
 * and the icon in the folded rail all open the same set at their own item.
 */
/**
 * Who an attachment belongs to, when the set alone cannot say.
 *
 * A set is normally one commit's, so the commit's own title and venue are
 * the credit for every item in it. A squashed row breaks that: its set
 * carries several commits' media under one headline, and without this every
 * item would open titled with the row and subtitled with whichever member
 * happened to lead — "React Compiler (Forget)" over a recording of a talk
 * called "React without memo", given at React Conf.
 *
 * git's squash really does destroy that; ours does not, because the members
 * are still there to be asked. This is where the page stops imitating the
 * part of the analogy it never had to.
 */
export interface AttachmentCredit {
  /** The owning commit's title — what this attachment is of. */
  title: string;
  /** Its venue — the conference, the publication, the platform. */
  subtitle?: string;
  /** Its own address on /works (`/works#<hash>`). */
  href?: string;
  /** `venue · title`, as the row's own member lines print it — one string
   *  for the places that have room for a line and not a block. */
  line: string;
}

export interface AttachmentSet {
  /** The commit id — the surface's session key. */
  id: string;
  /** The commit's title, localized: the surface's title, the theater's. */
  title: string;
  /** Venue line — conference, publication, platform, company. */
  subtitle?: string;
  /** In-site address of the commit (`/works#<hash>`). */
  href?: string;
  /** The attachments themselves. Object identity matters: callers find an
   *  item's index by reference (`items.indexOf(media)`). */
  items: readonly Media[];
  /**
   * Per-item credit, for a set whose items come from more than one commit.
   * Keyed by the media object — the same identity rule `items.indexOf`
   * already relies on. Absent for an ordinary commit's set, and absent for
   * any single item, means the set's own title and subtitle.
   *
   * Read it through {@link creditFor} rather than directly, so the fallback
   * is written once.
   */
  credits?: ReadonlyMap<Media, AttachmentCredit>;
}

/**
 * The credit for one item: its own when the set has one, the set's own
 * otherwise. Every place that prints a name for an attachment — the
 * theater's bar, the surface's header, a window's title, a tile's caption
 * — goes through here, so a squashed row cannot name one of them correctly
 * and another one wrong.
 */
export function creditFor(
  set: AttachmentSet,
  index: number,
): AttachmentCredit {
  const media = set.items[index];
  const own = media ? set.credits?.get(media) : undefined;
  return (
    own ?? {
      title: set.title,
      subtitle: set.subtitle,
      href: set.href,
      line: set.subtitle ? `${set.subtitle} · ${set.title}` : set.title,
    }
  );
}

/**
 * Where an attachment opens.
 *
 *   surface  the attachment surface (systems/attachments): a bottom sheet on a
 *            phone, a panel on a tablet, a window on a desktop.
 *   theater  the theater's stage (a video, a deck) — PiP on a phone.
 *   window   an in-app browser window (systems/windows).
 *   route    an in-site page, by the router.
 *   tab      the browser's own tab.
 */
export type AttachmentHome = "surface" | "theater" | "window" | "route" | "tab";
