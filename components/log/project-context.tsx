"use client";

/**
 * Project context on /works — the rendering half of `lib/log-context.ts`.
 *
 * A role is already context on this page, and it is shown in four registers
 * that together keep it nearly silent: a sparse mark (the `<handle>`, at the
 * head of a run only), a light on demand (the tenure rail, on hover), a
 * peek (the identity card behind the handle), and the written-out form
 * (`Author:` / `Role:`, when a row is opened). This file gives a project the
 * same four, in the same places, so a talk about Lynx reads the way a
 * commit under @bytedance already does:
 *
 *   ◇ Lynx     the mark, on the meta line — at the head of a run of rows
 *              about the same project, and on hover everywhere else
 *   the peek   hovering the mark shows the project: its cover, its line,
 *              how many things are about it
 *   the light  hovering the row lights the connector to the project's own
 *              row, when it is in the same chapter (log-timeline.tsx)
 *   fields     opened, a talk writes `Project:` lines and a project writes
 *              the list of what is about it
 *
 * Nothing here merges rows. The talks keep their own rows, in their own
 * months; the project is referenced, the way a role is.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { MagneticPreview, PEEK_W } from "@/components/motion-primitives/magnetic-preview";
import type { Locale } from "@/lib/i18n";
import {
  getCommitThumbnail,
  getCommitTypePluralLabel,
  localize,
  localizeOptional,
  type Commit,
  type ProjectCommit,
} from "@/lib/log";
import {
  commitsAbout,
  indexProjects,
  projectRef,
  type ContextEntry,
  type ProjectRef,
} from "@/lib/log-context";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { CommitIcon } from "./icons";

interface ProjectContextValue {
  locale: Locale;
  /** Resolve an id to a project, or nothing — a dangling id prints nothing. */
  ref: (id: string) => ProjectRef | null;
  project: (id: string) => ProjectCommit | null;
  /** What is about a project, newest first. */
  about: (id: string) => ContextEntry[];
  onSelectHash?: (hash: string) => void;
}

const Ctx = createContext<ProjectContextValue | null>(null);

/**
 * Built once per timeline from EVERY commit in the log, not per chapter: a
 * project is context for talks in other eras — React Compiler (2021) for
 * React for Two Threads (2025) — so resolution cannot stop at a chapter's
 * edge the way the rail does.
 */
