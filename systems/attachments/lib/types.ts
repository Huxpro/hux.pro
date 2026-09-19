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
