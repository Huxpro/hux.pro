"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { AXES, byTier, inkFor, plainText } from "@/lib/languages";
import type { Locale } from "@/lib/i18n";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { LanguageNote } from "./language-note";

// =============================================================================
// LanguageIndex — the chart, read as a list.
//
// Every language, under the abstraction tier it was placed in (most abstract
// first, as the original source laid them out), each row folding open to its
// note. It is the chart's table view — what a screen reader, a search and a
// reader who would rather read than hover get — and the place a note can be
// linked to: `/languages#coq` lands on Coq's row, open.
//
// A document, not chrome: rows are selectable and the links preview.
// =============================================================================

export function LanguageIndex({ locale }: { locale: Locale }) {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());

  // A link to a language opens its row. Read after mount: the hash is not
  // part of a static page.
  useEffect(() => {
    const openFromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id || !document.getElementById(id)?.dataset.language) return;
      setOpenIds((prev) => new Set(prev).add(id));
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-8">
      {byTier().map(({ tier, languages }) => (
        <section key={tier.level} aria-labelledby={`tier-${tier.level}`}>
          <h3
            id={`tier-${tier.level}`}
            className={cn(TYPE.label, "mb-2 flex items-center gap-2")}
          >
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ background: inkFor(tier.level) }}
            />
            <span className="tabular-nums">{tier.level}</span>
            <span>{tier.label[locale]}</span>
          </h3>
          <ul className="-mx-2">
            {languages.map((language) => {
              const isOpen = openIds.has(language.id);
              return (
                <li
                  key={language.id}
                  id={language.id}
                  data-language
                  className="scroll-mt-24"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`note-${language.id}`}
                    onClick={() => toggle(language.id)}
                    className={cn(
                      "pressable group/row flex w-full items-baseline gap-3 rounded-lg px-2 py-2 text-left",
                      "transition-colors duration-200 hover:bg-accent active:bg-accent",
                      "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    )}
                  >
                    <span aria-hidden className="w-5 shrink-0 text-center">
                      {language.emoji}
                    </span>
                    <span className={cn(TYPE.rowTitle, "shrink-0 font-medium")}>
                      {language.name}
                    </span>
                    {/* The heading's words, unless they only repeat the
                        name (Scala: Scala). */}
                    <span
                      lang="en"
                      className="min-w-0 flex-1 truncate text-sm text-muted-foreground"
                    >
                      {plainText(language.title).toLowerCase() !==
                        language.name.toLowerCase() && plainText(language.title)}
                    </span>
                    <span
                      className={cn(TYPE.rowMeta, "shrink-0 tabular-nums")}
                      title={`${AXES.x.name[locale]} ${language.i13s} · ${AXES.y.name[locale]} ${language.exp}`}
                    >
                      {language.i13s}·{language.exp}
                    </span>
                    <ChevronRight
                      aria-hidden
                      className={cn(
                        "size-3.5 shrink-0 self-center text-tertiary-foreground transition-transform duration-200",
                        isOpen && "rotate-90",
                      )}
                    />
                  </button>
                  {isOpen && (
                    <LanguageNote
                      language={language}
                      locale={locale}
                      head="source"
                      id={`note-${language.id}`}
                      className="px-2 pb-5 pt-2 sm:pl-10"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
