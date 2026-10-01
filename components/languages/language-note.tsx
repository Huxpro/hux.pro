"use client";

import { Fragment } from "react";
import { MousePointerClick } from "lucide-react";
import {
  AXES,
  SCALE_MAX,
  absColor,
  inlineMarks,
  isTodo,
  plainText,
  reachOf,
  tierOf,
  type InlineToken,
  type Language,
} from "@/lib/languages";
import type { Locale } from "@/lib/i18n";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";

// =============================================================================
// LanguageNote: what I have to say about one language.
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
  locale,
  interactive,
}: {
  language: Language;
  locale: Locale;
  interactive: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden className="text-xl leading-6">
        {language.emoji}
      </span>
      <h3 className="text-[15px] font-medium leading-6 text-foreground">
        <InlineMarks source={language.title[locale]} interactive={interactive} />
        {/* A later entry says when it joined the 2020 chart. */}
        {language.added && (
          <span className="ml-2 inline-block rounded bg-muted px-1.5 py-0.5 align-[0.1em] font-mono text-[10px] font-normal leading-none text-muted-foreground">
            {language.added}
          </span>
        )}
      </h3>
    </div>
  );
}

/**
 * Abstraction is a position, not an amount, so its row is not filled from
 * the left like the other two: all ten levels (0–9) sit in a row, the ones
 * the language reaches lit faintly in their own colours, and its own level
 * solid. A language with no range lights one bar. One with no level of its
 * own lights every bar, solid.
 */
function AbstractionMeter({ language, locale }: { language: Language; locale: Locale }) {
  const reach = reachOf(language);
  const tier = tierOf(language.abs);
  const ranged = reach[0] !== reach[1];
  return (
    <div className="flex items-center gap-3">
      <dt className={cn(TYPE.rowMeta, "w-28 shrink-0")}>{AXES.abs.name[locale]}</dt>
      <dd className="flex min-w-0 items-center gap-2">
        <span aria-hidden className="flex items-center gap-[2px]">
          {Array.from({ length: SCALE_MAX + 1 }, (_, level) => {
            const own = level === language.abs;
            const reached = level >= reach[0] && level <= reach[1];
            return (
              <span
                key={level}
                className={cn("w-[5px] rounded-[1px]", own ? "h-3" : "h-2.5")}
                style={{
                  background: reached
                    ? absColor(level)
                    : "color-mix(in oklab, var(--ink) 10%, transparent)",
                  opacity: reached && !own && language.abs !== null ? 0.4 : 1,
                }}
              />
            );
          })}
        </span>
        {tier.level !== null && (
          <span className={cn(TYPE.meta, "shrink-0 tabular-nums")}>
            {tier.level}
            {ranged && (
              <span className="text-tertiary-foreground"> ({reach[0]}–{reach[1]})</span>
            )}
          </span>
        )}
        <span className={cn(TYPE.rowMeta, "truncate")}>{tier.label[locale]}</span>
      </dd>
    </div>
  );
}

function Placement({ language, locale }: { language: Language; locale: Locale }) {
  return (
    <dl className="space-y-1.5">
      <Meter label={AXES.x.name[locale]} value={language.i13s} />
      <Meter label={AXES.y.name[locale]} value={language.exp} />
      <AbstractionMeter language={language} locale={locale} />
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
        <NoteHead language={language} locale={locale} interactive />
      ) : (
        <p className={TYPE.caption}>
          <InlineMarks source={language.title[locale]} />
        </p>
      )}
      <Placement language={language} locale={locale} />
      {/* My words, set as a document: selectable, links that preview. */}
      <div lang={locale} className="space-y-3">
        {language.notes[locale].map((note, i) =>
          isTodo(note) ? (
            // Upright in Chinese: the CJK serif has no oblique (lib/typography).
            <p key={i} className={cn(TYPE.aside, "[&:lang(zh)]:not-italic")}>
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

/**
 * The hover peek: a taste, and the way in. The dot's position already says
 * how interesting and how familiar the language is, so the peek does not
 * repeat it in meters; it names the language, its tier, and quotes the start
 * of the note. Then it says in so many words that a click opens the rest,
 * because a peek that already shows a lot reads as all there is.
 */
export function LanguagePeek({
  language,
  locale,
  openHint,
}: {
  language: Language;
  locale: Locale;
  /** "click to open the note", in the page's language. */
  openHint: string;
}) {
  const first = language.notes[locale].find((n) => !isTodo(n));
  const tier = tierOf(language.abs);
  return (
    <div className="w-80 p-1">
      <NoteHead language={language} locale={locale} interactive={false} />
      <p className={cn(TYPE.rowMeta, "mt-2 flex items-center gap-1.5")}>
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ background: absColor(language.abs) }}
        />
        {AXES.abs.name[locale]}
        {tier.level !== null && ` ${tier.level}`} · {tier.label[locale]}
        {language.absRange && ` · ${language.absRange[0]}–${language.absRange[1]}`}
      </p>
      {first && (
        <p lang={locale} className={cn(TYPE.caption, "mt-3 line-clamp-3")}>
          {plainText(first)}
        </p>
      )}
      <p
        className={cn(
          TYPE.labelSm,
          "mt-3 flex items-center gap-1.5 border-t border-border pt-2.5 text-muted-foreground",
        )}
      >
        <MousePointerClick aria-hidden className="size-3" />
        {openHint}
      </p>
    </div>
  );
}
