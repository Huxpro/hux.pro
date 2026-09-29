"use client";

import type { MouseEvent, ReactNode } from "react";
import { t, type Locale } from "@/lib/i18n";
import {
  getCommitTypePluralLabel,
  type Commit,
  type Media,
} from "@/lib/log";
import { getHostname } from "@/lib/og-core";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import type { ListEntry, ProjectEntry, WorksIndex } from "@/lib/works-index";
import { useOptionalAttachments } from "@/systems/attachments";
import { attachmentSetFor } from "@/systems/attachments/lib/set";
import { ProjectIcon } from "./project-icon";

// =============================================================================
// The projects reading of /works — a resume, set in the system's type.
//
//   [icon]  Lynx Framework                              2023 – Present
//           Architect · Lynx @ ByteDance                     1B+ users
//           Open-source cross-platform UI framework behind TikTok, …
//           lynxjs.org   github.com
//
// A project is the page's unit, and it reads the way a resume entry reads:
// the thing, the part I played in it, when, and where to see it. The icon
// makes it a thing rather than a line of text — the app it would be on this
// OS's home screen — and it is what the eye finds first, so it goes first.
//
// Borderless, like every list here (docs/design-philosophy.md): no card
// and no box. The hierarchy is the icon, the weight and the ink: the name
// is the one medium-weight line, what I did is the second rung, the
// description the third, and the machine's metadata (years, stat, links)
// sits in mono on the rung that annotates.
//
// Two tiers, curated in content/log.json (`works-projects` and
// `works-projects-more`, lib/works-index.ts). The first is printed whole.
// The second — earlier and smaller — is a line each at a smaller icon, so a
// reader can tell at a glance which is which without being told.
//
// The talks and the press follow as /writing prints its posts: the title,
// its venue, the date across from it. Nineteen talks fit a screen that way;
// the log gave each one a cover and needed eight.
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

// =============================================================================
// Projects
// =============================================================================

