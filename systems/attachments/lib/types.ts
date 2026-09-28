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
   * Whose each item is, where not the set's own commit: a row that prints
   * another commit's covers with its own (a talk on the project it
   * introduced, lib/log-hosts.ts) opens them all as one set, and each page
   * still names the commit it came from. Aligned with `items`; a gap is the
   * set's own. Read it through `ownerOf`.
   */
  from?: readonly (AttachmentOwner | undefined)[];
}

/** The commit an attachment belongs to, as the surfaces name it. */
export interface AttachmentOwner {
  title: string;
  subtitle?: string;
  href?: string;
  /**
   * For another commit's item on a row (`from`): enough of that commit for
   * its page on the surface to stand for it: its hash, when, and its prose.
   */
  hash?: string;
  date?: string;
  description?: string;
}

/**
 * Where an attachment opens.
 *
 *   surface  the attachment surface (systems/attachments): a bottom sheet on a
 *            phone, a panel on a tablet, a window on a desktop.
 *   theater  the theater's stage (a video, a deck) — PiP on a phone.
 *   lightbox the image viewer: the still letterboxed on a veil, zoomable
 *            and pannable (wheel, pinch, double-click), on every viewport.
 *   window   an in-app browser window (systems/windows).
 *   route    an in-site page, by the router.
 *   tab      the browser's own tab.
 */
export type AttachmentHome =
  | "surface"
  | "theater"
  | "lightbox"
  | "window"
  | "route"
  | "tab";
