"use client";

/**
 * Places — /works read as a career (see lib/log-places.ts for what goes
 * where, and lib/log-view.ts for how this reading and the log share a URL).
 *
 *   ByteDance                                    ← the place, in serif: a
 *   Architect                     2023 – Present    name, the way /prompt's
 *   Architect of Lynx at ByteDance. …                headings are
 *
 *   Lynx Framework                2023 – Present ← the work done there,
 *   1B+ users                                       whole: what it is, how
 *   Open-source cross-platform UI framework …       big, and where to see it
 *   lynxjs.org  github.com
 *
 *   Talks 12  React Advanced London, React …  ⌄  ← talks fold to one line
 *
 * Hierarchy is carried by type alone — size, face and rung — with no box,
 * no rule and no indent. The log's instruments (hash, rail, chips, covers)
 * are the log's; this reading has one job, which is to be scanned.
 *
 * Every mark that stands for more than it prints opens what it stands for,
 * through the system that already owns it: the place name is the identity
 * card (systems/identity), the same one a `<handle>` opens on the log; a
 * link or a talk opens its attachment (systems/attachments) — the theater,
 * the in-app browser, the sheet on a phone — exactly as its cover would.
 */

import { useId, useMemo, useState, type MouseEvent } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/lib/typography";
import { t, type Locale } from "@/lib/i18n";
import {
  formatCommitDate,
  getCommitTypePluralLabel,
  isImageMedia,
  isLinkMedia,
  isSlidesMedia,
  isVideoMedia,
  localize,
  VIDEO_PLATFORM_LABEL,
  type Commit,
  type LogData,
  type Media,
  type PressCommit,
  type ProjectCommit,
  type RoleCommit,
  type TalkCommit,
} from "@/lib/log";
import {
  buildPlaces,
  ELSEWHERE_ID,
  hasWork,
  type Place,
  type PlaceWork,
} from "@/lib/log-places";
import { IdentityHover } from "@/systems/identity";
import {
  attachmentSetFor,
  isInternalLink,
  linkTarget,
  useOptionalAttachments,
} from "@/systems/attachments";

// =============================================================================
// Recipes
// =============================================================================

/** A place's name: the serif heading voice /prompt gives a section. */
const PLACE_NAME =
  "font-serif text-2xl sm:text-[1.75rem] leading-tight tracking-tight text-foreground";

/** A project's name: the one sans title on the page that isn't a row. */
const WORK_TITLE = "text-[0.9375rem] sm:text-base font-medium text-foreground";

/** A description printed whole, at the rung a reader reads at. */
const PROSE = "text-sm text-muted-foreground leading-relaxed";

/** A quiet inline link — /prompt's LinkRow recipe, so the two pages link
 *  out in the same voice. */
const QUIET_LINK =
  "font-mono text-xs text-muted-foreground underline underline-offset-2 decoration-ink-line transition-colors hover:text-foreground hover:decoration-foreground";

/**
 * A place down the spine. Margins rather than the column's `space-y`, so a
 * life event between two places can sit in the middle of the gap it names:
 * its own top margin above it, and the place after it (`p + section`)
 * closing up to the same distance below.
 */
const SECTION = "scroll-mt-24 mt-12 first:mt-0 [p+&]:mt-7";

/** How many talks print before the list folds to its count. */
const TALKS_OPEN_MAX = 3;

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

/** The venue a talk or a press piece was given at or published by. */
function venueOf(c: TalkCommit | PressCommit): string {
  return c.type === "talk" ? c.conference.name : c.platform;
}

// =============================================================================
// Opening an attachment
// =============================================================================

