"use client";

/**
 * Places as the log's branches — /works, at every depth (see
 * lib/log-places.ts for what goes where, and lib/log-view.ts for the depths
 * and the URL).
 *
 *        ○ ByteDance                              2023 – Present  ← the branch:
 *        │ Architect                                                 a quiet
 *        │                                                           header
 *        │ [▣] Lynx Framework                     2023 – Present  ← its work,
 *        │     1B+ users                                             a CV's
 *        │     Open-source cross-platform UI framework …             rows
 *        │     lynxjs.org  github.com
 *        · Talks 12  WeAreDevelopers, GOSIM, …        unfold ⌄    ← the rest,
 *                                                                    folded
 *        · Sabbatical in China                           Nov 2022 ← `main`,
 *        · Talks 1 · Press 3  COSCON, Gitee, …        unfold ⌄       between
 *        ○ Meta                                     2018 – 2022      branches
 *
 * The rail down the left is the log's tenure rail, the same line its rows
 * draw through their icons, hung in the same margin (`GUTTER_PULL`). At the
 * summary it links a place's header to the work under it; unfold the branch
 * and the same line runs on through the commits it was summarising, whose
 * hashes and icons appear on it — the page going one step deeper into the
 * same objects, in place, rather than turning into another page. `main` has
 * no tenure and so no line: its commits are dots between the brackets, as
 * the log has always drawn a commit that belongs to no one.
 *
 * Hierarchy at the summary is carried by the logos and by type — the
 * project, not the company, is what a row is about — with no box, no rule
 * and no indent beyond the log's own gutter.
 *
 * Every mark that stands for more than it prints opens what it stands for,
 * through the system that already owns it: the place name is the identity
 * card (systems/identity), the same one a `<handle>` opens on a row; a link
 * opens its attachment (systems/attachments) — the theater, the in-app
 * browser, the sheet on a phone — exactly as its cover would.
 */

