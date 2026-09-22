// =============================================================================
// Presentations — one works-page row over many commits.
//
// A presentation never becomes a commit. `planWorks` is the only reader
// that folds, and only /works and the editor's preview of /works ask it.
// Widgets, post embeds and `resolveGroupCommits` keep addressing commits
// by id, so a talk that is folded into a conference row on the timeline
// is still the talk everywhere else.
// =============================================================================

import type { Locale } from "./i18n";
import {
  localize,
  localizeOptional,
  matchesTypeFilter,
  type Commit,
  type FilterableCommitType,
  type Presentation,
  type PresentationSlot,
} from "./log";

/** One commit, as a line in the row. `line` is the caption when the
 *  author wrote one, otherwise the commit's own title. */
export interface ResolvedLeaf {
  commit: Commit;
  line: string;
  /** The commit title, when `line` is a caption and the title still says
   *  something the caption does not. */
  title?: string;
  description?: string;
}

/** A presentation rendered inside another. Its children are its own slots. */
export interface ResolvedGroup {
  id: string;
  line: string;
  /** The nested presentation's own sentence, when it has one. */
  description?: string;
  children: ResolvedChild[];
}

export type ResolvedChild =
  | { kind: "leaf"; leaf: ResolvedLeaf }
  | { kind: "group"; group: ResolvedGroup };

/**
 * A presentation that survived resolution and will take one row.
 * Strings are already in the viewer's locale.
 */
export interface ResolvedPresentation {
  id: string;
  anchor: Commit;
  title: string;
  /** A paragraph for the row. Absent when the roster itself is the blurb. */
  description?: string;
  /**
   * The folded row prints the member lines in the description slot.
   * Otherwise it prints `description`, and the member lines are a
   * quieter index under it until the row is opened.
   */
  rosterIsBlurb: boolean;
  children: ResolvedChild[];
  leaves: Commit[];
}

export type WorksRow =
  | { kind: "commit" }
  | { kind: "hide" }
  | { kind: "presentation"; presentation: ResolvedPresentation };

function isGroupSlot(
  slot: PresentationSlot,
): slot is PresentationSlot & { presentationId: string } {
  return typeof slot.presentationId === "string";
}

function venueOf(commit: Commit): string | null {
  switch (commit.type) {
    case "talk":
      return commit.conference.name || null;
    case "press":
      return commit.platform || null;
    case "post":
      return commit.publication.name || null;
    default:
      return null;
  }
}

/** The venue every leaf names, when they name the same one. */
function sharedVenue(leaves: readonly Commit[]): string | null {
  if (leaves.length < 2) return null;
  const names = leaves.map(venueOf);
  if (names.some((n) => !n)) return null;
  const first = names[0];
  return names.every((n) => n === first) ? first : null;
}

function pickAnchor(
  presentation: Presentation,
  leaves: readonly Commit[],
): Commit {
  const authored = presentation.anchor
    ? leaves.find((c) => c.id === presentation.anchor)
    : undefined;
  if (authored) return authored;
  return [...leaves].sort((a, b) => b.date.localeCompare(a.date))[0];
}

interface Built {
  children: ResolvedChild[];
  leaves: Commit[];
}

/**
 * Expand one presentation into a tree. A nested presentation that is
 * enabled becomes a group, and its commits are covered — a direct slot
 * listing the same commit is absorbed rather than printed twice. A
 * nested presentation that is disabled contributes nothing: its commits
 * stay free for the timeline (or for whatever else lists them).
 */
