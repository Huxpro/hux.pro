// =============================================================================
// Squash resolution — turning a list of ids into a row.
//
// `lib/log.ts` says what a squash *is*; this module answers the questions a
// renderer has to ask about one, and nothing else:
//
//   which commits are actually in it          (`planSquashes`)
//   whose row is it                           (the lead, and the parent)
//   what do they share, and what varies       (`factorSquash`)
//
// Deliberately free of React and of any rendering vocabulary, the way
// `lib/log-view.ts` is: the timeline, the editor's preview and any future
// surface that wants to print a squash all derive it from here, so none of
// them can invent a second answer.
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
  computeCommitHash,
  formatCommitDate,
  formatDateRange,
  getCommitLanguageBadge,
  localize,
  localizeOptional,
  type Commit,
  type CommitType,
  type Squash,
} from "./log";
import type { Locale } from "./i18n";

/** A squash with its ids resolved against the commits actually on the page. */
export interface ResolvedSquash {
  squash: Squash;
  /**
   * Where the row sits and whose gutter mark and byline it wears: the
   * parent when there is one, otherwise the newest member. Always one of
   * {@link members}.
   */
  lead: Commit;
  /** The member that IS the row (see `Squash.parent`), if it survived. */
  parent: Commit | null;
  /** Every surviving member, parent included, in authored order. */
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

    // A parent the filter dropped is not a parent any more: the survivors
    // are peers, and the row is built from what they share.
    const parent =
      (squash.parent && members.find((m) => m.id === squash.parent)) || null;
    // Where the row lands. The parent's own place when there is one; else
    // the member that sorts highest, which on a reverse-chronological page
    // is the most recent — a group of peers sits at its newest member, the
    // way the work itself is "as of" then.
    const lead =
      parent ??
      members.reduce((best, m) =>
        order.get(m.id)! < order.get(best.id)! ? m : best,
      );

    for (const m of members) {
      claimed.add(m.id);
      if (m.id !== lead.id) absorbed.add(m.id);
    }
    byLead.set(lead.id, { squash, lead, parent, members });
  }

  return byLead.size === 0 ? EMPTY_PLAN : { byLead, absorbed };
}

// =============================================================================
// Factoring — what the members share, and what each one says for itself.
//
// Every field is asked the same question separately: does every member say
// the same thing here, in this locale? If so it is said once, in the header.
// If not, it is said per member, in the band. There is no field that one
// member decides for the others.
//
// Per locale is not a refinement, it is the case that broke the previous
// design. The two React for Two Threads talks share an English title and
// not a Chinese one (《双线程的 React》 is the SEE Conf edition's own), so
// "the title is shared" was true on /works in English and false on the same
// page in Chinese. Asked per field and per locale, both pages are right.
// =============================================================================

