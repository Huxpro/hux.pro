import type { Attachment } from "@/lib/log";

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
export interface AttachmentSet {
  /** The commit id — the surface's session key. */
  id: string;
  /** The commit's title, localized: the surface's title, the theater's. */
  title: string;
  /** Venue line — conference, publication, platform, company. */
  subtitle?: string;
  /** In-site address of the commit (`/works#<hash>`). */
  href?: string;
  /**
   * The attachments themselves, each carrying the commit it came from
   * (see {@link Attachment}). Media identity still matters — every
   * affordance on a row holds a reference to the commit's own media object
   * and finds its place here with {@link indexOfMedia}.
   *
   * On an ordinary set every item shares one origin, which is the set's
   * own; on a squashed row they do not, and that is the entire reason the
   * origin rides on the item rather than on the list.
   */
  items: readonly Attachment[];
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
