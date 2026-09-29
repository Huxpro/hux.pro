import type { Locale } from "@/lib/i18n";
import {
  computeCommitHash,
  formatCommitDate,
  localize,
  localizeOptional,
  type Commit,
} from "@/lib/log";
import type { AttachmentOwner, AttachmentSet } from "./types";

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
 * nothing. The media objects are the commit's own, so an index
 * found by reference elsewhere (`set.items.indexOf(media)`) lands here.
 */
export function attachmentSetFor(
  commit: Commit,
  locale: Locale,
): AttachmentSet | null {
  const items = commit.media ?? [];
  if (items.length === 0) return null;
  const hash = computeCommitHash(commit.id);
  return {
    id: commit.id,
    title: localize(commit.title, locale),
    subtitle: subtitleFor(commit, locale),
    href: `/works#${hash}`,
    items,
  };
}

/** The commit an item belongs to: its own entry in `from`, else the set's. */
export function ownerOf(set: AttachmentSet, index: number): AttachmentOwner {
  return set.from?.[index] ?? set;
}

/**
 * A row's set when the row prints other commits' covers too: every item in
 * the order the row prints them (`before` guests, the commit's own, then
 * the rest), under the row's name, each remembering whose it is. One set,
 * so the surface pages through everything on the row.
 */
export function attachmentSetWith(
  commit: Commit,
  guests: readonly { commit: Commit; before: boolean }[],
  locale: Locale,
): AttachmentSet | null {
  const owner = (c: Commit): AttachmentOwner => ({
    title: localize(c.title, locale),
    subtitle: subtitleFor(c, locale),
    href: `/works#${computeCommitHash(c.id)}`,
    hash: computeCommitHash(c.id),
    date: formatCommitDate(c, locale),
    description: localizeOptional(c.description, locale),
  });
  const runs = [
    ...guests.filter((g) => g.before).map((g) => ({ c: g.commit, guest: true })),
    { c: commit, guest: false },
    ...guests.filter((g) => !g.before).map((g) => ({ c: g.commit, guest: true })),
  ];
  const items = runs.flatMap((r) => r.c.media ?? []);
  if (items.length === 0) return null;
  const own = attachmentSetFor(commit, locale);
  return {
    id: commit.id,
    title: localize(commit.title, locale),
    subtitle: subtitleFor(commit, locale),
    href: own?.href ?? `/works#${computeCommitHash(commit.id)}`,
    items,
    from: runs.flatMap((r) =>
      (r.c.media ?? []).map(() => (r.guest ? owner(r.c) : undefined)),
    ),
  };
}