/** Case- and space-insensitive equality — "these would print as one line". */
function sameLine(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The one value every member shares, or null if they do not all share it. */
function common<T extends string>(values: (T | null | undefined)[]): T | null {
  const first = values[0];
  if (!first) return null;
  return values.every((v) => v && sameLine(v, first)) ? first : null;
}

/** Where the headline came from. The editor reads this; the page does not. */
export type HeadlineSource =
  | "authored"
  | "parent"
  | "shared-title"
  | "shared-venue"
  /** Nothing to derive from: the lead's own title, standing in. */
  | "fallback";

/** One member, as the nested band prints it. */
export interface SquashMemberFacts {
  commit: Commit;
  hash: string;
  type: CommitType;
  /** The members are of different types, so each wears its own mark. */
  showType: boolean;
  /**
   * The fields that vary, as one line: the venue where venues differ, the
   * title where titles differ, `venue · title` where both do. Never a field
   * the header already said.
   */
  label: string;
  /** Its own date, where the members' dates differ; null where shared. */
  date: string | null;
  /** Its own language badge, where the members' badges differ. */
  languageBadge: "EN" | "中文" | null;
  /** How it relates to the group — authored (`Squash.relations`). */
  relation: string | null;
  /** Its own prose. Never promoted to the header. */
  description: string;
  /** An aside among the members keeps its quiet voice in the band. */
  quiet: boolean;
}

export interface SquashFacts {
  /** `"parent"`: the header is one member's own row. `"peers"`: it is built
   *  from what the members share. See `Squash.parent`. */
  mode: "peers" | "parent";
  headline: string;
  headlineSource: HeadlineSource;
  /**
   * The line under the headline: whatever the members share that the
   * headline is not already saying. Nothing shared goes unsaid — if the
   * headline is authored and the members share a venue, the venue prints
   * here rather than vanishing.
   */
  meta: string | null;
  /** The header's date: the shared one, or the range the members span. */
  date: string;
  /** The header's language badge, when every member's is the same. */
  languageBadge: "EN" | "中文" | null;
  /** The header's type, when every member is one; else the lead's. */
  type: CommitType;
  /** The row's own prose — authored, or the parent's. Never a peer's. */
  description: string;
  /** Every member is an aside, so the row is one. */
  quiet: boolean;
  /** Which fields are shared — named, for the editor to show the author. */
  shared: {
    title: boolean;
    venue: boolean;
    date: boolean;
    language: boolean;
    type: boolean;
  };
  /**
   * The nested level, in authored order. Under a parent, every member but
   * the parent — the parent is the header, and its covers print bare at the
   * head of the band.
   */
  members: SquashMemberFacts[];
}

/**
 * Factor a squash into a header and a band, for one locale.
 *
 * The comparison runs over EVERY member, the parent included: under a
 * parent, a child that shares the parent's venue does not repeat it, for
 * the same reason a peer does not.
 */
export function factorSquash(
  resolved: ResolvedSquash,
  locale: Locale,
): SquashFacts {
  const { squash, members, lead, parent } = resolved;

  const titles = members.map((m) => localize(m.title, locale));
  const venues = members.map((m) => commitVenue(m));
  const dates = members.map((m) => m.date);
  const badges = members.map((m) => getCommitLanguageBadge(m, locale));

  const sharedTitle = common(titles);
  const sharedVenue = common(venues);
  const sharedDate = common(dates);
  // A badge is shared when every member would wear the same one — including
  // every member wearing none, which is the common case in the reader's own
  // language and is exactly as shared as two `EN`s.
  const languageShared = badges.every((b) => b === badges[0]);
  const typeShared = members.every((m) => m.type === members[0].type);

  // The headline: the author's, then the parent's own, then whatever the
  // members agree on, title before venue, since a title names the work
  // and a venue names where it happened.
  const authored = localizeOptional(squash.title, locale);
  const [headline, headlineSource]: [string, HeadlineSource] = authored
    ? [authored, "authored"]
    : parent
      ? [localize(parent.title, locale), "parent"]
      : sharedTitle
        ? [sharedTitle, "shared-title"]
        : sharedVenue
          ? [sharedVenue, "shared-venue"]
          : [localize(lead.title, locale), "fallback"];

  // Under a parent, the header line is the parent's own (commit-data prints
  // its row as it always did); for peers, it is what is shared and not
  // already the headline.
  const meta = parent
    ? null
    : [sharedTitle, sharedVenue]
        .filter((v): v is string => !!v && !sameLine(v, headline))
        .join(" · ") || null;

  const date = parent
    ? formatCommitDate(parent, locale)
    : sharedDate
      ? formatCommitDate(lead, locale)
      : squashDate(resolved, locale);

  const relationOf = (id: string) =>
    localizeOptional(squash.relations?.[id], locale) || null;

  const band = parent ? members.filter((m) => m.id !== parent.id) : members;

  return {
    mode: parent ? "parent" : "peers",
    headline,
    headlineSource,
    meta,
    date,
    languageBadge: languageShared ? badges[0] : null,
    type: typeShared ? members[0].type : lead.type,
    description:
      localizeOptional(squash.description, locale) ||
      (parent ? localize(parent.description, locale) : ""),
    quiet: members.every((m) => m.present === "aside"),
    shared: {
      title: !!sharedTitle,
      venue: !!sharedVenue,
      date: !!sharedDate,
      language: languageShared,
      type: typeShared,
    },
    members: band.map((m) => {
      const i = members.indexOf(m);
      const title = titles[i];
      const venue = venues[i];
      // What varies, and nothing the header said. A member with no venue
      // (a project among talks) simply has no venue to vary.
      const parts = [
        !sharedVenue ? venue : undefined,
        !sharedTitle ? title : undefined,
      ].filter((v): v is string => !!v);
      const label =
        parts.length === 2 && sameLine(parts[0], parts[1])
          ? parts[0]
          : parts.join(" · ") ||
            // Everything shared: two commits the header describes in full.
            // Say the title rather than print an empty caption.
            title;
      return {
        commit: m,
        hash: computeCommitHash(m.id),
        type: m.type,
        showType: !typeShared,
        label,
        date: sharedDate ? null : formatCommitDate(m, locale),
        languageBadge: languageShared ? null : badges[i],
        relation: relationOf(m.id),
        description: localize(m.description, locale),
        quiet: m.present === "aside",
      };
    }),
  };
}

/** The headline alone — for the attachment set's name. */
export function squashHeadline(
  resolved: ResolvedSquash,
  locale: Locale,
): string {
  return factorSquash(resolved, locale).headline;
}

/**
 * What is wrong with this squash, in one sentence, or null.
 *
 * Only the editor asks. The page never complains — it prints the most
 * truthful thing it can and moves on — so this is where "truthful but not
 * what you meant" becomes visible to the person who meant it.
 */
export function squashWarning(
  resolved: ResolvedSquash,
  locale: Locale,
): string | null {
  const facts = factorSquash(resolved, locale);
  if (facts.headlineSource === "fallback") {
    return locale === "zh"
      ? "这些条目在中文里没有共同的标题或场合，行首只能借用最新一条的标题。请写一个标题。"
      : "These share neither a title nor a venue in English, so the row is borrowing its newest member's title. Write a headline.";
  }
  return null;
}

/**
 * The date a group of peers prints: one month when every member shares it
 * (handled by the caller), and otherwise the span they cover — the
 * vocabulary a role row already uses for "this went on for a while".
 */
export function squashDate(resolved: ResolvedSquash, locale: Locale): string {
  const { members, lead } = resolved;
  const months = members.map((m) => m.date);
  const earliest = months.reduce((a, b) => (a < b ? a : b));
  const latest = months.reduce((a, b) => (a > b ? a : b));
  if (earliest === latest) return formatCommitDate(lead, locale);
  return formatDateRange(earliest, latest, locale);
}

/**
 * Every member's attachments, in authored order, deduplicated by url.
 *
 * One flat array because the attachment set is one — the theater and the
 * sheet page through the whole row — and safe to flatten because an
 * attachment is media WITH its origin (lib/log.ts). The band splits it back
 * by origin; the stage names each item after the commit it is of.
 *
 * Dedup by url because members genuinely do share artifacts — a conference
 * posts one recording covering both slots — and the same cover printed
 * twice reads as a bug. The first member to claim it keeps it.
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
