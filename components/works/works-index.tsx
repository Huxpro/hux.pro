"use client";

import type { MouseEvent, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { CommitIcon } from "@/components/log/icons";
import { CommitRows } from "@/components/log/log-timeline";
import { t, type Locale } from "@/lib/i18n";
import {
  getCommitTypePluralLabel,
  isRowVisible,
  type Commit,
  type CommitType,
  type FilterableCommitType,
  type Identity,
  type Media,
} from "@/lib/log";
import type { LogForm } from "@/lib/log-view";
import { getHostname } from "@/lib/og-core";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import type {
  ProjectEntry,
  WorksIndex,
  WorksSection,
} from "@/lib/works-index";
import { useOptionalAttachments } from "@/systems/attachments";
import { attachmentSetFor } from "@/systems/attachments/lib/set";
import { ProjectIcon } from "./project-icon";

// =============================================================================
// /works — the projects as a resume, and the log inside them.
//
//   [icon]  Lynx Framework ›  1B+ users  ◔ 10             2023 – Present
//           Architect · Lynx @ ByteDance            lynxjs.org  github.com
//           Open-source cross-platform UI framework behind TikTok, …
//
// A project is the page's unit, and at rest it reads the way a resume entry
// reads: the thing, the part I played in it, when, and where to see it. The
// icon makes it a thing rather than a line of text — the app it would be on
// this OS's home screen — and it is what the eye finds first, so it goes
// first.
//
// And like an app, it opens. Pressing the name (or the icon) opens the row
// in place into its history: the log's own rows for it — its talks, its
// press, and its own commit with its covers — each with its hash and its
// rail, drawn by the one component that draws the log (`CommitRows`). The
// marks after the name (`◔ 10`) say what is inside before you open it.
// Opened, the entry keeps its name, its part and its links as the header
// the history hangs from; its description moves down into its own row,
// where the covers are.
//
// Under the projects, the rows no project claims — the other talks, the
// press, the career around the work — are the same log rows at the index's
// depth: a line each, their hash and date, openable one by one. A form or a
// filter that goes deeper takes them with it (lib/log-view.ts).
//
// Borderless, like every list here (docs/design-philosophy.md): no card
// and no box. The hierarchy is the icon, the weight and the ink: the name
// is the one medium-weight line, what I did is the second rung, the
// description the third, and the machine's metadata (years, stat, links)
// sits in mono on the rung that annotates.
//
// Two tiers of project, curated in content/log.json (`works-projects` and
// `works-projects-more`, lib/works-index.ts). The first is printed whole.
// The second — earlier and smaller — is a line each at a smaller icon, so a
// reader can tell at a glance which is which without being told. The index
// form prints both as lines.
//
// Every link opens through the attachments (systems/attachments), as a
// /works cover or an About badge does: the drawer on a phone, its native
// home on a desk. Each keeps a real href for a modified click.
// =============================================================================

/** Where a media item lives, for the browser itself: a ⌘-click, a crawler. */
function hrefOf(media: Media, locale: Locale): string {
  if (media.kind === "link") {
    return media.internal?.urls[locale] ?? media.urls?.[locale] ?? media.url;
  }
  return media.url;
}

/**
 * A link's name in the row: its site, as a person would say it — or, for
 * one of my own posts, the post's title, since `/writing` three times over
 * would name nothing.
 */
function linkLabel(media: Media, locale: Locale): string {
  switch (media.kind) {
    case "video":
      return t(locale, "logRecording");
    case "slides":
      return t(locale, "logSlides");
    case "image":
      return t(locale, "worksLinkImage");
    default: {
      if (media.kind === "link" && media.url.startsWith("/")) {
        const preview = media.previews?.[locale] ?? media.preview;
        return preview?.title ?? media.url;
      }
      return getHostname(media.url) ?? media.url;
    }
  }
}

/**
 * A press on one of a commit's attachments: the attachments' own policy
 * decides where it goes. A modified click is the browser's.
 */
function useOpen(commit: Commit, locale: Locale) {
  const attachments = useOptionalAttachments();
  return (index: number) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    const set = attachmentSetFor(commit, locale);
    if (!set || !attachments) return;
    e.preventDefault();
    attachments.open(set, index);
  };
}

function external(href: string) {
  return /^https?:/.test(href)
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};
}

/** What the page hands every container: how deep, what is in it, and
 *  where the rows resolve who made them. */
