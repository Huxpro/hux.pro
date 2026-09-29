"use client";

import { Fragment } from "react";
import {
  AXES,
  SCALE_MAX,
  inkFor,
  inlineMarks,
  isTodo,
  plainText,
  tierOf,
  type InlineToken,
  type Language,
} from "@/lib/languages";
import type { Locale } from "@/lib/i18n";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";

// =============================================================================
// LanguageNote — what I have to say about one language.
//
// One view wherever a language is asked about: the card a dot on the chart
// opens (a popover under a pointer, the sheet on a phone), and a row of the
// index unfolded. The peek a pointer gets on hover is its short form
// (`LanguagePeek`): the same head, the first paragraph, nothing to press.
//
//   🐓  The Coq Proof Assistant          the note's own heading, with its link
//   interestingness  ▮▮▮▮▮▮▮▮▮  9       where it sits, as three short meters
//   experience       ▮▮▮▮▮▯▯▯▯  5
//   abstraction      ▮▮▮▮▮▮▮▮▮  9 pure
//   My favorite and most …               the notes, in the document voice
//   TBD (…)                              a note still to write, as an aside
// =============================================================================

/** The inline marks of a note: links, italics, code. */
export function InlineMarks({
  source,
  interactive = true,
}: {
  source: string;
  /** False in a peek, where nothing can be pressed: links are just words. */
  interactive?: boolean;
}) {
  return <Tokens tokens={inlineMarks(source)} interactive={interactive} />;
}

function Tokens({
  tokens,
  interactive,
}: {
  tokens: InlineToken[];
  interactive: boolean;
}) {
  return (
    <>
      {tokens.map((token, i) => {
        switch (token.kind) {
          case "text":
            return <Fragment key={i}>{token.text}</Fragment>;
          case "code":
            return (
              <code
                key={i}
                className="rounded bg-muted px-1 py-0.5 font-mono text-[0.875em] text-foreground"
              >
                {token.text}
              </code>
            );
          case "em":
            return (
              <em key={i} className="[font-synthesis-style:none] font-serif">
                <Tokens tokens={token.children} interactive={interactive} />
              </em>
            );
          case "link":
            return interactive ? (
              <a
                key={i}
                href={token.href}
                target="_blank"
                rel="noopener noreferrer"
                className="prose-link"
              >
                <Tokens tokens={token.children} interactive={interactive} />
              </a>
            ) : (
              <Fragment key={i}>
                <Tokens tokens={token.children} interactive={interactive} />
              </Fragment>
            );
        }
      })}
    </>
  );
}

/** A value on the 0–9 scale, as nine short bars (none lit at 0) and its number. */
function Meter({
  label,
  value,
  ink,
  detail,
}: {
  label: string;
  value: number;
  ink?: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <dt className={cn(TYPE.rowMeta, "w-28 shrink-0")}>{label}</dt>
      <dd className="flex min-w-0 items-center gap-2">
        <span aria-hidden className="flex gap-[2px]">
          {Array.from({ length: SCALE_MAX }, (_, i) => (
            <span
              key={i}
              className="h-2.5 w-[5px] rounded-[1px]"
              style={{
                background:
                  i < value
                    ? (ink ?? "var(--foreground)")
                    : "color-mix(in oklab, var(--ink) 10%, transparent)",
              }}
            />
          ))}
        </span>
        <span className={cn(TYPE.meta, "tabular-nums")}>{value}</span>
        {detail && (
          <span className={cn(TYPE.rowMeta, "truncate")}>{detail}</span>
        )}
      </dd>
    </div>
  );
}

function NoteHead({
  language,
  interactive,
}: {
  language: Language;
  interactive: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden className="text-xl leading-6">
        {language.emoji}
      </span>
      <h3 className="text-[15px] font-medium leading-6 text-foreground">
        <InlineMarks source={language.title} interactive={interactive} />
      </h3>
    </div>
  );
}

function Placement({ language, locale }: { language: Language; locale: Locale }) {
  return (
    <dl className="space-y-1.5">
      <Meter label={AXES.x.name[locale]} value={language.i13s} />
      <Meter label={AXES.y.name[locale]} value={language.exp} />
      <Meter
        label={AXES.abs.name[locale]}
        value={language.abs}
        ink={inkFor(language.abs)}
        detail={tierOf(language.abs).label[locale]}
      />
    </dl>
  );
}

export function LanguageNote({
  language,
  locale,
  head = "full",
  id,
  className,
}: {
  language: Language;
  locale: Locale;
  /**
   * `full` in the card, which is all there is. `source` under an index row,
   * which already shows the glyph and the heading's words: just the heading's
   * links, as a line of provenance.
   */
  head?: "full" | "source";
  id?: string;
  className?: string;
}) {
  return (
    <div id={id} className={cn("space-y-4", className)}>
      {head === "full" ? (
        <NoteHead language={language} interactive />
      ) : (
        <p lang="en" className={TYPE.caption}>
          <InlineMarks source={language.title} />
        </p>
      )}
      <Placement language={language} locale={locale} />
      {/* My words, in English whatever the locale — set as a document:
          selectable, links that preview. */}
      <div lang="en" className="space-y-3">
        {language.notes.map((note, i) =>
          isTodo(note) ? (
            <p key={i} className={TYPE.aside}>
              <InlineMarks source={note} />
            </p>
          ) : (
            <p
              key={i}
              className="text-sm leading-relaxed text-foreground/85 [overflow-wrap:anywhere]"
            >
              <InlineMarks source={note} />
            </p>
          ),
        )}
      </div>
    </div>
  );
}

/** The hover peek: the head, where it sits, and the first thing said. */
export function LanguagePeek({
  language,
  locale,
}: {
  language: Language;
  locale: Locale;
}) {
  const first = language.notes.find((n) => !isTodo(n));
  return (
    <div className="w-80 space-y-3 p-1">
      <NoteHead language={language} interactive={false} />
      <Placement language={language} locale={locale} />
      {first && (
        <p lang="en" className={cn(TYPE.caption, "line-clamp-4")}>
          {plainText(first)}
        </p>
      )}
    </div>
  );
}
