// =============================================================================
// Squash resolution — turning a list of ids into a row.
//
// `lib/log.ts` says what a squash *is*; this module answers the four
// questions a renderer has to ask about one, and nothing else:
//
//   which commits are actually in it   (`planSquashes`)
//   whose row is it                    (the lead)
//   what does the headline say         (`squashHeadline`)
//   what do the member lines say       (`squashLines`)
//
// Deliberately free of React and of any rendering vocabulary, the way
// `lib/log-view.ts` is: the timeline, the editor's preview and any future
// surface that wants to print a squash all derive it from here, so none of
// them can invent a fifth answer.
//
// The absorbed members are reported as *hidden rows*, not removed from the
// array. That is not a shortcut — it is what keeps the rail, the connectors
// and the render loop honest: /works already has one predicate for "this
// commit does not take a row" (`isRowVisible`, negated), and three consumers
// that re-bracket around it. A squash is one more reason for a row not to
// print, so it joins that predicate instead of adding a second pass none of
// those three would know about.
// =============================================================================

import type { Attachment } from "./log";
import {
  attachmentsOf,
  commitVenue,
  formatCommitDate,
  formatDateRange,
  localize,
  localizeOptional,
  type Commit,
  type Squash,
  type SquashAxis,
} from "./log";
import type { Locale } from "./i18n";

export const SQUASH_AXES: readonly SquashAxis[] = [
  "title",
  "venue",
  "venue-title",
  "none",
];

export const DEFAULT_SQUASH_AXIS: SquashAxis = "title";

/** A squash with its ids resolved against the commits actually on the page. */
export interface ResolvedSquash {
  squash: Squash;
  axis: SquashAxis;
  /**
   * Whose row this is — the gutter mark, the prose, the byline, the
   * position in the sort. Always one of {@link members}.
   */
  lead: Commit;
  /** Every surviving member, lead included, in the order the lines print. */
  members: Commit[];
}

export interface SquashPlan {
  /** Lead commit id → the squash its row stands for. */
  byLead: Map<string, ResolvedSquash>;
  /**
   * Members that no longer take a row of their own. The timeline folds
   * this into the predicate it already has for hidden rows.
   */
  absorbed: Set<string>;
}

const EMPTY_PLAN: SquashPlan = { byLead: new Map(), absorbed: new Set() };

/**
 * Resolve every squash against one chapter's commits.
 *
 * `commits` is the tag's list in render order, and `isHidden` is the
 * caller's existing "does not take a row" rule — the type filter, plus
 * whatever else /works already decided. Both matter:
 *
 *  - **A squash never hides work from a filter.** Members the filter
 *    dropped are not in the row, and a squash the filter has reduced to a
 *    single survivor stops being a squash at all: that commit gets its own
 *    ordinary row back. Asking for `?type=talk` over a project row that
 *    absorbed a talk prints the talk, not nothing.
 *  - **A squash cannot reach across a chapter.** It is resolved per tag, so
 *    ids belonging to another era simply do not resolve here and keep their
 *    own rows. A row that pulled a 2023 project up into the 2025 chapter
 *    would be lying about the timeline, and the one thing the page is is a
 *    chronology.
 */
export function planSquashes(
  commits: Commit[],
  squashes: readonly Squash[] | undefined,
  isHidden: (commit: Commit) => boolean,
): SquashPlan {
  if (!squashes || squashes.length === 0) return EMPTY_PLAN;

  const order = new Map<string, number>();
  commits.forEach((c, i) => order.set(c.id, i));

  const byLead = new Map<string, ResolvedSquash>();
  const absorbed = new Set<string>();
  // One commit, one row. A commit listed in two squashes joins the first
  // that claims it; the second prints without it rather than rendering the
  // same work twice under two headlines.
  const claimed = new Set<string>();

  for (const squash of squashes) {
    const members: Commit[] = [];
    for (const id of squash.commitIds) {
      if (claimed.has(id)) continue;
      const i = order.get(id);
      if (i === undefined) continue;
      const commit = commits[i];
      if (isHidden(commit)) continue;
      members.push(commit);
    }
    // Nothing to squash: one survivor is just a commit, and it keeps the
    // row it always had.
    if (members.length < 2) continue;

    // Where the row lands. The author's `lead` when it survived; otherwise
    // the member that sorts highest, which on a reverse-chronological page
    // is the most recent — a squash sits at its newest member, the way the
    // work itself is "as of" then. `commitIds` order stays purely the order
    // the lines print in.
    const lead =
      (squash.lead && members.find((m) => m.id === squash.lead)) ||
      members.reduce((best, m) =>
        order.get(m.id)! < order.get(best.id)! ? m : best,
      );

    for (const m of members) {
      claimed.add(m.id);
      if (m.id !== lead.id) absorbed.add(m.id);
    }
    byLead.set(lead.id, {
      squash,
      axis: squash.axis ?? DEFAULT_SQUASH_AXIS,
      lead,
      members,
    });
  }

  return byLead.size === 0 ? EMPTY_PLAN : { byLead, absorbed };
}

