import {
  COMMIT_TYPE_ORDER,
  type Commit,
  type CommitType,
  type TimelineData,
} from "./log";

/**
 * Parse `?type=talk,project` into a set of valid commit types.
 * Empty / unknown-only values mean "no filter" (show everything).
 */
export function parseCommitTypeParam(
  param: string | null | undefined,
): Set<CommitType> | null {
  if (!param) return null;
  const selected = new Set<CommitType>();
  for (const raw of param.split(",")) {
    const token = raw.trim();
    if (isCommitType(token)) selected.add(token);
  }
  return selected.size > 0 ? selected : null;
}

/**
 * Serialize a type filter for the URL. `null` (and "every available type
 * selected") omit the param so a fully-inclusive filter stays a clean `/works`.
 */
export function serializeCommitTypeParam(
  selected: Set<CommitType> | null,
  available: CommitType[] = COMMIT_TYPE_ORDER,
): string | null {
  if (!selected || selected.size === 0) return null;
  if (
    available.length > 0 &&
    selected.size === available.length &&
    available.every((type) => selected.has(type))
  ) {
    return null;
  }
  const tokens = COMMIT_TYPE_ORDER.filter((type) => selected.has(type));
  return tokens.length > 0 ? tokens.join(",") : null;
}

/** Types that actually appear in the timeline, in canonical order. */
export function availableCommitTypes(data: TimelineData[]): CommitType[] {
  const present = new Set<CommitType>();
  for (const { commits } of data) {
    for (const commit of commits) present.add(commit.type);
  }
  return COMMIT_TYPE_ORDER.filter((type) => present.has(type));
}

/**
 * Apply a type filter to timeline data.
 *
 * Roles are structural (tenure rails, bylines) so they stay in the array
 * even when `role` isn't selected — they're just `hideRow`'d so they don't
 * take a line. Selecting `role` reveals the suppressed tenure rows, which
 * is the only way those jobs show up on /works.
 *
 * Tag blocks with no remaining visible row are dropped.
 */
export function filterTimelineByTypes(
  data: TimelineData[],
  selected: Set<CommitType> | null,
): TimelineData[] {
  if (!selected) return data;

  return data
    .map(({ tag, commits }) => ({
      tag,
      commits: commits
        .filter((c) => c.type === "role" || selected.has(c.type))
        .map((c) => applyRoleVisibility(c, selected.has("role"))),
    }))
    .filter(({ commits }) => commits.some(isVisibleTimelineRow));
}

export function isVisibleTimelineRow(commit: Commit): boolean {
  return !(commit.type === "role" && commit.hideRow === true);
}

function applyRoleVisibility(commit: Commit, revealRoles: boolean): Commit {
  if (commit.type !== "role") return commit;
  if (revealRoles) {
    return commit.hideRow ? { ...commit, hideRow: false } : commit;
  }
  return commit.hideRow ? commit : { ...commit, hideRow: true };
}

function isCommitType(value: string): value is CommitType {
  return (COMMIT_TYPE_ORDER as string[]).includes(value);
}