export function ProjectContextProvider({
  commits,
  locale,
  onSelectHash,
  children,
}: {
  commits: readonly Commit[];
  locale: Locale;
  onSelectHash?: (hash: string) => void;
  children: ReactNode;
}) {
  const value = useMemo<ProjectContextValue>(() => {
    const projects = indexProjects(commits);
    const refs = new Map(
      [...projects.values()].map((p) => [p.id, projectRef(p, locale)]),
    );
    const about = commitsAbout(commits, projects, locale);
    return {
      locale,
      ref: (id) => refs.get(id) ?? null,
      project: (id) => projects.get(id) ?? null,
      about: (id) => about.get(id) ?? [],
      onSelectHash,
    };
  }, [commits, locale, onSelectHash]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProjectContext() {
  return useContext(Ctx);
}

/** A project mark to print: which project, and whether it prints at rest. */
export interface ProjectMarkSpec {
  id: string;
  /** Head of a run — printed at rest. Otherwise it waits for a hover on
   *  the row, exactly as a repeated `<handle>` does. */
  head: boolean;
}

/**
 * `◇ Lynx` — one project this row is about, in passing.
 *
 * Quiet by type (the row's meta rung), and quieter still when it repeats
 * the run it is in. It is a real control: the hover is the project's peek,
 * and the press travels the page to the project's row — which on a phone,
 * with no hover, is the whole of what it does.
 */
export function ProjectMark({ id, head }: ProjectMarkSpec) {
  const ctx = useProjectContext();
  const ref = ctx?.ref(id);
  const project = ctx?.project(id);
  if (!ctx || !ref || !project) return null;
  return (
    <MagneticPreview
      preview={<ProjectPeek project={project} />}
      panelClassName={cn(PEEK_W, "p-0 bg-transparent border-transparent backdrop-blur-none")}
      className={cn(
        "inline-block align-baseline transition-opacity duration-200",
        head ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
      )}
    >
      <a
        href={`#${ref.hash}`}
        onClick={(e) => {
          e.stopPropagation();
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          if (!ctx.onSelectHash) return;
          e.preventDefault();
          ctx.onSelectHash(ref.hash);
        }}
        title={ref.title}
        className="whitespace-nowrap transition-colors hover:text-foreground"
      >
        {/* Plain inline text with the icon set INTO the line, not on it.
            As a flex item the SVG has no baseline of its own, so it was
            aligned by its bottom edge: the line box had to hold the icon
            above the baseline and the text's descender below it, and every
            meta line wearing a mark grew from 16px to 18px — the rhythm this
            row was fixed to hold. A fixed offset keeps the icon inside the
            text's own line height. */}
        <CommitIcon
          type="project"
          className="mr-1 inline-block h-3 w-3 align-[-0.125rem]"
        />
        {ref.label}
      </a>
    </MagneticPreview>
  );
}

/** Several marks in a row, for a row about more than one project. */
export function ProjectMarks({
  marks,
  className,
}: {
  marks: readonly ProjectMarkSpec[];
  className?: string;
}) {
  if (marks.length === 0) return null;
  return (
    <span className={cn("inline-flex items-baseline gap-2 leading-4", className)}>
      {marks.map((m) => (
        <ProjectMark key={m.id} {...m} />
      ))}
    </span>
  );
}

/**
 * The project, peeked from a mark. A card rather than the row: the reader
 * is somewhere else on the page — often years away — and wants to know what
 * this talk is about without leaving it.
 */
function ProjectPeek({ project }: { project: ProjectCommit }) {
  const ctx = useProjectContext();
  if (!ctx) return null;
  const { locale } = ctx;
  const cover = getCommitThumbnail(project);
  const about = ctx.about(project.id);
  const team = localizeOptional(project.team, locale);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-raised">
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" className="aspect-[2/1] w-full object-cover" />
      )}
      <div className="space-y-1 p-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className={TYPE.rowTitle}>{localize(project.title, locale)}</span>
          {team && <span className={cn(TYPE.rowMeta, "truncate")}>{team}</span>}
        </div>
        <p className={cn(TYPE.caption, "line-clamp-3")}>
          {localize(project.description, locale)}
        </p>
        {about.length > 0 && (
          <div className={TYPE.rowMeta}>
            {locale === "zh"
              ? `${about.length} 条相关`
              : `${about.length} ${about.length === 1 ? "commit" : "commits"} about it`}
          </div>
        )}
      </div>
    </div>
  );
}

/** One `Project:` field per project, for an opened row's author block. */
export function useProjectFields(ids: readonly string[]) {
  const ctx = useProjectContext();
  if (!ctx) return [];
  return ids
    .map((id) => ctx.ref(id))
    .filter((r): r is ProjectRef => !!r)
    .map((r) => ({
      label: r.label,
      title: r.title,
      hash: r.hash,
      onSelect: ctx.onSelectHash,
    }));
}

/**
 * What is about a project, for its opened row — and what to call the list:
 * `Talks:` when it is all talks, the generic line when it is a mix.
 */
export function useContextEntries(projectId: string | null): {
  entries: { hash: string; title: string; date: string; onSelect?: (hash: string) => void }[];
  label?: string;
} {
  const ctx = useProjectContext();
  if (!ctx || !projectId) return { entries: [] };
  const about = ctx.about(projectId);
  const types = new Set(about.map((e) => e.commit.type));
  const label =
    types.size === 1
      ? `${getCommitTypePluralLabel([...types][0], ctx.locale)}:`
      : ctx.locale === "zh"
        ? "相关："
        : "About it:";
  return {
    label,
    entries: about.map((e) => ({
      hash: e.hash,
      title: e.title,
      date: e.date,
      onSelect: ctx.onSelectHash,
    })),
  };
}
