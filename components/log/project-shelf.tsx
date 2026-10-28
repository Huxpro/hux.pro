"use client";

/**
 * ProjectShelf: the projects, as a directory above the log. On trial: a
 * saved DevTool setting (Works → Projects shelf), off by default.
 *
 * /works is a log, and a log answers "what happened when". The question a
 * visitor brings is "what have you built", and a log answers it by making
 * them find eleven projects among nineteen talks. A projects page answers
 * it first, in a column of faces and names.
 *
 * Folded (the way it rests), the shelf is one line: the projects' marks in
 * a row, the way a dock holds its apps, and a caret after them. Every
 * project is on screen at a glance and the log starts a line later. Each
 * mark is already the project's door (its row's permalink, and its peek
 * under a pointer), so the folded shelf is a small directory, not a teaser
 * of one. Opened, every project gets its cell: the mark, its name, and two
 * lines of what it is, in two columns, the way a settings list or an app
 * store lists things that have an icon; the row of marks stands down, since
 * the cells print the same faces at a size you can read. The reader opens
 * it; the page does not, and once opened it stays open for that reader
 * (`localStorage`), because a shelf you have to open every visit is a shelf
 * you stop opening.
 *
 * It is a directory, not a second log. A cell is a permalink to the
 * project's row (`/works#<hash>`), so pressing it scrolls the page there
 * (to the description whole, the covers, the notes, the author), and on a
 * pointer device it peeks the row's own peek (the stacked covers), so the
 * work is one rest of the pointer away before the trip. Nothing here
 * duplicates what the row prints; the shelf says *which*, the row says
 * *what*.
 *
 * No marker: a row of eleven faces says "projects" and "eleven" better than
 * a pill could, and it is not a chapter. The pinned bar's ref slot does not
 * watch it, so `main` stays up until the first era's marker arrives.
 */

import { MagneticPreview } from "@/components/motion-primitives/magnetic-preview";
import { makeStore } from "@/components/post/persisted-setting";
import { commitMark } from "@/components/magic-link/resolve";
import type { Locale } from "@/lib/i18n";
import {
  computeCommitHash,
  getCommitTypePluralLabel,
  localize,
  type Commit,
} from "@/lib/log";
import { plainInline } from "@/lib/inline-links";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useInputCapability } from "@/services";
import { ChevronRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, type MouseEvent } from "react";
import { buildCommitPreview } from "./commit-embed";
import { ProjectMark } from "./project-mark";

type ShelfState = "open" | "closed";

/** Whether this reader has opened the shelf. Closed until they do. */
const shelfStore = makeStore<ShelfState>(
  "hux_works_shelf",
  "hux:works-shelf",
  "closed",
  (raw) => (raw === "open" ? "open" : "closed"),
);

/** The directory's height eases in and out; the fade rides a beat behind. */
const UNFOLD = {
  initial: { height: 0, opacity: 0 },
  animate: {
    height: "auto",
    opacity: 1,
    transition: {
      height: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const },
      opacity: { duration: 0.2, delay: 0.05 },
    },
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const },
      opacity: { duration: 0.1 },
    },
  },
};

export interface ProjectShelfProps {
  /** The projects, in the order to show them: the log's own, newest first. */
  projects: readonly Commit[];
  locale: Locale;
  /** Makes a cell the row's permalink (see `useCommitAnchor`). */
  onSelectHash?: (hash: string) => void;
  className?: string;
}

