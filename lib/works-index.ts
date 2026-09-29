// =============================================================================
// Works index — the projects reading of /works, as data.
//
// The log (components/log) prints every commit at the same weight, in date
// order, and that is the right answer to "what happened, when?". It is the
// wrong one to "what has this person made?": nineteen talks sit between the
// projects, and the headline work is the twelfth row. This module is the
// other answer, read out of the same content/log.json:
//
//   projects   one entry per project, in the order the `works-projects`
//              and `works-projects-more` groups give — significance, not
//              date — each with what I did on it (`credit` · `team`), its
//              years, its one stat, and its description.
//   talks      every talk, newest first, as a /writing row: title, venue,
//              date, and whether it was given in the other language.
//   press      the same, for coverage.
//
// A project nobody has placed in either group still prints, at the end of
// the second, by date: a new project should not need a curation step to
// exist on the page.
//
// React-free, like lib/log-view.ts; the rows are components/works.
// =============================================================================

import type { Locale } from "./i18n";
import {
  computeCommitHash,
  formatCommitDate,
  formatDateRange,
  getCommitLanguageBadge,
  isCommitVisibleIn,
  localize,
  localizeOptional,
  resolveIdentity,
  sortCommitsByDate,
  type Commit,
  type LogData,
  type PressCommit,
  type ProjectCommit,
  type TalkCommit,
} from "./log";

/** The two curated groups (content/log.json `groups`), both `hidden` so the
 *  home screen does not grow a widget for them. */
export const WORKS_PROJECT_GROUPS = {
  lead: "works-projects",
  more: "works-projects-more",
} as const;

export interface ProjectEntry {
  commit: Commit;
  hash: string;
  name: string;
  /** What I did on it and where: `Founding engineer · React Core team @ Meta`. */
  credit?: string;
  /** `2021 – 2022`, `2023 – Present`, `2016`. */
  years: string;
  /** The one number worth printing: `★ 220k`, `1B+ users`. */
  stat?: string;
  description: string;
  /**
   * The letter a project with no icon wears in its place. The name's first
   * letter — except for a role standing in as a project, whose name is a
   * job title (`Award-winning Indie Flash Developer…`): there the first tag
   * names the craft (`Flash`), and the craft is the thing it made.
   */
  monogram: string;
}

export interface ListEntry {
  commit: Commit;
  hash: string;
  title: string;
  /** Where: a talk's conference, a press piece's platform. */
  venue: string;
  date: string;
  /** `EN` / `中文` when the piece is in the other language; else null. */
  language: "EN" | "中文" | null;
  /** A minor talk the log folds into one line (`present: "aside"`). */
  minor: boolean;
}

export interface WorksIndex {
  /** The work I am known for: printed whole. */
  lead: ProjectEntry[];
  /** Earlier and smaller: printed as a line each. */
  more: ProjectEntry[];
  talks: ListEntry[];
  press: ListEntry[];
}

const COMPACT = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const USERS: Record<Locale, string> = { en: "users", zh: "用户" };
const DOWNLOADS: Record<Locale, string> = { en: "downloads", zh: "下载" };

/**
 * One stat, the biggest claim first. Stars print as GitHub prints them
 * (`★ 220k`), so the number says where it was counted without a word for
 * it in either language.
 */
function statOf(commit: Commit, locale: Locale): string | undefined {
  if (commit.type !== "project") return undefined;
  const stats = (commit as ProjectCommit).stats;
  if (!stats) return undefined;
  if (stats.users) return `${stats.users} ${USERS[locale]}`;
  if (stats.stars) return `★ ${COMPACT.format(stats.stars).toLowerCase()}`;
  if (stats.downloads) return `${stats.downloads} ${DOWNLOADS[locale]}`;
  return undefined;
}

function projectEntry(
  commit: Commit,
  commits: Commit[],
  locale: Locale,
): ProjectEntry {
  // The team a project inherits from the role it was made under (Lynx
  // Framework is `Lynx @ ByteDance` without saying so) — the same fallback
  // the log's byline uses (components/log/bylines.ts).
  const team =
    commit.team ??
    (commit.type === "project"
      ? resolveIdentity(commit, commits)?.role?.team
      : undefined);
  const credit =
    [localizeOptional(commit.credit, locale), localizeOptional(team, locale)]
      .filter(Boolean)
      .join(" · ") || undefined;
  const name = localize(commit.title, locale);
  const markSource =
    (commit.type === "role" ? commit.tags?.[0] : undefined) ?? name;
  return {
    commit,
    hash: computeCommitHash(commit.id),
    name,
    monogram: Array.from(markSource.trim())[0]?.toUpperCase() ?? "·",
    credit,
    years: commit.endDate
      ? formatDateRange(commit.date, commit.endDate, locale)
      : String(new Date(commit.date).getFullYear()),
    stat: statOf(commit, locale),
    description: localize(commit.description, locale),
  };
}

function listEntry(
  commit: TalkCommit | PressCommit,
  locale: Locale,
): ListEntry {
  return {
    commit,
    hash: computeCommitHash(commit.id),
    title: localize(commit.title, locale),
    venue: commit.type === "talk" ? commit.conference.name : commit.platform,
    date: formatCommitDate(commit, locale),
    language: getCommitLanguageBadge(commit, locale),
    minor: commit.present === "aside",
  };
}

export function buildWorksIndex(log: LogData, locale: Locale): WorksIndex {
  const visible = log.commits.filter((c) => isCommitVisibleIn(c, locale));
  const byId = new Map(visible.map((c) => [c.id, c]));
  const idsOf = (groupId: string) =>
    log.groups?.find((g) => g.id === groupId)?.commitIds ?? [];

  const placed = new Set<string>();
  const pick = (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const c = byId.get(id);
      if (!c || placed.has(id)) return [];
      placed.add(id);
      return [c];
    });

  const lead = pick(idsOf(WORKS_PROJECT_GROUPS.lead));
  const more = [
    ...pick(idsOf(WORKS_PROJECT_GROUPS.more)),
    ...sortCommitsByDate(
      visible.filter((c) => c.type === "project" && !placed.has(c.id)),
    ),
  ];

  const talks = sortCommitsByDate(
    visible.filter((c): c is TalkCommit => c.type === "talk"),
  );
  const press = sortCommitsByDate(
    visible.filter((c): c is PressCommit => c.type === "press"),
  );

  return {
    lead: lead.map((c) => projectEntry(c, log.commits, locale)),
    more: more.map((c) => projectEntry(c, log.commits, locale)),
    talks: talks.map((c) => listEntry(c, locale)),
    press: press.map((c) => listEntry(c, locale)),
  };
}