interface Depth {
  locale: Locale;
  form: LogForm;
  types: FilterableCommitType[];
  context: Commit[];
  identities?: Record<string, Identity>;
  onSelectHash: (hash: string) => void;
}

// =============================================================================
// Projects
// =============================================================================

/**
 * What a project holds besides itself, by type, in the chips' order —
 * `◔ 10` for Lynx's talks. Counted unfiltered: it says what opening the row
 * will show, not what the filter left.
 */
function contentsOf(entry: ProjectEntry) {
  const counts = new Map<CommitType, number>();
  for (const c of entry.history) {
    if (c === entry.commit || !isRowVisible(c)) continue;
    counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
  }
  return [...counts];
}

function ProjectRow({
  entry,
  lead,
  open,
  onToggle,
  depth,
}: {
  entry: ProjectEntry;
  /** A first-tier row: the full entry. Otherwise a line. */
  lead: boolean;
  open: boolean;
  onToggle: () => void;
  depth: Depth;
}) {
  const { commit } = entry;
  const { locale } = depth;
  const media = commit.media ?? [];
  const openLink = useOpen(commit, locale);
  const links = linksOf(media, locale);
  const contents = contentsOf(entry);
  const historyId = `${entry.hash}-history`;
  const split = entry.name.lastIndexOf(" ") + 1;
  const nameHead = entry.name.slice(0, split);
  const nameTail = entry.name.slice(split);

  const icon = (
    <ProjectIcon
      commit={commit}
      monogram={entry.monogram}
      locale={locale}
      className={lead ? "size-10 sm:size-11" : "size-8"}
    />
  );

  const contentsLine = contents.length > 0 && (
    <span className="inline-flex items-baseline gap-2">
      {contents.map(([type, count]) => (
        <span
          key={type}
          title={`${count} ${getCommitTypePluralLabel(type, locale)}`}
          className={cn(TYPE.rowMeta, "inline-flex items-center gap-1 tabular-nums")}
        >
          <CommitIcon type={type} className="size-3 shrink-0 self-center" />
          {count}
        </span>
      ))}
    </span>
  );

  return (
    <li
      data-works-container={commit.id}
      className={cn(lead ? "py-3.5" : "py-2.5")}
    >
      {/* The header — at rest, the whole entry. */}
      <div className="flex gap-3.5 sm:gap-4">
        {/* The icon is the app: pressing it opens it, as the name does. */}
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          aria-hidden
          className="pressable mt-0.5 shrink-0 self-start transition-opacity duration-200 hover:opacity-80 active:opacity-60"
        >
          {icon}
        </button>

        <div className="min-w-0 flex-1">
          {/* Line one: the thing — the control that opens it — its one
              number and what is inside, said quietly after it, and when.
              `data-chapter` is what the pinned bar watches: once the row is
              open and this line slides up under the bar's ref slot, the
              slot takes the name over — as the branch it is — the way a
              large title hands over to a navigation bar. */}
          <div
            data-chapter={open ? commit.id : undefined}
            className="flex items-baseline justify-between gap-3"
          >
            <h3
              className={cn(
                "min-w-0 text-foreground",
                lead ? "text-[15px] font-medium sm:text-base" : "text-sm",
              )}
            >
              <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                aria-controls={historyId}
                className="group/open pressable text-left decoration-foreground/30 underline-offset-4 hover:underline"
              >
                {nameHead}
                {/* The last word and the chevron break together: a chevron
                    alone on a line is a control nobody can place. */}
                <span className="whitespace-nowrap">
                  {nameTail}
                  <ChevronRight
                    aria-hidden
                    className={cn(
                      "-mt-0.5 ml-1 inline size-3.5 text-tertiary-foreground transition-transform duration-200 group-hover/open:text-foreground",
                      open && "rotate-90",
                    )}
                  />
                </span>
              </button>
              <span className="hidden whitespace-nowrap font-normal sm:inline">
                {entry.stat && (
                  <span className={cn(TYPE.rowMeta, "ml-2 tabular-nums")}>
                    {entry.stat}
                  </span>
                )}
                {contentsLine && <span className="ml-3">{contentsLine}</span>}
              </span>
            </h3>
            <span className={cn(TYPE.rowMeta, "shrink-0 tabular-nums")}>
              {entry.years}
            </span>
          </div>

          {/* Line two: my part in it — and, on a desk, where to see it, in
              the right-hand column under the years: when, then where. The
              part I played is the line that must not break; the links give
              way to it, a long post title first. */}
          <div className="mt-0.5 flex items-baseline justify-between gap-4">
            <p
              className={cn(
                "min-w-0 sm:shrink-0",
                lead
                  ? "text-[13px] text-muted-foreground sm:text-sm"
                  : "text-[13px] text-tertiary-foreground",
              )}
            >
              {entry.credit}
            </p>
            <Links
              links={links}
              open={openLink}
              className="hidden min-w-0 justify-end sm:flex"
            />
          </div>

          {/* The description is the entry's while it is closed. Open, the
              project's own row in its history prints it, beside its
              covers. */}
          {lead && !open && entry.description && (
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-muted-foreground sm:text-sm sm:leading-[1.375rem]">
              {entry.description}
            </p>
          )}

          {/* On a phone the column is the width of the name, and the name's
              line has the years to hold: the stat, what is inside and the
              links take a line of their own, last. */}
          <Links
            links={links}
            open={openLink}
            lead={
              (entry.stat || contentsLine) && (
                <li className="inline-flex shrink-0 items-baseline gap-3">
                  {entry.stat && (
                    <span className={cn(TYPE.rowMeta, "tabular-nums")}>
                      {entry.stat}
                    </span>
                  )}
                  {contentsLine}
                </li>
              )
            }
            className="mt-1 flex flex-wrap sm:hidden"
          />
        </div>
      </div>

      {/* The history — the log's rows for this project, in place. Under
          the name on a desk, so the hash and the rail hang where the icon
          stands; the whole column on a phone, which has none to spare. */}
      {open && (
        <div
          id={historyId}
          className={cn(
            "mt-3",
            lead ? "lg:pl-[3.75rem]" : "lg:pl-[2.875rem]",
          )}
        >
          <CommitRows
            commits={entry.history}
            context={depth.context}
            locale={locale}
            identities={depth.identities}
            form={depth.form}
            activeTypes={depth.types}
            onSelectHash={depth.onSelectHash}
          />
          {/* Where the history ends: past here, the bar is back on `main`. */}
          <span aria-hidden data-chapter={`${commit.id}/end`} />
        </div>
      )}
    </li>
  );
}

