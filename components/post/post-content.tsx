"use client";

import { PageLayout } from "@/components/ui/page-layout";
import type { PostLanguage } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { ChevronDown, Languages } from "lucide-react";
import { t } from "@/services";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { ReadingSettings } from "./reading-sheet";
import { RulerToc } from "./ruler-toc";
import { usePostLanguage } from "./use-post-language";

import { HeaderAction } from "@/components/ui/controls";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
interface PostContentProps {
  title: string;
  titleZh?: string;
  locale: Locale;
  language: PostLanguage;
  children: ReactNode;

  readingTime?: string;
  readingTimeZh?: string;

  backHref: string;
  backLabel: string;

  headerMeta?: ReactNode;
  origin?: string;
  originZh?: string;

  /** Show the scroll-driven ruler table of contents */
  toc?: boolean;

  onMount?: (slug: string, title: string, href: string) => void;
}

/**
 * Render a markdown string with inline links as JSX.
 * Supports `[text](url)` syntax only.
 */
function renderMarkdownLinks(md: string): ReactNode {
  const parts: ReactNode[] = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(md)) !== null) {
    if (match.index > lastIndex) {
      parts.push(md.slice(lastIndex, match.index));
    }
    parts.push(
      <a
        key={match.index}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 decoration-muted-foreground/30 hover:text-foreground hover:decoration-foreground/40 transition-colors"
      >
        {match[1]}
      </a>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < md.length) {
    parts.push(md.slice(lastIndex));
  }

  return parts;
}

export function PostContent({
  title,
  titleZh,
  locale,
  language,
  children,
  readingTime,
  readingTimeZh,
  backHref,
  backLabel,
  headerMeta,
  origin,
  originZh,
  toc,
  onMount,
}: PostContentProps) {
  const pathname = usePathname();
  const originId = useId();
  const [originOpen, setOriginOpen] = useState(false);

  const { displayLocale, switchLanguage, hasAlternate, alternateLabel } =
    usePostLanguage({ locale, language });

  useEffect(() => {
    if (onMount) {
      const segments = pathname.split("/");
      const slug = segments[segments.length - 2] || "";
      onMount(slug, title, pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayTitle = displayLocale === "zh" && titleZh ? titleZh : title;
  const displayReadingTime =
    displayLocale === "zh" && readingTimeZh ? readingTimeZh : readingTime;
  const displayOrigin =
    displayLocale === "zh" && originZh ? originZh : origin;
  // Two kinds of thing were sharing one line. The date, the reading time and
  // the language switch are handles — a word or two each, to scan and to
  // press. Provenance is a sentence. A sentence set among chips reads as
  // clutter however short it is, and the longest of them wrapped the row onto
  // two lines at every width, stranding a "·" at the end of the first and
  // leaving the "Aa" alone above an empty half-line.
  //
  // So the provenance folds away instead. It keeps the handles' face and its
  // size exactly -- the two things tried before this, a serif aside and a
  // point smaller, each bought quiet by making the header a place where two
  // typographic systems meet, which is the crowding it was meant to fix. A
  // chevron is not a third voice: the row is one line until someone asks it
  // not to be, and when they do the sentence arrives in the voice it always
  // had, one ink rung down because that is what tertiary is for.
  //
  // Folded by default. Provenance is a thing a reader looks up once, if ever;
  // the article is what they came for.
  const hasHandles = !!headerMeta || !!displayReadingTime || hasAlternate;
  const hasHeaderMetaContent = hasHandles || !!displayOrigin;
  /** The facts: a date, how long it takes. Plain text, joined by dots. */
  const headerFacts = (
    <>
      {headerMeta}

      {displayReadingTime && (
        <>
          {headerMeta && <span className="text-quaternary-foreground">·</span>}
          <span>{displayReadingTime}</span>
        </>
      )}

      {/* The handle for the line below, sitting with the facts because that is
          what it discloses -- one more fact, folded. Same glyph size as the
          language switch, same ink, same hover. */}
      {displayOrigin && (
        <button
          type="button"
          onClick={() => setOriginOpen((v) => !v)}
          aria-expanded={originOpen}
          aria-controls={originId}
          aria-label={t(displayLocale, "postOrigin")}
          title={t(displayLocale, "postOrigin")}
          className="inline-flex items-center hover:text-foreground transition-colors cursor-pointer"
        >
          <ChevronDown
            className={cn(
              "h-3 w-3 transition-transform duration-200",
              !originOpen && "-rotate-90"
            )}
          />
        </button>
      )}
    </>
  );

  /** What you can do to it. The chips /writing and /docs already use. */
  const headerChips = hasAlternate ? (
    <HeaderAction variant="action" onClick={switchLanguage}>
      <Languages className="h-3 w-3" />
      <span>{alternateLabel}</span>
    </HeaderAction>
  ) : null;

  /**
   * Where this text came from. Same face and same size as the handles above --
   * the only thing that marks it as the quieter line is the ink.
   *
   * Height animates through `grid-template-rows` 0fr -> 1fr (docs/motion.md):
   * CSS cannot transition height from 0 to `auto`, and a fixed height would be
   * a lie about a sentence that is one line for most posts and two for the
   * longest. `inert` while folded so the links inside are not a tab stop that
   * lands nowhere visible.
   */
  const headerOrigin = displayOrigin ? (
    <div
      id={originId}
      // React 19 renders `inert` as the boolean attribute.
      inert={!originOpen}
      className={cn(
        "grid transition-all duration-300 ease-out",
        originOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className={cn(TYPE.rowMeta, "pt-1.5")}>
          {renderMarkdownLinks(displayOrigin)}
        </div>
      </div>
    </div>
  ) : null;

  // One row: what this article is, then what you can do to it. The "Aa" used
  // to be pushed to the far edge with `ml-auto` and nudged up a pixel with
  // `-mt-1` to look level with the text beside it -- two hacks covering for
  // the fact that it was not in the row, and it landed in the ruler's lane
  // while it was out there. As a chip among the others it is level because
  // the row centres it, and it is nowhere near the margin.
  //
  // `relative z-[35]` on the whole row rather than on one control: the row
  // wraps, so any chip can end up near the docked edge on a narrow screen,
  // and the collapsed ruler (z-30) is interactive across a band it paints
  // nothing in. Under the open ruler's backdrop (z-40), as it should be.
  const headerActions =
    hasHeaderMetaContent || toc ? (
      <div className="relative z-[35]">
        {/* `hasHeaderMetaContent`, not `hasHandles`: the chevron lives in this
            row, so a post with provenance but no date, reading time or
            alternate would otherwise fold its origin away with nothing left
            to unfold it. */}
        {(hasHeaderMetaContent || toc) && (
          <div className={cn("flex flex-wrap items-center gap-2", TYPE.meta)}>
            {headerFacts}
            {headerChips}
            {toc && <ReadingSettings />}
          </div>
        )}
        {headerOrigin}
      </div>
    ) : undefined;

  return (
    <PageLayout
      title={displayTitle}
      backHref={backHref}
      backLabel={backLabel}
      variant="reader"
      headerActions={headerActions}
      className="min-h-screen"
    >
      <div className="prose-article" lang={displayLocale}>
        {children}
      </div>
      {toc && <RulerToc />}
    </PageLayout>
  );
}