function buildTree(
  presentation: Presentation,
  byId: ReadonlyMap<string, Presentation>,
  commitById: ReadonlyMap<string, Commit>,
  locale: Locale,
  path: Set<string>,
): Built {
  if (path.has(presentation.id)) return { children: [], leaves: [] };
  path.add(presentation.id);

  const children: ResolvedChild[] = [];
  const leaves: Commit[] = [];
  // Nested presentations cover their commits wherever the slot sits, so a
  // direct slot for the same commit — before or after — is absorbed and
  // the authored order of the other slots still holds.
  const nested = new Map<number, { child: Presentation; built: Built }>();
  const covered = new Set<string>();
  presentation.members.forEach((slot, index) => {
    if (!isGroupSlot(slot)) return;
    const child = byId.get(slot.presentationId);
    if (!child || child.enabled === false) return;
    const built = buildTree(child, byId, commitById, locale, path);
    if (built.leaves.length === 0) return;
    nested.set(index, { child, built });
    for (const leaf of built.leaves) covered.add(leaf.id);
  });

  presentation.members.forEach((slot, index) => {
    if (isGroupSlot(slot)) {
      const found = nested.get(index);
      if (!found) return;
      const caption = localizeOptional(slot.caption, locale);
      const resolved = resolveShape(found.child, found.built, locale);
      children.push({
        kind: "group",
        group: {
          id: found.child.id,
          line: caption ?? resolved?.title ?? found.child.id,
          description: localizeOptional(found.child.description, locale),
          children: found.built.children,
        },
      });
      leaves.push(...found.built.leaves);
      return;
    }
    if (covered.has(slot.commitId)) return;
    const commit = commitById.get(slot.commitId);
    if (!commit) return;
    const caption = localizeOptional(slot.caption, locale);
    const title = localize(commit.title, locale);
    const description = localize(commit.description, locale);
    children.push({
      kind: "leaf",
      leaf: {
        commit,
        line: caption ?? title,
        title: caption && caption !== title ? title : undefined,
        description: description || undefined,
      },
    });
    leaves.push(commit);
  });

  path.delete(presentation.id);
  return { children, leaves };
}

function resolveShape(
  presentation: Presentation,
  built: Built,
  locale: Locale,
): ResolvedPresentation | null {
  const leaves = built.leaves;
  if (leaves.length === 0) return null;

  const hasNesting = built.children.some((c) => c.kind === "group");
  const hasAuthoredCopy = !!(presentation.title || presentation.description);
  // One commit and nothing to say about it is not a row. It is the commit.
  if (leaves.length < 2 && !hasAuthoredCopy && !hasNesting) return null;

  const anchor = pickAnchor(presentation, leaves);
  const authoredTitle = localizeOptional(presentation.title, locale);
  const authoredDesc = localizeOptional(presentation.description, locale);
  const venue = sharedVenue(leaves);
  const anchorTitle = localize(anchor.title, locale);
  const title =
    authoredTitle ?? (venue && !hasNesting ? venue : anchorTitle);
  const speakingAsAnchor = title === anchorTitle && !authoredTitle;
  const anchorDesc = localize(anchor.description, locale);
  const description =
    authoredDesc ?? (speakingAsAnchor ? anchorDesc || undefined : undefined);

  return {
    id: presentation.id,
    anchor,
    title,
    description,
    rosterIsBlurb: !description,
    children: built.children,
    leaves,
  };
}

function pruneClaimed(
  children: ResolvedChild[],
  claimed: ReadonlySet<string>,
): { children: ResolvedChild[]; leaves: Commit[] } {
  const next: ResolvedChild[] = [];
  const leaves: Commit[] = [];
  for (const child of children) {
    if (child.kind === "leaf") {
      if (claimed.has(child.leaf.commit.id)) continue;
      next.push(child);
      leaves.push(child.leaf.commit);
      continue;
    }
    const inner = pruneClaimed(child.group.children, claimed);
    if (inner.leaves.length === 0) continue;
    next.push({
      kind: "group",
      group: { ...child.group, children: inner.children },
    });
    leaves.push(...inner.leaves);
  }
  return { children: next, leaves };
}

/**
 * Decide, for the commits of one timeline, which row each one takes.
 *
 * An enabled presentation claims its leaves and prints once, at the
 * anchor. The other leaves are `hide` — still in the array, so identity
 * and the rail keep resolving, but not drawn. A presentation referenced
 * by another enabled one is not a root; it renders inside its parent.
 *
 * A type filter unfolds a mixed row. Two talks stay one row under
 * `?type=talk`; a project folded with its talk comes apart, because the
 * filter asked for the commit and the commit is still the data.
 * First root in authored order wins a commit that two roots both want.
 */
