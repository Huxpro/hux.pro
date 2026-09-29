// =============================================================================
// Works index — /works as data: the log, organised by what it made.
//
// The log (components/log) is every commit in date order, and that is the
// right answer to "what happened, when?". It is the wrong one to "what has
// this person made?": nineteen talks sit between the projects, and the
// headline work is the twelfth row. /works answers the second question
// first, from the same commits — not a second list of them:
//
//   projects   one entry per project, in the order the `works-projects`
//              and `works-projects-more` groups give — significance, not
//              date — each with what I did on it (`credit` · `team`), its
//              years, its one stat, and its description. And its
//              *history*: the log rows that belong to it, itself included,
//              which is what the row opens into.
//   sections   the rows that belong to no project — the other talks, the
//              press, and the career around the work (the roles that print,
//              the life events) — each in date order.
//
// Every commit on the page lives in exactly one of those (`home`), which is
// what lets a `#hash` permalink open whatever encloses its row.
//
// A project nobody has placed in either group still prints, at the end of
// the second, by date: a new project should not need a curation step to
// exist on the page.
//
// ## Which rows belong to a project
//
// A project's history is the rows that are *about* it, and the data says
// so in one of two ways. In order:
//
//  1. `attachedTo` — the commit says where it belongs. Pointing at a project
//     (React Conf 2021's "React without memo" → React Compiler) puts it
//     there. Pointing anywhere else (a role, an event), or explicitly at
//     nothing (`null`), keeps it out of every project: it has said what it
//     belongs to, and it was not one of these.
//  2. Its name — one of the commit's `tags` is a word of the project's
//     (English) title, *and* the two are in the same era (`tagId`). A talk
//     tagged `Lynx` in the Lynx era is a Lynx talk; the three `PWA` talks
//     of the PWA era are Ele.me PWA's story. The era is what keeps the rule
//     honest: "React for Two Threads" (Lynx era, tagged `React`) is not
//     React Compiler's.
//
// Nothing else — not shared topics (`Cross-Platform`), not the identity a
// row was given under: the Lynx era's two "frontend is dead" talks were
// given at ByteDance and are about something else, so they stay in the
// talks list. That is deliberately narrow; `attachedTo` is how to widen it
// for one row, and `attachedTo: null` how to keep one out.
//
// React-free, like lib/log-view.ts; the page is components/works.
// =============================================================================

import type { Locale } from "./i18n";
import {
  computeCommitHash,
  formatDateRange,
  isCommitVisibleIn,
  localize,
  localizeOptional,
  resolveIdentity,
  sortCommitsByDate,
  type Commit,
  type CommitType,
  type LogData,
  type ProjectCommit,
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
  /** The log rows it opens into, newest first — its own among them, where
   *  its date puts it: usually last, the way a repository's first commit
   *  is; under the PWA talks that led up to it, for Ele.me PWA. */
  history: Commit[];
}

/** The rows no project claims, by what they are. */
export type SectionId = "talks" | "posts" | "press" | "along";

export interface WorksSection {
  id: SectionId;
  /** The type whose name heads it; `along` (roles and events) has none. */
  type?: CommitType;
  rows: Commit[];
  /** Some rows of this type live under projects, so this is the rest:
   *  "Other talks", not "Talks". */
  partial: boolean;
}

export interface WorksIndex {
  /** The work I am known for: printed whole. */
  lead: ProjectEntry[];
  /** Earlier and smaller: printed as a line each. */
  more: ProjectEntry[];
  sections: WorksSection[];
  /**
   * Every commit this locale shows — what identities resolve against. A
   * project's history holds its talks but not the `hideRow` roles whose
   * tenure says who gave them (see `computeRail`).
   */
  context: Commit[];
  /** Commit id → the id of what encloses it: a project's commit id, or a
   *  section's. */
  home: Map<string, string>;
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
  history: Commit[],
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
    history,
  };
}

/** The words a project is called by — its English title, split — so the
 *  rule reads the same in either locale. */
function nameWords(project: Commit): Set<string> {
  return new Set(
    localize(project.title, "en")
      .toLowerCase()
      .split(/[\s()/:]+/)
      .filter(Boolean),
  );
}

/**
 * The project a commit belongs to, if any — the rule in the header, in
 * code. `projects` in significance order, so a row that could name two
 * goes to the one the page leads with.
 */
function projectOf(commit: Commit, projects: Commit[]): Commit | undefined {
  if (commit.type === "project" || commit.type === "role") return undefined;
  if (commit.attachedTo === null) return undefined;
  if (typeof commit.attachedTo === "string") {
    return projects.find((p) => p.id === commit.attachedTo);
  }
  const tags = (commit.tags ?? []).map((t) => t.toLowerCase());
  if (tags.length === 0) return undefined;
  return projects.find((p) => {
    if (p.tagId !== commit.tagId) return false;
    const words = nameWords(p);
    return tags.some((t) => words.has(t));
  });
}

const SECTION_TYPES: { id: SectionId; types: CommitType[] }[] = [
  { id: "talks", types: ["talk"] },
  { id: "posts", types: ["post"] },
  { id: "press", types: ["press"] },
  // The career around the work: the degrees, the roles that print a row,
  // the moves between them.
  { id: "along", types: ["role", "event"] },
];

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
  const projects = [...lead, ...more];

  // Every commit goes to exactly one home.
  const home = new Map<string, string>();
  const members = new Map<string, Commit[]>(
    projects.map((p) => [p.id, [p]]),
  );
  for (const p of projects) home.set(p.id, p.id);
  const loose: Commit[] = [];
  for (const c of visible) {
    if (home.has(c.id)) continue;
    const project = projectOf(c, projects);
    if (project) {
      members.get(project.id)!.push(c);
      home.set(c.id, project.id);
    } else {
      loose.push(c);
    }
  }

  const sections = SECTION_TYPES.flatMap(({ id, types }) => {
    const rows = sortCommitsByDate(loose.filter((c) => types.includes(c.type)));
    if (rows.length === 0) return [];
    for (const c of rows) home.set(c.id, id);
    const partial = visible.some(
      (c) => types.includes(c.type) && home.get(c.id) !== id,
    );
    return [{ id, type: id === "along" ? undefined : types[0], rows, partial }];
  });

  const entry = (c: Commit) =>
    projectEntry(c, sortCommitsByDate(members.get(c.id)!), log.commits, locale);

  return {
    lead: lead.map(entry),
    more: more.map(entry),
    sections,
    context: sortCommitsByDate(visible),
    home,
  };
}
