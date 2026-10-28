"use client";

import { ArrowUpRight, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { libraryById, SITE_REPO, type LabId, type LibraryLab, type Text } from "../catalog";
import { useLabStrings, type LabTable } from "../i18n";
import { LabShell, labButtonClass } from "./shell";

// =============================================================================
// The library template: one shape for every library the lab publishes.
//
// A library lab is a study that left: a system of this site, published as a
// package. Its lab is its home, and every library's home has the same three
// pages under the same bar, so a new library brings its words and its demo,
// not a design:
//
//   Docs        /lab/<id>        the guide: the library's own body (Vitre's
//                                is an article beside a simulated iPhone)
//   API         /lab/<id>/api    every export and every public type, from
//                                data the package type-checks (LibraryApi)
//   On hux.pro  /lab/<id>/site   how this site uses it: live state, policy,
//                                and the files it lives in
//
// The pages are the bar's actions (LibraryPages), so they stay put while a
// page's own tools scroll; the header (LibraryHeader) opens each page with
// what a developer checks first: version, requirements, where to get it.
// =============================================================================

export type LibraryPage = "docs" | "api" | "site";

const PAGES: LibraryPage[] = ["docs", "api", "site"];

const en = {
  pagesLabel: "Library pages",
  pages: { docs: "Docs", api: "API", site: "On hux.pro" } satisfies Record<LibraryPage, string>,
  notOnNpm: "not on npm yet",
  source: "Source",
  demo: "Demo",
  kinds: { component: "Components", hook: "Hooks", function: "Functions", constant: "Constants" },
  types: "Types",
  inDocs: "In the guide",
  filter: "Filter",
  none: "Nothing in the API matches.",
};

const zh: typeof en = {
  pagesLabel: "库的页面",
  pages: { docs: "文档", api: "API", site: "本站用法" },
  notOnNpm: "尚未发布到 npm",
  source: "源码",
  demo: "演示",
  kinds: { component: "组件", hook: "Hooks", function: "函数", constant: "常量" },
  types: "类型",
  inDocs: "见文档",
  filter: "筛选",
  none: "API 里没有匹配的条目。",
};

const LIBRARY_STRINGS: LabTable<typeof en> = { en, zh };

function pageHref(lab: LibraryLab, page: LibraryPage): string {
  return page === "docs" ? lab.href : `${lab.href}/${page}`;
}

/**
 * The lab shell, for a library: its pages in the bar, its header on top.
 * Docs takes the canvas (a library lays out its own guide); API and On hux.pro
 * are documents.
 */
export function LibraryShell({
  lab,
  page,
  tools,
  children,
}: {
  lab: LabId;
  page: LibraryPage;
  /** The page's own tools (the guide's section tabs, the API's filter). */
  tools?: ReactNode;
  children: ReactNode;
}) {
  const entry = libraryById(lab);
  return (
    <LabShell
      lab={lab}
      layout={page === "docs" ? "canvas" : "document"}
      tools={tools}
      scrollTools
      actions={<LibraryPages lab={entry} page={page} />}
    >
      <div>
        <LibraryHeader lab={entry} />
        <div className="mt-8">{children}</div>
      </div>
    </LabShell>
  );
}

/** Docs · API · On hux.pro: the same three, in every library's bar. */
function LibraryPages({ lab, page }: { lab: LibraryLab; page: LibraryPage }) {
  const L = useLabStrings(LIBRARY_STRINGS);
  return (
    <nav aria-label={L.pagesLabel} className="flex items-center gap-0.5 rounded-full bg-foreground/[0.04] p-0.5">
      {PAGES.map((p) => (
        <Link
          key={p}
          href={pageHref(lab, p)}
          aria-current={p === page ? "page" : undefined}
          className={cn(
            "whitespace-nowrap rounded-full px-2 py-1 font-mono text-xs transition-colors sm:px-2.5",
            p === page
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {L.pages[p]}
        </Link>
      ))}
    </nav>
  );
}

/**
 * What a developer checks before reading on: the package's name and version,
 * what it needs, and where to get it. Read from its package.json (the
 * catalog's `library`), so it cannot drift from what ships.
 */
export function LibraryHeader({ lab }: { lab: LibraryLab }) {
  const L = useLabStrings(LIBRARY_STRINGS);
  const { package: name, version, requires, npm, source, demo } = lab.library;
  return (
    <div className="space-y-1 border-b border-border/50 pb-4 font-mono">
      <div className="flex items-center gap-3">
        <span className="text-sm text-foreground">{name}</span>
        <span className="text-xs text-muted-foreground">v{version}</span>
        <span className="ml-auto flex items-center gap-1">
          {npm && (
            <a href={npm} target="_blank" rel="noreferrer" className={labButtonClass()}>
              npm
              <ArrowUpRight />
            </a>
          )}
          <a href={source} target="_blank" rel="noreferrer" className={labButtonClass()}>
            {L.source}
            <ArrowUpRight />
          </a>
          <a href={demo} className={labButtonClass()}>
            {L.demo}
            <ArrowUpRight />
          </a>
        </span>
      </div>
      <p className="text-[11px] text-tertiary-foreground">
        {requires}
        <span className="text-quaternary-foreground"> · </span>
        {npm ? <code className="text-foreground">pnpm add {name}</code> : L.notOnNpm}
      </p>
    </div>
  );
}

/** The package in one mono line (`vitre v0.1.0 · React >=19 · not on npm yet`), for a card. */
export function LibraryFacts({ lab, className }: { lab: LibraryLab; className?: string }) {
  const L = useLabStrings(LIBRARY_STRINGS);
  const { package: name, version, requires, npm } = lab.library;
  return (
    <p className={cn("flex flex-wrap gap-x-1.5 font-mono text-[11px] text-tertiary-foreground", className)}>
      {/* Each fact whole on its line; the line breaks between them. */}
      <span className="whitespace-nowrap">
        <span className="text-muted-foreground">{name}</span> v{version}
      </span>
      <span className="whitespace-nowrap">· {requires}</span>
      <span className="whitespace-nowrap">· {npm ? "npm" : L.notOnNpm}</span>
    </p>
  );
}

// -----------------------------------------------------------------------------
// The API reference
// -----------------------------------------------------------------------------

export interface ApiExport {
  name: string;
  kind: "component" | "hook" | "function" | "constant";
  signature: string;
  summary: Text;
  /** Where the guide explains it (`/lab/vitre#state`). */
  docs?: string;
}

export interface ApiField {
  name: string;
  type: string;
  default?: string;
  summary: Text;
}

export interface ApiType {
  name: string;
  fields: ApiField[];
}

/**
 * A library's whole public surface, as data. The library builds it from
 * whatever its own type check holds to the package (Vitre: site/src/docs/api.ts
 * against vitre.d.ts), so the page cannot list what does not ship.
 */
export interface LibraryApi {
  exports: ApiExport[];
  types: ApiType[];
}

const KINDS: ApiExport["kind"][] = ["component", "hook", "function", "constant"];

function matches(query: string, ...texts: string[]): boolean {
  const q = query.trim().toLowerCase();
  return !q || texts.some((t) => t.toLowerCase().includes(q));
}

/** Every export, by kind, then every public type's fields, filtered by name. */
export function ApiReference({ api, query = "" }: { api: LibraryApi; query?: string }) {
  const L = useLabStrings(LIBRARY_STRINGS);
  const { locale } = useLocale();
  const exports = api.exports.filter((e) => matches(query, e.name, e.signature));
  const types = api.types
    .map((t) =>
      matches(query, t.name) ? t : { ...t, fields: t.fields.filter((f) => matches(query, f.name, f.type)) },
    )
    .filter((t) => t.fields.length > 0);

  if (exports.length === 0 && types.length === 0) {
    return <p className={TYPE.caption}>{L.none}</p>;
  }

  return (
    <div className="space-y-12">
      {KINDS.map((kind) => {
        const ofKind = exports.filter((e) => e.kind === kind);
        if (ofKind.length === 0) return null;
        return (
          <section key={kind} className="space-y-3">
            <h2 className={TYPE.label}>{L.kinds[kind]}</h2>
            <ul className="divide-y divide-border/50 rounded-2xl border border-border/50 bg-glass backdrop-blur-xl">
              {ofKind.map((e) => (
                <li key={e.name} id={e.name} className="scroll-mt-[calc(var(--lab-under-bar)+1rem)] space-y-1.5 px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <code className="font-mono text-sm text-foreground">{e.name}</code>
                    {e.docs && (
                      <Link href={e.docs} className={cn(TYPE.meta, "inline-flex shrink-0 items-center gap-0.5 hover:text-foreground")}>
                        {L.inDocs}
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                  <pre className="no-scrollbar overflow-x-auto font-mono text-xs text-muted-foreground">{e.signature}</pre>
                  <p className={TYPE.caption}>{e.summary[locale]}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {types.length > 0 && (
        <section className="space-y-6">
          <h2 className={TYPE.label}>{L.types}</h2>
          {types.map((t) => (
            <div key={t.name} id={t.name} className="scroll-mt-[calc(var(--lab-under-bar)+1rem)] space-y-2">
              <h3 className="font-mono text-sm text-foreground">{t.name}</h3>
              {/* Not a table: a row is a signature line and a sentence, which
                  stacks on a phone where four columns would not fit. */}
              <dl className="divide-y divide-border/50 rounded-2xl border border-border/50 bg-glass backdrop-blur-xl">
                {t.fields.map((f) => (
                  <div key={f.name} className="space-y-1 px-4 py-2.5">
                    <dt className="font-mono text-xs">
                      <span className="text-foreground">{f.name}</span>
                      <span className="text-tertiary-foreground">: </span>
                      <span className="text-muted-foreground">{f.type}</span>
                      {f.default && <span className="text-tertiary-foreground"> = {f.default}</span>}
                    </dt>
                    <dd className={TYPE.caption}>{f.summary[locale]}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

/** The API page's one tool: a filter over names and signatures. */
export function ApiFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const L = useLabStrings(LIBRARY_STRINGS);
  return (
    <label className="flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 focus-within:border-foreground/40">
      <Search className="h-3 w-3 text-tertiary-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={L.filter}
        aria-label={L.filter}
        className="w-32 bg-transparent font-mono text-[16px] text-foreground outline-none placeholder:text-tertiary-foreground sm:w-44 sm:text-xs"
      />
    </label>
  );
}

// -----------------------------------------------------------------------------
// On hux.pro
// -----------------------------------------------------------------------------

/** One file of this site the library lives in, and what it does there. */
export interface LibraryFile {
  path: string;
  role: Text;
}

/** Where the library lives in this site, each file linked to the repository. */
export function LibraryFiles({ files }: { files: LibraryFile[] }) {
  const { locale } = useLocale();
  return (
    <ul className="divide-y divide-border/50 rounded-2xl border border-border/50 bg-glass backdrop-blur-xl">
      {files.map((f) => (
        <li key={f.path}>
          <a
            href={`${SITE_REPO}/${f.path}`}
            target="_blank"
            rel="noreferrer"
            className="group/file flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-glass-hover"
          >
            <span className="min-w-0 space-y-0.5">
              <code className="block break-all font-mono text-xs text-foreground">{f.path}</code>
              <span className={cn(TYPE.caption, "block")}>{f.role[locale]}</span>
            </span>
            <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0 text-tertiary-foreground transition-colors group-hover/file:text-foreground" />
          </a>
        </li>
      ))}
    </ul>
  );
}