export function planWorks(
  commits: readonly Commit[],
  presentations: readonly Presentation[] | undefined,
  activeTypes: readonly FilterableCommitType[] = [],
  locale: Locale = "en",
): Map<string, WorksRow> {
  const plan = new Map<string, WorksRow>();
  if (!presentations || presentations.length === 0) return plan;

  const commitById = new Map(commits.map((c) => [c.id, c]));
  const enabled = presentations.filter((p) => p.enabled !== false);
  const byId = new Map(enabled.map((p) => [p.id, p]));

  const referenced = new Set<string>();
  for (const presentation of enabled) {
    for (const slot of presentation.members) {
      if (!isGroupSlot(slot)) continue;
      const child = byId.get(slot.presentationId);
      if (child) referenced.add(child.id);
    }
  }

  const claimed = new Set<string>();
  for (const presentation of enabled) {
    if (referenced.has(presentation.id)) continue;
    const built = buildTree(presentation, byId, commitById, locale, new Set());
    const available = pruneClaimed(built.children, claimed);
    if (available.leaves.length === 0) continue;

    const folds =
      activeTypes.length === 0 ||
      available.leaves.every((c) => matchesTypeFilter(c, activeTypes));
    if (!folds) continue;

    const resolved = resolveShape(
      presentation,
      available,
      locale,
    );
    if (!resolved) continue;

    // The anchor has to be one of the leaves still in this row. pickAnchor
    // already guarantees that; claim the rest so a later root cannot
    // print them again.
    for (const leaf of resolved.leaves) {
      claimed.add(leaf.id);
      if (leaf.id === resolved.anchor.id) {
        plan.set(leaf.id, { kind: "presentation", presentation: resolved });
      } else {
        plan.set(leaf.id, { kind: "hide" });
      }
    }
  }

  return plan;
}

/** What the timeline does with one commit. Absence means "draw the commit". */
export function worksRowFor(
  plan: ReadonlyMap<string, WorksRow>,
  commitId: string,
): WorksRow {
  return plan.get(commitId) ?? { kind: "commit" };
}

export interface PresentationWarning {
  presentationId: string;
  message: string;
}

/**
 * Authoring problems the editor can show. Runtime already degrades
 * (a missing id is skipped, two roots collapse to the first), and this
 * is the sentence that says so before the row quietly does it.
 */