// =============================================================================
// What the row says
// =============================================================================

/** Case- and space-insensitive equality — the test for "these two would
 *  print as the same line", which is the only kind of sameness the
 *  headline derivation cares about. */
function sameLine(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The one value every member shares, or null if they do not all share it. */
function common(values: (string | undefined)[]): string | null {
  const first = values[0];
  if (!first) return null;
  return values.every((v) => v && sameLine(v, first)) ? first : null;
}

/**
 * The row's headline: what the members have in common, under the axis that
 * says what they differ in.
 *
 * Authored wins, always — that is the escape hatch, and the only answer
 * available under `"venue-title"`. Otherwise the shared field, and where
 * the members turn out not to share it after all, the lead's own title.
 * The last one is the honest degradation: an axis is the author's claim
 * about the data, and a claim the data does not support should print
 * something true rather than the first member's value dressed as a group's.
 */
export function squashHeadline(
  resolved: ResolvedSquash,
  locale: Locale,
): string {
  return resolveHeadline(resolved, locale).text;
}

/** Where a headline came from — see {@link resolveHeadline}. */
export type HeadlineSource =
  /** {@link Squash.title}, as written. */
  | "authored"
  /** The field the axis says the members share, and they do. */
  | "shared"
  /** The lead's own title, because neither of the above was available. */
  | "fallback";

/**
 * The headline, and where it came from.
 *
 * The source is not decoration. `"fallback"` means the author claimed a
 * shared field the data does not have — an axis is a claim, and this is
 * the page quietly declining to print it. On /works that degradation is
 * the right behaviour and should stay silent; in the editor it is the one
 * thing worth saying out loud, which is why the two share this function
 * instead of the editor guessing at the same conditions.
 */
export function resolveHeadline(
  resolved: ResolvedSquash,
  locale: Locale,
): { text: string; source: HeadlineSource } {
  const authored = localizeOptional(resolved.squash.title, locale);
  if (authored) return { text: authored, source: "authored" };

  const { axis, members, lead } = resolved;
  const derived =
    axis === "title"
      ? common(members.map((m) => commitVenue(m)))
      : axis === "venue"
        ? common(members.map((m) => localize(m.title, locale)))
        : null;

  return derived
    ? { text: derived, source: "shared" }
    : { text: localize(lead.title, locale), source: "fallback" };
}

/**
 * What is wrong with this squash, in one sentence, or null.
 *
 * Only the editor asks. The page never complains — it prints the most
 * truthful thing it can and moves on — so this is where "truthful but not
 * what you asked for" becomes visible to the person who asked.
 */
export function squashWarning(
  resolved: ResolvedSquash,
  locale: Locale,
): string | null {
  const { axis, members } = resolved;
  const { source } = resolveHeadline(resolved, locale);

  if (axis === "venue-title" && source !== "authored") {
    return "These commits share nothing to build a headline from, so the row is wearing the lead's title. Write one.";
  }
  if (source === "fallback") {
    return axis === "title"
      ? "These commits are not all at the same venue, so there is no shared venue to head the row — it is wearing the lead's title instead."
      : "These commits do not all have the same title, so there is nothing shared to head the row — it is wearing the lead's title instead.";
  }
  // Every line the same is the other axis's job, and the likelier slip:
  // "same venue, different talks" typed in as "venues".
  const labels = squashLines(resolved, locale, () => "").map((l) => l.label);
  if (labels.length > 1 && new Set(labels).size === 1) {
    return `Every line reads "${labels[0]}". The other axis is probably the one you want.`;
  }
  if (members.some((m) => !commitVenue(m)) && axis !== "none") {
    return "Some of these have no venue — a project or an event — so their line falls back to their title.";
  }
  return null;
}

/** One member, as its line prints. */
export interface SquashLine {
  /** The member's own hash — the row anchors all of them. */
  hash: string;
  commitId: string;
  /** What the line says, per the axis. */
  label: string;
  /** The member's own date, printed only where the members differ. */
  date: string | null;
}

/**
 * The member lines, under the axis.
 *
 * `"none"` has none by definition: its members are in the row only to hand
 * over their media, which the attachment set already collected.
 *
 * The date prints per line only when the members actually differ on it.
 * Two talks at one conference on one day repeating `Nov 2025` twice under
 * a headline that already says `Nov 2025` is three statements of one fact;
 * the same talk given in September and November is a line where the date
 * is the whole point.
 */
export function squashLines(
  resolved: ResolvedSquash,
  locale: Locale,
  hashOf: (id: string) => string,
): SquashLine[] {
  const { axis, members } = resolved;
  if (axis === "none") return [];

  const dates = members.map((m) => formatCommitDate(m, locale));
  const datesDiffer = new Set(dates).size > 1;

  return members.map((m, i) => {
    const title = localize(m.title, locale);
    const venue = commitVenue(m);
    const label =
      axis === "venue"
        ? // The venue is what differs, so it is the line. A member with no
          // venue to print — a project among talks — falls back to its
          // title rather than printing an empty line.
          (venue ?? title)
        : axis === "title"
          ? title
          : // "venue-title": both, joined the way a folded aside joins them,
            // and the venue alone when the two would say the same thing.
            venue && !sameLine(venue, title)
            ? `${venue} · ${title}`
            : (venue ?? title);

    return {
      hash: hashOf(m.id),
      commitId: m.id,
      label,
      date: datesDiffer ? dates[i] : null,
    };
  });
}

/**
 * The date the squashed row prints.
 *
 * One month across every member and it is that month — the row is a single
 * occasion and says so. Spread over time and it is a range, which is the
 * vocabulary a role row already uses for "this went on for a while", and
 * the only honest thing to print over lines dated two months apart.
 */
export function squashDate(
  resolved: ResolvedSquash,
  locale: Locale,
): string {
  const { members, lead } = resolved;
  const months = members.map((m) => m.date);
  const earliest = months.reduce((a, b) => (a < b ? a : b));
  const latest = months.reduce((a, b) => (a > b ? a : b));
  if (earliest === latest) return formatCommitDate(lead, locale);
  return formatDateRange(earliest, latest, locale);
}

/**
 * Every member's attachments, in the order the lines print, deduplicated
 * by url.
 *
 * This is the whole of what the `"none"` axis does and most of what the
 * others do — and it is safe precisely because an attachment is media WITH
 * its origin (see {@link Attachment}). The array handed downstream is flat,
 * but nothing in it has forgotten which commit attached it, so the strip,
 * the grid, the stage and the sheet can each name a recording after the
 * talk it is of rather than after the row it landed on.
 *
 * That is the part of the git analogy that deliberately does not hold. A
 * real squash destroys the commits it folds and there is nothing left to
 * credit; here they are all still in the log, so forgetting would be a
 * choice rather than a limitation.
 *
 * Dedup by url because members genuinely do share artifacts — a conference
 * posts one recording covering both slots — and the same cover printed
 * twice in a strip reads as a bug. The first member to claim it keeps it,
 * matching the order the lines print in.
 */
export function squashAttachments(
  resolved: ResolvedSquash,
  locale: Locale,
): Attachment[] {
  const seen = new Set<string>();
  const out: Attachment[] = [];
  for (const m of resolved.members) {
    for (const a of attachmentsOf(m, locale)) {
      if (seen.has(a.media.url)) continue;
      seen.add(a.media.url);
      out.push(a);
    }
  }
  return out;
}