function ProjectRow({
  entry,
  locale,
  lead,
}: {
  entry: ProjectEntry;
  locale: Locale;
  /** A first-tier row: the full entry. Otherwise a line. */
  lead: boolean;
}) {
  const { commit } = entry;
  const media = commit.media ?? [];
  const open = useOpen(commit, locale);
  const primary = media[0];
  const primaryHref = primary ? hrefOf(primary, locale) : undefined;
  const links = linksOf(media, locale);

  const icon = (
    <ProjectIcon
      commit={commit}
      monogram={entry.monogram}
      locale={locale}
      className={lead ? "size-10 sm:size-11" : "size-8"}
    />
  );

  return (
    <li className={cn("flex gap-3.5 sm:gap-4", lead ? "py-3.5" : "py-2.5")}>
      {/* The icon opens what the name opens: it is the thing, pressed. */}
      {primaryHref ? (
        <a
          href={primaryHref}
          {...external(primaryHref)}
          onClick={open(0)}
          tabIndex={-1}
          aria-hidden
          className={cn(
            "pressable shrink-0 self-start transition-opacity duration-200 hover:opacity-80 active:opacity-60",
            lead ? "mt-0.5" : "mt-0.5",
          )}
        >
          {icon}
        </a>
      ) : (
        <span className="mt-0.5 shrink-0 self-start">{icon}</span>
      )}

      <div className="min-w-0 flex-1">
        {/* Line one: the thing — and its one number, said quietly after
            it — and when. */}
        <div className="flex items-baseline justify-between gap-3">
          <h3
            className={cn(
              "min-w-0 text-foreground",
              lead ? "text-[15px] font-medium sm:text-base" : "text-sm",
            )}
          >
            {primaryHref ? (
              <a
                href={primaryHref}
                {...external(primaryHref)}
                onClick={open(0)}
                className="decoration-foreground/30 underline-offset-4 hover:underline"
              >
                {entry.name}
              </a>
            ) : (
              entry.name
            )}
            {entry.stat && (
              <span className="hidden whitespace-nowrap font-normal sm:inline">
                {" "}
                <span className={cn(TYPE.rowMeta, "ml-1.5 tabular-nums")}>
                  {entry.stat}
                </span>
              </span>
            )}
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
            open={open}
            className="hidden min-w-0 justify-end sm:flex"
          />
        </div>

        {lead && entry.description && (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-muted-foreground sm:text-sm sm:leading-[1.375rem]">
            {entry.description}
          </p>
        )}

        {/* On a phone the column is the width of the name, and the name's
            line has the years to hold: the stat and the links take a line
            of their own, last. */}
        <Links
          links={links}
          open={open}
          stat={entry.stat}
          className="mt-1 flex flex-wrap sm:hidden"
        />
      </div>
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
  stat,
  className,
}: {
  links: ReturnType<typeof linksOf>;
  open: ReturnType<typeof useOpen>;
  /** The row's number, leading the line (a phone's; a desk has it after
   *  the name). */
  stat?: string;
  className?: string;
}) {
  if (links.length === 0 && !stat) return null;
  return (
    <ul className={cn("gap-x-3 gap-y-0.5", className)}>
      {stat && (
        <li className={cn(TYPE.rowMeta, "shrink-0 tabular-nums")}>{stat}</li>
      )}
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
// Talks, press — a /writing list
// =============================================================================

function ListRow({ entry, locale }: { entry: ListEntry; locale: Locale }) {
  const media = entry.commit.media ?? [];
  const open = useOpen(entry.commit, locale);
  const primary = media[0];
  // Nothing attached: its row in the log is the one place it lives.
  const href = primary ? hrefOf(primary, locale) : `/works#${entry.hash}`;

  return (
    <li>
      <a
        href={href}
        {...(primary ? external(href) : {})}
        onClick={primary ? open(0) : undefined}
        className="pressable -mx-2 flex items-baseline justify-between gap-4 rounded-md px-2 py-1.5 transition-colors duration-200 hover:bg-muted/50 active:bg-muted/60"
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "text-sm",
              entry.minor ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {entry.title}
          </span>
          {/* The venue after the title, in the row's metadata ink — the
              way /writing prints provenance after a post's. Unbroken, so a
              venue that does not fit moves down whole rather than leaving
              half its name at the end of the title's line; on a phone,
              where most would, it always takes the line under the title,
              so the rows keep one shape. */}{" "}
          <span
            className={cn(
              TYPE.rowMeta,
              "mt-0.5 block sm:mt-0 sm:inline sm:whitespace-nowrap",
            )}
          >
            {entry.venue}
            {entry.language && (
              <span className="ml-2 whitespace-nowrap">{entry.language}</span>
            )}
          </span>
        </span>
        <time className={cn(TYPE.rowMeta, "shrink-0 tabular-nums")}>
          {entry.date}
        </time>
      </a>
    </li>
  );
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
    <section id={id} data-works-section className="scroll-mt-24">
      {title && (
        <h2 className="mb-3 flex items-baseline gap-2.5 font-serif text-xl text-foreground sm:text-2xl">
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

export function WorksIndexView({
  index,
  locale,
}: {
  index: WorksIndex;
  locale: Locale;
}) {
  return (
    <div className="space-y-14 sm:space-y-16">
      <Section id="projects">
        <ul>
          {index.lead.map((entry) => (
            <ProjectRow key={entry.commit.id} entry={entry} locale={locale} lead />
          ))}
        </ul>
        {index.more.length > 0 && (
          <>
            <p className={cn(TYPE.label, "mt-8 mb-1")}>
              {t(locale, "worksMoreProjects")}
            </p>
            <ul>
              {index.more.map((entry) => (
                <ProjectRow
                  key={entry.commit.id}
                  entry={entry}
                  locale={locale}
                  lead={false}
                />
              ))}
            </ul>
          </>
        )}
      </Section>

      {index.talks.length > 0 && (
        <Section
          id="talks"
          title={getCommitTypePluralLabel("talk", locale)}
          count={index.talks.length}
        >
          <ul>
            {index.talks.map((entry) => (
              <ListRow key={entry.commit.id} entry={entry} locale={locale} />
            ))}
          </ul>
        </Section>
      )}

      {index.press.length > 0 && (
        <Section
          id="press"
          title={getCommitTypePluralLabel("press", locale)}
          count={index.press.length}
        >
          <ul>
            {index.press.map((entry) => (
              <ListRow key={entry.commit.id} entry={entry} locale={locale} />
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