export function presentationWarnings(
  presentations: readonly Presentation[] | undefined,
  commits: readonly Commit[],
): PresentationWarning[] {
  if (!presentations || presentations.length === 0) return [];
  const warnings: PresentationWarning[] = [];
  const commitIds = new Set(commits.map((c) => c.id));
  const ids = new Set<string>();

  for (const presentation of presentations) {
    if (ids.has(presentation.id)) {
      warnings.push({
        presentationId: presentation.id,
        message: `Duplicate id “${presentation.id}”.`,
      });
    }
    ids.add(presentation.id);
  }

  const byId = new Map(presentations.map((p) => [p.id, p]));

  for (const presentation of presentations) {
    const seen = new Set<string>();
    const walk = (id: string, path: string[]): void => {
      if (path.includes(id)) {
        warnings.push({
          presentationId: presentation.id,
          message: `Cycle: ${[...path, id].join(" → ")}.`,
        });
        return;
      }
      const node = byId.get(id);
      if (!node || seen.has(id)) return;
      seen.add(id);
      for (const slot of node.members) {
        if (isGroupSlot(slot)) {
          if (!byId.has(slot.presentationId)) {
            warnings.push({
              presentationId: id,
              message: `Missing presentation “${slot.presentationId}”.`,
            });
          } else {
            walk(slot.presentationId, [...path, id]);
          }
        } else if (!commitIds.has(slot.commitId)) {
          warnings.push({
            presentationId: id,
            message: `Missing commit “${slot.commitId}”.`,
          });
        }
      }
    };
    walk(presentation.id, []);
  }

  // Two enabled roots that both want the same commit. Nesting does not
  // count: a child referenced by an enabled parent is not a root.
  const enabled = presentations.filter((p) => p.enabled !== false);
  const enabledById = new Map(enabled.map((p) => [p.id, p]));
  const referenced = new Set<string>();
  for (const presentation of enabled) {
    for (const slot of presentation.members) {
      if (isGroupSlot(slot) && enabledById.has(slot.presentationId)) {
        referenced.add(slot.presentationId);
      }
    }
  }

  const owner = new Map<string, string>();
  // Leaves belong to the root, not to the nested presentation that
  // happened to name them — a parent that also lists the commit directly
  // is absorbing it, which is composition, not a fight.
  const claim = (nodeId: string, rootId: string, path: Set<string>) => {
    if (path.has(nodeId)) return;
    const presentation = enabledById.get(nodeId);
    if (!presentation) return;
    path.add(nodeId);
    for (const slot of presentation.members) {
      if (isGroupSlot(slot)) {
        claim(slot.presentationId, rootId, path);
        continue;
      }
      const prev = owner.get(slot.commitId);
      if (prev && prev !== rootId) {
        warnings.push({
          presentationId: rootId,
          message: `“${slot.commitId}” is also in “${prev}”, which comes first and keeps it.`,
        });
      } else if (!prev) {
        owner.set(slot.commitId, rootId);
      }
    }
    path.delete(nodeId);
  };
  for (const presentation of enabled) {
    if (referenced.has(presentation.id)) continue;
    claim(presentation.id, presentation.id, new Set());
  }

  return warnings;
}

/**
 * The name the editor prints for a presentation. An authored title wins.
 * Otherwise the same derivation the row uses — a shared venue, or the
 * anchor's title — so a fold with nothing written in the title field does
 * not show up as its id.
 */
export function presentationHeading(
  presentation: Presentation,
  commits: readonly Commit[],
  locale: Locale,
): string {
  const authored = localizeOptional(presentation.title, locale);
  if (authored) return authored;
  const solo: Presentation = {
    ...presentation,
    enabled: true,
    members: presentation.members.filter((slot) => !isGroupSlot(slot)),
  };
  const plan = planWorks(commits, [solo], [], locale);
  for (const row of plan.values()) {
    if (row.kind === "presentation" && row.presentation.id === presentation.id) {
      return row.presentation.title;
    }
  }
  const first = presentation.members.find((slot) => !isGroupSlot(slot));
  const commit = first ? commits.find((c) => c.id === first.commitId) : undefined;
  return commit ? localize(commit.title, locale) : presentation.id;
}

/** Every presentation that names this commit, directly, at any depth. */
export function presentationsForCommit(
  presentations: readonly Presentation[] | undefined,
  commitId: string,
): Presentation[] {
  if (!presentations) return [];
  const byId = new Map(presentations.map((p) => [p.id, p]));
  const hits = new Set<string>();

  const walk = (presentation: Presentation, path: Set<string>) => {
    if (path.has(presentation.id)) return;
    path.add(presentation.id);
    for (const slot of presentation.members) {
      if (isGroupSlot(slot)) {
        const child = byId.get(slot.presentationId);
        if (child) walk(child, path);
      } else if (slot.commitId === commitId) {
        hits.add(presentation.id);
      }
    }
    path.delete(presentation.id);
  };

  for (const presentation of presentations) walk(presentation, new Set());
  // A parent that only reaches the commit through a child should show too.
  const withAncestors = new Set(hits);
  for (const presentation of presentations) {
    for (const slot of presentation.members) {
      if (isGroupSlot(slot) && hits.has(slot.presentationId)) {
        withAncestors.add(presentation.id);
      }
    }
  }
  return presentations.filter((p) => withAncestors.has(p.id));
}