/**
 * The click a link or a talk row makes: through the attachment door when
 * one is mounted (the theater, the in-app browser, the sheet on a phone),
 * the plain href otherwise. Modified clicks are the browser's.
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

function RoleLines({ roles, locale }: { roles: RoleCommit[]; locale: Locale }) {
  return (
    <ul className="mt-2 space-y-0.5">
      {roles.map((r) => (
        <li
          key={r.id}
          className="flex items-baseline justify-between gap-4 font-mono text-xs"
        >
          <span className="min-w-0 text-muted-foreground">
            {localize(r.title, locale)}
          </span>
          {/* An education entry hides its dates on purpose (`hideDate`: it
              overlaps the work around it) and prints where it was instead,
              as it does on the log. */}
          <span className="shrink-0 text-tertiary-foreground">
            {r.hideDate ? r.location ?? "" : formatCommitDate(r, locale)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Project({
  project,
  company,
  locale,
}: {
  project: ProjectCommit;
  company: string;
  locale: Locale;
}) {
  const meta = [teamUnder(project, company, locale), ...statsOf(project, locale)]
    .filter(Boolean)
    .join(" · ");
  return (
    <article>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className={WORK_TITLE}>{localize(project.title, locale)}</h3>
        <span className={cn("shrink-0", TYPE.rowMeta)}>
          {formatCommitDate(project, locale)}
        </span>
      </div>
      {meta && <p className={cn("mt-0.5", TYPE.rowMeta)}>{meta}</p>}
      <p className={cn("mt-1.5", PROSE)}>{localize(project.description, locale)}</p>
      <LinkLine commit={project} locale={locale} className="mt-2" />
    </article>
  );
}

/**
 * Talks or press as /writing lists posts: the title, where, and the date
 * across from it. A row opens its first attachment — the recording, the
 * deck, the article — the way its cover would on the log.
 *
 * A long list folds to one line: its count and the venues it was given at,
 * which is most of what a list of twelve talks tells a newcomer. The flagship
 * work above it stays the first thing read.
 */
function Sublist({
  type,
  items,
  locale,
}: {
  type: "talk" | "press";
  items: (TalkCommit | PressCommit)[];
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const openAt = useOpenAttachment(locale);
  const listId = useId();
  if (items.length === 0) return null;

  const folds = items.length > TALKS_OPEN_MAX;
  const shown = !folds || open;
  const label = getCommitTypePluralLabel(type, locale);
  const venues = [...new Set(items.map(venueOf))].join(", ");

  const heading = (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-tertiary-foreground">{items.length}</span>
    </>
  );

  return (
    <div>
      {folds ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={listId}
          className="pressable group flex w-full min-w-0 items-baseline gap-2 text-left font-mono text-xs"
        >
          {heading}
          {/* Folded, the line says where; open, the rows below do. */}
          <span
            className={cn(
              "min-w-0 flex-1 truncate font-sans text-tertiary-foreground transition-opacity",
              open && "opacity-0",
            )}
          >
            {venues}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-tertiary-foreground transition-colors group-hover:text-foreground">
            {t(locale, open ? "worksShowLess" : "worksShowAll")}
            <ChevronDown
              aria-hidden
              className={cn(
                "h-3 w-3 transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </span>
        </button>
      ) : (
        <p className="flex items-baseline gap-2 font-mono text-xs">{heading}</p>
      )}

      {shown && (
        <ul id={listId} className="mt-1.5">
          {items.map((c) => {
            const title = localize(c.title, locale);
            const venue = venueOf(c);
            const first = c.media?.[0];
            const body = (
              <>
                <span className="min-w-0 text-sm text-foreground">
                  {title}
                  {!same(title, venue) && (
                    <span className="text-tertiary-foreground"> · {venue}</span>
                  )}
                </span>
                <span className={cn("shrink-0", TYPE.rowMeta)}>
                  {formatCommitDate(c, locale)}
                </span>
              </>
            );
            const row =
              "flex items-baseline justify-between gap-4 -mx-2 px-2 py-1.5 rounded-md";
            return (
              <li key={c.id}>
                {first ? (
                  <a
                    {...anchorFor(first, locale)}
                    onClick={openAt(c, 0)}
                    className={cn(
                      row,
                      "pressable transition-colors duration-200 hover:bg-muted/50 active:bg-muted/60",
                    )}
                  >
                    {body}
                  </a>
                ) : (
                  <div className={row}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Work({
  work,
  company,
  locale,
}: {
  work: PlaceWork;
  company: string;
  locale: Locale;
}) {
  if (!hasWork(work)) return null;
  return (
    <div className="mt-5 space-y-5">
      {work.projects.map((p) => (
        <Project key={p.id} project={p} company={company} locale={locale} />
      ))}
      {(work.talks.length > 0 || work.press.length > 0) && (
        <div className="space-y-4">
          <Sublist type="talk" items={work.talks} locale={locale} />
          <Sublist type="press" items={work.press} locale={locale} />
        </div>
      )}
    </div>
  );
}

function PlaceSection({ place, locale }: { place: Place; locale: Locale }) {
  const lead = place.roles[0];
  const company = localize(lead.company, locale);
  const description = localize(lead.description, locale).trim();
  return (
    <section id={place.id} aria-label={company} className={SECTION}>
      <h2 className={PLACE_NAME}>
        {/* The name is the identity: rest on it (or tap it) and the card the
            log's `<handle>` opens arrives — every role, the tenure, and
            what was signed there. */}
        <IdentityHover identityId={place.id} roleId={lead.id}>
          {company}
        </IdentityHover>
      </h2>
      <RoleLines roles={place.roles} locale={locale} />
      {/* One line of what the place was, from the latest role. The earlier
          roles' own prose is the card's to tell; here it would restate the
          projects printed under it. */}
      {description && <p className={cn("mt-3", PROSE)}>{description}</p>}
      <LinkLine commit={lead} locale={locale} className="mt-2" />
      <Work work={place} company={company} locale={locale} />
    </section>
  );
}

// =============================================================================
// The reading
// =============================================================================

export function PlacesReading({
  log,
  locale,
}: {
  log: LogData;
  locale: Locale;
}) {
  const { spine, elsewhere } = useMemo(() => buildPlaces(log, locale), [log, locale]);

  return (
    // The column says its language: `TYPE.aside`'s italic is Latin-only.
    <div lang={locale}>
      {spine.map((entry) =>
        entry.kind === "event" ? (
          // A life event between two places — the move, the sabbatical —
          // in the log's own aside voice, so the gap between two jobs is a
          // thing that happened rather than a blank.
          <p
            key={entry.event.id}
            className={cn(TYPE.aside, "[&:lang(zh)]:not-italic mt-9")}
          >
            {localize(entry.event.title, locale)}
            <span className="text-quaternary-foreground"> · </span>
            {formatCommitDate(entry.event, locale)}
          </p>
        ) : (
          <PlaceSection key={entry.place.id} place={entry.place} locale={locale} />
        ),
      )}

      {hasWork(elsewhere) && (
        <section
          id={ELSEWHERE_ID}
          aria-label={t(locale, "worksElsewhere")}
          className={SECTION}
        >
          <h2 className={PLACE_NAME}>{t(locale, "worksElsewhere")}</h2>
          <p className={cn("mt-3", PROSE)}>{t(locale, "worksElsewhereNote")}</p>
          <Work work={elsewhere} company="" locale={locale} />
        </section>
      )}
    </div>
  );
}
