import type { Locale } from "@/lib/i18n";
import type { Attachment } from "@/lib/log";
import {
  attachmentsOf,
  computeCommitHash,
  isLinkPill,
  localize,
  localizeOptional,
  type Commit,
} from "@/lib/log";
import type { AttachmentSet } from "./types";

// =============================================================================
// Attachments — building a set from a commit
// =============================================================================

/** The venue line under a commit's title, by type. */
function subtitleFor(commit: Commit, locale: Locale): string | undefined {
  switch (commit.type) {
    case "talk":
      return commit.conference.name;
    case "post":
      return commit.publication.name;
    case "press":
      return commit.platform;
    case "role":
      return localize(commit.company, locale);
    case "project":
      return localizeOptional(commit.team, locale);
    default:
      return undefined;
  }
}

/**
 * A commit's attachments as one openable set, or null when it attaches
 * nothing but pills. The media objects are the commit's own, so an index
 * found by reference elsewhere (`set.items.indexOf(media)`) lands here.
 *
 * `as` is for a row that stands for more than one commit (a squash, see
 * `lib/log-squash.ts`): the media is every member's, and the name on the
 * surface is the row's headline rather than the lead's own title. The
 * identity rule is unchanged and is the reason this takes the objects
 * rather than rebuilding them — the members' media items are passed
 * through by reference, so `indexOf` still finds them from a cover, a rail
 * icon or a tile anywhere on the row.
 */
export function attachmentSetFor(
  commit: Commit,
  locale: Locale,
  as?: { attachments?: Attachment[]; title?: string; subtitle?: string },
): AttachmentSet | null {
  // The attachments are passed in wherever the caller has already built
  // them — a row builds its own once and hands the same array to the set
  // and to its strip, so a cover and the set agree on object identity.
  const items = (as?.attachments ?? attachmentsOf(commit, locale)).filter(
    (a) => !isLinkPill(a.media),
  );
  if (items.length === 0) return null;
  const hash = computeCommitHash(commit.id);
  return {
    id: commit.id,
    // The set's own name is the ROW's, and it is only ever used where the
    // sheet or the stage is talking about the collection rather than about
    // one thing in it. What one thing is, each item now says for itself.
    title: as?.title ?? localize(commit.title, locale),
    subtitle: as?.subtitle ?? subtitleFor(commit, locale),
    href: `/works#${hash}`,
    items,
  };
}