import { useMemo, type MouseEvent, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/lib/typography";
import { t, type Locale } from "@/lib/i18n";
import {
  computeCommitHash,
  FILTERABLE_COMMIT_TYPES,
  formatCommitDate,
  getCommitTypePluralLabel,
  isImageMedia,
  isLinkMedia,
  isRowVisible,
  isSlidesMedia,
  isVideoMedia,
  localize,
  VIDEO_PLATFORM_LABEL,
  type Commit,
  type FilterableCommitType,
  type Identity,
  type Media,
  type ProjectCommit,
} from "@/lib/log";
import { formAtDepth, type LogDepth } from "@/lib/log-view";
import {
  MAIN,
  summarize,
  type Branch,
  type Lane,
  type MainRun,
} from "@/lib/log-places";
import { IdentityHover } from "@/systems/identity";
import {
  attachmentSetFor,
  isInternalLink,
  linkTarget,
  useOptionalAttachments,
} from "@/systems/attachments";
import { CommitRows, type RailBracket } from "./log-timeline";
import { ProjectIcon } from "./project-icon";
import { GUTTER_PULL, HASH_CELL, RAIL_LINE } from "./timeline-commit";

// =============================================================================
// Recipes
// =============================================================================

/** A project's name: the one title on the page that leads a CV's row. */
const WORK_TITLE = "text-[0.9375rem] sm:text-base font-medium leading-6 text-foreground";

/** A description printed whole, at the rung a reader reads at. */
const PROSE = "text-sm text-muted-foreground leading-relaxed";

/** A quiet inline link — /prompt's LinkRow recipe, so the two pages link
 *  out in the same voice. */
const QUIET_LINK =
  "font-mono text-xs text-muted-foreground underline underline-offset-2 decoration-ink-line transition-colors hover:text-foreground hover:decoration-foreground";

/** The rows a lane prints some other way — a branch's roles, which its
 *  header speaks for — and, at the summary, everything on `main` but its
 *  life events, which are the one thing there the log already prints as a
 *  quiet line. Module-level, so the rows' memo holds across renders. */
const OMIT_ROLES = (c: Commit) => c.type === "role";
const OMIT_ALL_BUT_EVENTS = (c: Commit) => c.type !== "event";

// =============================================================================
// The gutter
// =============================================================================

/**
 * A row in the log's own geometry — the hash column, the rail, then the
 * content (TimelineCommit's grid, pulled into the margin by the same
 * `GUTTER_PULL`) — for the rows /works prints around the log's: a branch's
 * header, a project at the summary, a fold line. The hash cell holds its
 * width and prints nothing: these rows have no hash of their own to show,
 * and the column is what keeps them on the log's rail, and their text on the
 * log's text edge, at every width.
 */
function GutterRow({
  id,
  up = false,
  down = false,
  node,
  gap = 0,
  cell = "h-5",
  className,
  children,
  ...data
}: {
  /** The commit hash this row stands for — its permalink target. */
  id?: string;
  /** The rail runs on above / below this row. */
  up?: boolean;
  down?: boolean;
  /** What sits on the rail at the first line: a ring, a dot, nothing. */
  node?: ReactNode;
  /** How far short of the node's centre the line stops. */
  gap?: number;
  /** The rail cell's height — the first line's, so the node centres on it. */
  cell?: string;
  className?: string;
  children: ReactNode;
  [data: `data-${string}`]: string | undefined;
}) {
  return (
    <div id={id} data-rail-row={id ? "" : undefined} {...data}>
      <div
        data-row-trigger
        className={cn(
          "@container relative -mx-3 px-3 rounded-lg [clip-path:inset(0_-100vw)]",
          GUTTER_PULL,
          className,
        )}
      >
        <div className="grid grid-cols-[auto_1fr] @sm:grid-cols-[auto_auto_1fr] gap-x-2 items-start">
          <span
            aria-hidden
            className={cn(
              "hidden @sm:inline-block select-none leading-5",
              HASH_CELL,
              TYPE.hash,
              "text-transparent",
            )}
          >
            0000000
          </span>
          <span aria-hidden className={cn("relative inline-flex w-5 items-center justify-center", cell)}>
            {up && (
              <span
                data-rail-above
                className={RAIL_LINE}
                style={{ top: "-1000px", bottom: node ? `calc(50% + ${gap}px)` : "50%" }}
              />
            )}
            {down && (
              <span
                data-rail-below
                className={RAIL_LINE}
                style={{ top: node ? `calc(50% + ${gap}px)` : "50%", bottom: "-1000px" }}
              />
            )}
            {node}
          </span>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** The rail's quiet node: the dot the log gives a row in the quiet voice. */
const DOT = (
  <span className="block h-[3px] w-[3px] rounded-full bg-muted-foreground/30" />
);

// =============================================================================
// Derivations (display only — what goes where is lib/log-places)
// =============================================================================

/** Whether two labels would print as the same thing. */
function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * A project's team, as a line under a place that already names the company:
 * `React Core team @ Meta` under Meta is `React Core team`, and a team that
 * *is* the company (`Alibaba` under Alibaba) says nothing at all.
 */
function teamUnder(project: ProjectCommit, company: string, locale: Locale) {
  if (!project.team) return undefined;
  const team = localize(project.team, locale).replace(/\s*@\s*[^@]+$/, "");
  return !team || same(team, company) ? undefined : team;
}

/** `220k stars`, `1B+ users` — adoption, in the row's own meta voice. */
function statsOf(project: ProjectCommit, locale: Locale): string[] {
  const s = project.stats;
  if (!s) return [];
  const compact = (n: number) =>
    new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 })
      .format(n)
      .toLowerCase();
  const out: string[] = [];
  if (s.users) out.push(`${s.users} ${t(locale, "worksUsers")}`);
  if (s.stars) out.push(`${compact(s.stars)} ${t(locale, "worksStars")}`);
  if (s.downloads) out.push(s.downloads);
  return out;
}

/** The part of a URL that names where it lives: `react.dev`, `github.com`. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * What an attachment is called in a line of links: where it lives, since
 * that is what a reader decides a click on — `github.com`, `react.dev`,
 * `/writing/see-u-ali` for a post on this site (a path, the way SystemNav
 * names a place here). Two links to the same host take their first path
 * segment so they are not the same word twice (`react.dev/blog`,
 * `react.dev/learn`). Things that play or zoom are called what they are.
 */
function linkLabels(items: Media[], locale: Locale): string[] {
  const base = items.map((m): { host: string; path?: string } => {
    if (isVideoMedia(m)) return { host: VIDEO_PLATFORM_LABEL[m.platform] };
    if (isSlidesMedia(m)) return { host: t(locale, "worksSlides") };
    if (isImageMedia(m)) return { host: t(locale, "worksImage") };
    if (isLinkMedia(m) && isInternalLink(m)) {
      const slug = m.internal?.slug;
      if (slug) return { host: `/writing/${slug}` };
      // `/writing/foo/zh` → `/writing/foo`: the locale is not the place.
      return { host: m.url.replace(/\/(en|zh)$/, "") };
    }
    const url = linkTarget(m, locale);
    let path: string | undefined;
    try {
      path = new URL(url).pathname.split("/").filter(Boolean)[0];
    } catch {}
    return { host: hostOf(url), path };
  });
  return base.map(({ host, path }) => {
    const twice = base.filter((b) => b.host === host).length > 1;
    return twice && path ? `${host}/${path}` : host;
  });
}

/** Where a folded commit happened: the conference, the publication — or,
 *  for a type with neither, what it was called. */
function venueOf(c: Commit, locale: Locale): string {
  if (c.type === "talk") return c.conference.name;
  if (c.type === "press") return c.platform;
  return localize(c.title, locale);
}

// =============================================================================
// Opening an attachment
// =============================================================================

/**
 * The click a link makes: through the attachment door when one is mounted
 * (the theater, the in-app browser, the sheet on a phone), the plain href
 * otherwise. Modified clicks are the browser's.
 */
function useOpenAttachment(locale: Locale) {
  const attachments = useOptionalAttachments();
  return (commit: Commit, index: number) =>
    (e: MouseEvent<HTMLAnchorElement>) => {
      if (!attachments) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const set = attachmentSetFor(commit, locale);
      if (!set) return;
      e.preventDefault();
      attachments.open(set, index);
    };
}

/**
 * The anchor an attachment is before the click above takes it over: a real
 * href, so it still goes somewhere without a provider, on a modified click
 * or in a new tab — and a new tab only for somewhere that isn't this site.
 */
function anchorFor(media: Media, locale: Locale) {
  const href = linkTarget(media, locale);
  return isLinkMedia(media) && isInternalLink(media)
    ? { href }
    : { href, target: "_blank", rel: "noopener noreferrer" };
}

// =============================================================================
// Pieces
// =============================================================================

function LinkLine({
  commit,
  locale,
  className,
}: {
  commit: Commit;
  locale: Locale;
  className?: string;
}) {
  const open = useOpenAttachment(locale);
  const items = commit.media ?? [];
  if (items.length === 0) return null;
  const labels = linkLabels(items, locale);
  return (
    <p className={cn("flex flex-wrap gap-x-3 gap-y-1", className)}>
      {items.map((m, i) => (
        <a
          key={`${m.url}-${i}`}
          {...anchorFor(m, locale)}
          onClick={open(commit, i)}
          className={cn("pressable", QUIET_LINK)}
        >
          {labels[i]}
        </a>
      ))}
    </p>
  );
}

/**
 * A branch's header — the place, the role, the dates — quiet, because what
 * the page is about is the work under it. The ring on the rail is where the
 * branch starts: the same ring a role row wears on the log, since this
 * header *is* the branch's roles (their permalinks land here).
 */
function BranchHead({
  branch,
  locale,
  down,
  describe,
}: {
  branch: Branch;
  locale: Locale;
  down: boolean;
  /** Print the place's own prose: there is no work to speak for it. */
  describe: boolean;
}) {
  const lead = branch.roles[0];
  const company = localize(lead.company, locale);
  // An education entry hides its dates on purpose (`hideDate`: it overlaps
  // the work around it) and prints where it was instead, as on the log.
  const when = (r: typeof lead) =>
    r.hideDate ? (r.location ?? "") : formatCommitDate(r, locale);
  const several = branch.roles.length > 1;
  const description = localize(lead.description, locale).trim();

  return (
    <GutterRow
      id={computeCommitHash(lead.id)}
      data-branch-head=""
      down={down}
      gap={10}
      cell="h-6"
      className="pt-1 pb-2"
      node={
        <span
          data-branch-ring
          className="block h-5 w-5 rounded-full ring-1 ring-inset ring-muted-foreground/25 transition-[box-shadow] duration-200"
        />
      }
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="min-w-0 text-base leading-6 font-medium text-foreground">
          {/* The name is the identity: rest on it (or tap it) and the card
              a row's `<handle>` opens arrives — every role, the tenure, and
              what was signed there. */}
          <IdentityHover identityId={branch.id} roleId={lead.id}>
            {company}
          </IdentityHover>
        </h2>
        {/* One role says its dates here; several say their own, each on
            its line, and the name has nothing to add to them. */}
        {!several && (
          <span className={cn("shrink-0", TYPE.rowMeta)}>{when(lead)}</span>
        )}
      </div>
      <ul className="mt-0.5">
        {branch.roles.map((r, i) => (
          <li
            key={r.id}
            // Every role's permalink lands on its own line of the header —
            // the lead's on the header itself. A `hideRow` role never had a
            // row to land on; now it has this.
            id={i === 0 ? undefined : computeCommitHash(r.id)}
            data-rail-row={i === 0 ? undefined : ""}
            className="flex items-baseline justify-between gap-4 font-mono text-xs"
          >
            <span data-row-trigger className="min-w-0 rounded text-muted-foreground">
              {localize(r.title, locale)}
            </span>
            {several && (
              <span className="shrink-0 text-tertiary-foreground">{when(r)}</span>
            )}
          </li>
        ))}
      </ul>
      {describe && description && (
        <>
          <p className={cn("mt-2", PROSE)}>{description}</p>
          <LinkLine commit={lead} locale={locale} className="mt-2" />
        </>
      )}
    </GutterRow>
  );
}

/**
 * A project at the summary: its logo, its name, what it is and where to see
 * it — the row a CV gives the thing, and the same commit its log row is one
 * depth down (its permalink lands here while the branch is folded).
 */
function ProjectRow({
  project,
  company,
  locale,
  up,
  down,
}: {
  project: ProjectCommit;
  company: string;
  locale: Locale;
  up: boolean;
  down: boolean;
}) {
  const meta = [teamUnder(project, company, locale), ...statsOf(project, locale)]
    .filter(Boolean)
    .join(" · ");
  return (
    <GutterRow id={computeCommitHash(project.id)} up={up} down={down} className="py-3">
      <article className="flex items-start gap-3 sm:gap-3.5">
        <ProjectIcon commit={project} locale={locale} className="size-8 sm:size-10" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className={WORK_TITLE}>{localize(project.title, locale)}</h3>
            <span className={cn("shrink-0", TYPE.rowMeta)}>
              {formatCommitDate(project, locale)}
            </span>
          </div>
          {meta && <p className={cn("mt-0.5", TYPE.rowMeta)}>{meta}</p>}
          <p className={cn("mt-1.5", PROSE)}>{localize(project.description, locale)}</p>
          <LinkLine commit={project} locale={locale} className="mt-2" />
        </div>
      </article>
    </GutterRow>
  );
}

/**
 * What the summary folds, as one line: how much of each type, and where it
 * was given — most of what a list of twelve talks tells a newcomer. It is
 * the lane's way one step deeper: pressed, the lane unfolds into its
 * commits, in place, and the line stays at their foot to fold them back.
 */
function FoldLine({
  folded,
  open,
  onToggle,
  up,
  locale,
  controls,
}: {
  folded: Commit[];
  open: boolean;
  onToggle: () => void;
  up: boolean;
  locale: Locale;
  controls: string;
}) {
  // In the chips' order, so the line and the bar list types the same way.
  const counts = FILTERABLE_COMMIT_TYPES.flatMap((type) => {
    const n = folded.filter((c) => c.type === type).length;
    return n > 0 ? [[type, n] as const] : [];
  });
  const venues = [...new Set(folded.map((c) => venueOf(c, locale)))].join(", ");

  return (
    <GutterRow up={up} node={DOT} gap={3} className="py-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={controls}
        className="pressable group flex w-full min-w-0 items-baseline gap-2 text-left font-mono text-xs"
      >
        {counts.map(([type, n]) => (
          <span key={type} className="shrink-0">
            <span className="text-muted-foreground">
              {getCommitTypePluralLabel(type, locale)}
            </span>{" "}
            <span className="tabular-nums text-tertiary-foreground">{n}</span>
          </span>
        ))}
        {/* Folded, the line says where; open, the rows above it do. */}
        <span className="min-w-0 flex-1 truncate font-sans text-tertiary-foreground">
          {open ? "" : venues}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-tertiary-foreground transition-colors group-hover:text-foreground">
          {t(locale, open ? "worksFold" : "worksUnfold")}
          <ChevronDown
            aria-hidden
            className={cn("h-3 w-3 transition-transform duration-200", open && "rotate-180")}
          />
        </span>
      </button>
    </GutterRow>
  );
}

// =============================================================================
// Lanes
// =============================================================================

interface LaneProps {
  locale: Locale;
  identities?: Record<string, Identity>;
  depth: LogDepth;
  types: FilterableCommitType[];
  /** Unfolded into its commits: by the depth, the filter, the reader, or a
   *  permalink to a commit the summary folds. */
  deep: boolean;
  /** The summary is on screen or one press away: the fold line is. */
  foldable: boolean;
  onToggle: () => void;
  onSelectHash: (hash: string) => void;
}

/**
 * Whether a lane prints anything under a filter — the same question each
 * lane asks itself before rendering, so the page's empty state, the pinned
 * bar's markers and the lanes can never disagree. A branch whose header the
 * filter asks for (`role`: the headers are the roles) prints for that alone.
 */
export function laneShows(lane: Lane, types: FilterableCommitType[]): boolean {
  if (lane.kind === "branch" && (types.length === 0 || types.includes("role"))) {
    return true;
  }
  return lane.commits.some((c) => !OMIT_ROLES(c) && isRowVisible(c, types));
}

/** Of what the summary folds, what the filter lets through. */
function foldedFor(folded: Commit[], types: FilterableCommitType[]) {
  return folded.filter((c) => isRowVisible(c, types));
}

function BranchLane({
  branch,
  locale,
  identities,
  depth,
  types,
  deep,
  foldable,
  onToggle,
  onSelectHash,
}: LaneProps & { branch: Branch }) {
  const summary = summarize(branch);
  const projects = summary.projects.filter((c) => isRowVisible(c, types));
  const folded = foldedFor(summary.folded, types);
  const rowsId = `${branch.id}-commits`;
  const company = localize(branch.roles[0].company, locale);
  const foot = foldable && folded.length > 0;
  const hasRows = branch.commits.some((c) => !OMIT_ROLES(c) && isRowVisible(c, types));
  const asksForRoles = types.includes("role");

  const bracket = useMemo<RailBracket>(
    () => ({ segmentId: branch.id, openTop: true, openBottom: foot }),
    [branch.id, foot],
  );

  const below = deep ? hasRows || foot : projects.length > 0 || foot;

  return (
    <section
      aria-label={company}
      data-branch=""
      className="pt-5"
    >
      <BranchHead
        branch={branch}
        locale={locale}
        down={below}
        describe={asksForRoles || summary.projects.length === 0}
      />
      <div id={rowsId}>
        {deep ? (
          hasRows && (
            <CommitRows
              commits={branch.commits}
              locale={locale}
              identities={identities}
              form={formAtDepth(depth)}
              activeTypes={types}
              omit={OMIT_ROLES}
              bracket={bracket}
              onSelectHash={onSelectHash}
            />
          )
        ) : (
          projects.map((p, i) => (
            <ProjectRow
              key={p.id}
              project={p}
              company={company}
              locale={locale}
              up
              down={i < projects.length - 1 || foot}
            />
          ))
        )}
      </div>
      {foot && (
        <FoldLine
          folded={folded}
          open={deep}
          onToggle={onToggle}
          up
          locale={locale}
          controls={rowsId}
        />
      )}
    </section>
  );
}

function MainLane({
  run,
  locale,
  identities,
  depth,
  types,
  deep,
  foldable,
  onToggle,
  onSelectHash,
}: LaneProps & { run: MainRun }) {
  const summary = summarize(run);
  const projects = summary.projects.filter((c) => isRowVisible(c, types));
  const folded = foldedFor(summary.folded, types);
  const rowsId = `${run.id}-commits`;
  const foot = foldable && folded.length > 0;

  return (
    <div className="pt-4">
      <div id={rowsId}>
        {deep ? (
          <CommitRows
            commits={run.commits}
            locale={locale}
            identities={identities}
            form={formAtDepth(depth)}
            activeTypes={types}
            onSelectHash={onSelectHash}
          />
        ) : (
          <>
            {/* The life events are already the quiet lines they need to be
                on the log — the same rows, at any depth. */}
            <CommitRows
              commits={run.commits}
              locale={locale}
              identities={identities}
              form={formAtDepth(depth)}
              activeTypes={types}
              omit={OMIT_ALL_BUT_EVENTS}
              onSelectHash={onSelectHash}
            />
            {projects.map((p) => (
              <ProjectRow key={p.id} project={p} company="" locale={locale} up={false} down={false} />
            ))}
          </>
        )}
      </div>
      {foot && (
        <FoldLine
          folded={folded}
          open={deep}
          onToggle={onToggle}
          up={false}
          locale={locale}
          controls={rowsId}
        />
      )}
    </div>
  );
}

// =============================================================================
// The page
// =============================================================================

export interface LaneChapter {
  id: string;
  /** What the pinned bar's ref slot says while this lane is under it. */
  label: string;
  main: boolean;
}

export function laneChapters(lanes: Lane[]): LaneChapter[] {
  return lanes.map((lane) => ({
    id: lane.id,
    label: lane.kind === "branch" ? lane.id : MAIN,
    main: lane.kind === "main",
  }));
}

export function Branches({
  lanes,
  isDeep,
  foldable,
  onToggle,
  ...rest
}: Omit<LaneProps, "deep" | "onToggle" | "foldable"> & {
  lanes: Lane[];
  isDeep: (lane: Lane) => boolean;
  foldable: boolean;
  onToggle: (lane: Lane) => void;
}) {
  return (
    // The column says its language: `TYPE.aside`'s italic is Latin-only.
    <div lang={rest.locale}>
      {lanes.filter((lane) => laneShows(lane, rest.types)).map((lane) => (
        <div key={lane.id}>
          {/* Where the pinned bar's ref slot hands over to this lane: its
              top edge, so the slot says `bytedance` from the moment the
              branch's header passes under it, and `main` again after. */}
          <div aria-hidden data-chapter={lane.id} />
          {lane.kind === "branch" ? (
            <BranchLane
              branch={lane}
              deep={isDeep(lane)}
              foldable={foldable}
              onToggle={() => onToggle(lane)}
              {...rest}
            />
          ) : (
            <MainLane
              run={lane}
              deep={isDeep(lane)}
              foldable={foldable}
              onToggle={() => onToggle(lane)}
              {...rest}
            />
          )}
        </div>
      ))}
    </div>
  );
}
