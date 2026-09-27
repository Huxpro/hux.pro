"use client";

import { cn } from "@/lib/utils";
import type { MouseEvent, ReactNode } from "react";

// =============================================================================
// Footnotes in the About's words — `<Fn n="1" />` in a sentence, and
// `<Footnote n="1">…</Footnote>` in a `<Footnotes>` block at the end.
//
// The mark scrolls the note into view inside the About's own scroll area and
// leaves the address alone (a hash would land in the history and in the
// URL a reader shares); the note's number scrolls back. The notes are set in
// the About's annotation type — the tiny mono line its credits were.
// =============================================================================

function jump(e: MouseEvent<HTMLAnchorElement>, id: string) {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

/** The mark in the sentence: a superscript number. */
export function Fn({ n }: { n: string | number }) {
  return (
    <sup className="ml-[0.1em] font-mono text-[0.68em] leading-none">
      <a
        id={`about-fnref-${n}`}
        href={`#about-fn-${n}`}
        onClick={(e) => jump(e, `about-fn-${n}`)}
        aria-label={`Note ${n}`}
        className="text-tertiary-foreground no-underline transition-colors hover:text-foreground"
      >
        {n}
      </a>
    </sup>
  );
}

/** The notes, at the end of the words. */
export function Footnotes({ children }: { children: ReactNode }) {
  return (
    <footer
      className={cn(
        "about-notes mt-2 space-y-2 font-mono text-[11px] leading-relaxed text-tertiary-foreground",
        "[&_a]:text-muted-foreground [&_a]:decoration-foreground/15",
      )}
    >
      {children}
    </footer>
  );
}

/** One note, its number leading back to its mark. */
export function Footnote({ n, children }: { n: string | number; children: ReactNode }) {
  return (
    <p id={`about-fn-${n}`} className="flex gap-2">
      <a
        href={`#about-fnref-${n}`}
        onClick={(e) => jump(e, `about-fnref-${n}`)}
        aria-label={`Back to note ${n}'s mark`}
        className="shrink-0 no-underline"
      >
        {n}
      </a>
      <span>{children}</span>
    </p>
  );
}