export function ProjectShelf({
  projects,
  locale,
  onSelectHash,
  className,
}: ProjectShelfProps) {
  const { magneticPreviewEnabled } = useInputCapability();
  const reduced = useReducedMotion() ?? false;
  const open = shelfStore.use() === "open";

  // Resolved once per project, not once per render of every cell: the mark
  // is a lookup in two snapshots, the peek a small tree, and a hover on the
  // timeline below re-renders the page.
  const cells = useMemo(
    () =>
      projects.map((commit) => ({
        id: commit.id,
        hash: computeCommitHash(commit.id),
        title: localize(commit.title, locale),
        description: plainInline(localize(commit.description, locale)),
        mark: commitMark(commit, locale),
        peek: magneticPreviewEnabled ? buildCommitPreview(commit, locale) : null,
      })),
    [projects, locale, magneticPreviewEnabled],
  );

  if (cells.length === 0) return null;

  const label = getCommitTypePluralLabel("project", locale);

  /** A press on a mark or a cell: the page's own travel to the row. */
  const travel = (hash: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    // Modified clicks belong to the browser. A new tab of the permalink is
    // exactly what they ask for.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!onSelectHash) return;
    e.preventDefault();
    onSelectHash(hash);
  };

  return (
    <section
      aria-label={label}
      className={cn("mb-4 border-b border-border/30 pb-4", className)}
    >
      {/* The line the shelf rests on: folded, the marks in a row and the
          caret after them; open, the caret alone. The row scrolls under the
          column's edge on a phone rather than wrapping into a second line
          the fold exists to avoid; the caret stays put past the scroll. */}
      <div className="flex items-center gap-2 py-2">
        {!open && (
          <div
            className="flex min-w-0 items-center gap-1.5 overflow-x-auto no-scrollbar"
            aria-label={label}
          >
            {cells.map(({ id, hash, title, mark, peek }) => (
              <MagneticPreview
                key={id}
                as="span"
                preview={peek?.node}
                enabled={!!peek}
                panelClassName={peek?.panelClassName}
                className="shrink-0"
              >
                <a
                  href={`#${hash}`}
                  onClick={travel(hash)}
                  aria-label={title}
                  title={title}
                  className="pressable block rounded-[5px] transition-opacity hover:opacity-80"
                >
                  <ProjectMark icon={mark} className="size-5 rounded-[5px]" />
                </a>
              </MagneticPreview>
            ))}
          </div>
        )}

        {/* The disclosure points on while folded and down once open. It is
            the one mark on the page that says a thing folds. */}
        <button
          type="button"
          onClick={() => shelfStore.set(open ? "closed" : "open")}
          aria-expanded={open}
          aria-label={label}
          title={label}
          className={cn(
            "pressable inline-flex size-5 shrink-0 items-center justify-center rounded",
            "text-tertiary-foreground transition-colors hover:text-foreground",
          )}
        >
          <ChevronRight
            aria-hidden
            className={cn(
              "size-3.5 transition-transform duration-200",
              open && "rotate-90",
            )}
          />
        </button>
      </div>

      {/* Open: two columns at every width. The cells hang into the row's own
          gutter (`-mx-3`, the timeline row's) so a cell's wash lines up with
          a row's, and the faces sit on the column's left edge where the
          chapter markers do. */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="directory"
            variants={UNFOLD}
            initial={reduced ? false : "initial"}
            animate="animate"
            exit={reduced ? undefined : "exit"}
            className="overflow-hidden"
          >
            <div className="-mx-3 grid grid-cols-2 gap-x-2 gap-y-0.5 pt-1">
              {cells.map(({ id, hash, title, description, mark, peek }) => (
                <MagneticPreview
                  key={id}
                  preview={peek?.node}
                  enabled={!!peek}
                  panelClassName={peek?.panelClassName}
                  className="min-w-0"
                >
                  <a
                    href={`#${hash}`}
                    onClick={travel(hash)}
                    aria-label={title}
                    className={cn(
                      "pressable flex min-w-0 items-start gap-3 rounded-lg px-3 py-2.5",
                      "transition-colors duration-150 hover:bg-muted/20 active:bg-muted/30",
                    )}
                  >
                    {/* The face, at the size a list gives an icon (a third
                        bigger than the row's), with the corner an app icon has. */}
                    <ProjectMark
                      icon={mark}
                      className="mt-0.5 size-8 rounded-[22.5%] text-base"
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block line-clamp-2", TYPE.rowTitle)}>
                        {title}
                      </span>
                      {description && (
                        <span className={cn("mt-0.5 block line-clamp-2", TYPE.caption)}>
                          {description}
                        </span>
                      )}
                    </span>
                  </a>
                </MagneticPreview>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
