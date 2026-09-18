import type { Locale } from "@/lib/i18n";
import {
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
    case "social":
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
 */
export function attachmentSetFor(
  commit: Commit,
  locale: Locale,
): AttachmentSet | null {
  const items = (commit.media ?? []).filter((m) => !isLinkPill(m));
  if (items.length === 0) return null;
  const hash = computeCommitHash(commit.id);
  return {
    id: commit.id,
    title: localize(commit.title, locale),
    subtitle: subtitleFor(commit, locale),
    hash,
    href: `/works#${hash}`,
    items,
  };
}