/**
 * A row's links, one per site: react.dev twice over is one place to go,
 * and its first link is the one that says the most. Several of my own
 * posts are one link too — `3 posts`, opening the first, from where the
 * attachments page through the rest — because three titles in a row of
 * metadata is a paragraph.
 */
function linksOf(media: Media[], locale: Locale) {
  const seen = new Set<string>();
  const isPost = (m: Media) => m.kind === "link" && m.url.startsWith("/writing/");
  const posts = media.filter(isPost).length;
  return media.flatMap((m, index) => {
    const label =
      posts > 1 && isPost(m)
        ? t(locale, "worksPosts").replace("{n}", String(posts))
        : linkLabel(m, locale);
    if (seen.has(label)) return [];
    seen.add(label);
    return [{ label, index, href: hrefOf(m, locale) }];
  });
}

function Links({
  links,
  open,
  lead,
  className,
}: {
  links: ReturnType<typeof linksOf>;
  open: ReturnType<typeof useOpen>;
  /** What leads the line: a phone's stat and contents (a desk has them
   *  after the name). */
  lead?: ReactNode;
  className?: string;
}) {
  if (links.length === 0 && !lead) return null;
  return (
    <ul className={cn("gap-x-3 gap-y-0.5", className)}>
      {lead}
      {links.map(({ label, index, href }) => (
        <li key={index} className="min-w-0 max-w-full">
          <a
            href={href}
            {...external(href)}
            onClick={open(index)}
            title={label}
            className={cn(
              TYPE.rowMeta,
              "block max-w-[11rem] truncate transition-colors duration-200 hover:text-foreground",
            )}
          >
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
}

// =============================================================================
// The rest — the log's rows no project claims
// =============================================================================

const SECTION_TITLE_KEY = { along: "worksAlong" } as const;

function sectionTitle(section: WorksSection, locale: Locale): string {
  if (!section.type) return t(locale, SECTION_TITLE_KEY.along);
  const plural = getCommitTypePluralLabel(section.type, locale);
  // "Other talks": the rest of them live under their projects, above.
  return section.partial
    ? t(locale, "worksOther").replace(
        "{type}",
        locale === "en" ? plural.toLowerCase() : plural,
      )
    : plural;
}

/** A serif heading, as /prompt heads its chapters: somebody's words. */
function Section({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title?: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section id={id} data-works-container={id} className="scroll-mt-24">
      {title && (
        <h2 className="mb-2 flex items-baseline gap-2.5 font-serif text-xl text-foreground sm:text-2xl">
          {title}
          {count !== undefined && (
            <span className={cn(TYPE.rowMeta, "tabular-nums")}>{count}</span>
          )}
        </h2>
      )}
      {children}
    </section>
  );
}

// =============================================================================
// The page
// =============================================================================

/**
 * Whether a project prints under the filter: its own row matches, or
 * something inside it does — in which case it prints as the heading that
 * row sits under.
 */
export function projectMatches(
  entry: ProjectEntry,
  types: readonly FilterableCommitType[],
): boolean {
  return entry.history.some((c) => isRowVisible(c, types));
}

/**
 * Whether the page, at this depth, stands a container open: the feed opens
 * everything, and a filter opens whatever holds a row it names — a project
 * whose own row is the match is already on screen, and stays a resume row.
 */
export function openByDefault(
  history: readonly Commit[],
  own: Commit | undefined,
  form: LogForm,
  types: readonly FilterableCommitType[],
): boolean {
  if (form === "feed") return true;
  if (types.length === 0) return false;
  return history.some((c) => c !== own && isRowVisible(c, types));
}

export function WorksIndexView({
  index,
  locale,
  form,
  types,
  identities,
  isOpen,
  onToggle,
  onSelectHash,
}: {
  index: WorksIndex;
  locale: Locale;
  form: LogForm;
  types: FilterableCommitType[];
  identities?: Record<string, Identity>;
  /** Whether a container (a project's commit id) is open. */
  isOpen: (id: string) => boolean;
  onToggle: (id: string) => void;
  onSelectHash: (hash: string) => void;
}) {
  const depth: Depth = {
    locale,
    form,
    types,
    context: index.context,
    identities,
    onSelectHash,
  };
  const lead = index.lead.filter((e) => projectMatches(e, types));
  const more = index.more.filter((e) => projectMatches(e, types));
  const sections = index.sections.filter((s) =>
    s.rows.some((c) => isRowVisible(c, types)),
  );
  const empty = lead.length + more.length + sections.length === 0;

  // The index prints every project as a line; the resume, the first tier
  // whole.
  const wholeLead = form !== "index";
  const row = (entry: ProjectEntry, tierLead: boolean) => (
    <ProjectRow
      key={entry.commit.id}
      entry={entry}
      lead={tierLead}
      open={isOpen(entry.commit.id)}
      onToggle={() => onToggle(entry.commit.id)}
      depth={depth}
    />
  );

  return (
    <div className="space-y-14 sm:space-y-16">
      {lead.length + more.length > 0 && (
        <Section id="projects">
          {lead.length > 0 && <ul>{lead.map((e) => row(e, wholeLead))}</ul>}
          {more.length > 0 && (
            <>
              {lead.length > 0 && (
                <p className={cn(TYPE.label, "mt-8 mb-1")}>
                  {t(locale, "worksMoreProjects")}
                </p>
              )}
              <ul>{more.map((e) => row(e, false))}</ul>
            </>
          )}
        </Section>
      )}

      {sections.map((section) => (
        <Section
          key={section.id}
          id={section.id}
          title={sectionTitle(section, locale)}
          count={section.rows.filter((c) => isRowVisible(c, types)).length}
        >
          {/* A line each, until the page goes deeper: the feed, or a filter
              that asked for these rows by name. */}
          <CommitRows
            commits={section.rows}
            context={index.context}
            locale={locale}
            identities={identities}
            form={
              openByDefault(section.rows, undefined, form, types)
                ? form
                : "index"
            }
            activeTypes={types}
            onSelectHash={onSelectHash}
          />
        </Section>
      ))}

      {/* End marker — `git init` closes the page, as it closed the log; a
          filter that matched nothing says so in the same slot, in the same
          voice, rather than leaving the page to end in silence. */}
      <div className="py-4 font-mono text-xs text-tertiary-foreground">
        {t(locale, empty ? "logNoMatches" : "logInit")}
      </div>
    </div>
  );
}
